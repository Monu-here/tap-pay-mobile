/**
 * HTTP implementation of the registration (signup) service.
 *
 * `POST /auth/register` is an unauthenticated multipart form. The
 * account fields are sent as form parts and the identity-document
 * photos are attached as file parts (`{ uri, name, type }`), which is
 * what the backend's image validators require — a JSON body with a
 * base64 string is rejected.
 *
 * The endpoint answers with a `{ success, message, error_code, errors }`
 * envelope. `success: true` (HTTP 202) means the account was created;
 * every other combination is a failure:
 *   - 422 -> validation, with per-field messages under top-level `errors`
 *   - 409 -> a conflicting resource (duplicate phone / document number)
 *   - 429 -> throttled, with `retry_after`
 *   - 202 with `success: false` -> the duplicate-email response, which
 *     deliberately reads like an acceptance so addresses cannot be
 *     enumerated; it is still a failure here because no new account
 *     was created.
 *
 * A real network failure (DNS/offline/timeout) is distinguished from an
 * HTTP error: only the former becomes the generic "could not reach the
 * server" message.
 */

import { common } from '@/constants/strings';

import { API_BASE_URL } from '../../config/api';
import type { DocumentImage, RegistrationData } from '../../types';
import { toRegistrationPayload } from './payload';
import type { RegistrationResult, RegistrationService } from './types';

const REGISTER_PATH = '/auth/register';
const REQUEST_TIMEOUT_MS = 15000;
const DEFAULT_RETRY_AFTER = 60;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Reads Laravel-style `{ errors: { field: [messages] } }` into `{ field: message }`. */
function fieldErrorsOf(root: Record<string, unknown> | null): Record<string, string> | undefined {
  const errors = root ? asRecord(root.errors) : null;
  if (!errors) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(errors)) {
    const message = Array.isArray(value)
      ? value.find((entry): entry is string => typeof entry === 'string')
      : typeof value === 'string'
        ? value
        : undefined;
    if (message) out[key] = message;
  }
  return Object.keys(out).length ? out : undefined;
}

function readRetryAfter(root: Record<string, unknown> | null, response: Response): number {
  const bodyValue = root?.retry_after ?? asRecord(root?.data)?.retry_after;
  if (typeof bodyValue === 'number' && Number.isFinite(bodyValue)) {
    return Math.max(0, Math.round(bodyValue));
  }
  const header = response.headers?.get?.('Retry-After');
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds));
  }
  return DEFAULT_RETRY_AFTER;
}

/**
 * Appends a picked image to the form as a file part. React Native's
 * `FormData` accepts a `{ uri, name, type }` object for file uploads;
 * the DOM typings do not model it, hence the cast.
 */
function appendPhoto(
  formData: FormData,
  key: string,
  image: DocumentImage | null | undefined,
): void {
  if (!image?.uri) return;
  const part = {
    uri: image.uri,
    name: image.fileName || `${key}.jpg`,
    type: image.mimeType || 'image/jpeg',
  };
  formData.append(key, part as unknown as Blob);
}

/** Builds the multipart body from the mapped payload. */
function toFormData(payload: ReturnType<typeof toRegistrationPayload>): FormData {
  const formData = new FormData();

  formData.append('name', payload.name);
  formData.append('name_en', payload.name_en);
  formData.append('user_type', payload.user_type);
  formData.append('email', payload.email);
  formData.append('phone', payload.phone);
  formData.append('password', payload.password);
  formData.append('password_confirmation', payload.password_confirmation);

  if (payload.college_name !== undefined) formData.append('college_name', payload.college_name);
  if (payload.college_address !== undefined) {
    formData.append('college_address', payload.college_address);
  }
  if (payload.college_id_number !== undefined) {
    formData.append('college_id_number', payload.college_id_number);
  }
  if (payload.college_id_expiry !== undefined) {
    formData.append('college_id_expiry', payload.college_id_expiry);
  }
  appendPhoto(formData, 'college_id_card_photo', payload.college_id_card_photo);

  if (payload.citizenship_number !== undefined) {
    formData.append('citizenship_number', payload.citizenship_number);
  }
  appendPhoto(formData, 'citizenship_front_photo', payload.citizenship_front_photo);
  appendPhoto(formData, 'citizenship_back_photo', payload.citizenship_back_photo);

  if (payload.senior_citizen_card_number !== undefined) {
    formData.append('senior_citizen_card_number', payload.senior_citizen_card_number);
  }
  appendPhoto(formData, 'senior_citizen_card_front_photo', payload.senior_citizen_card_front_photo);
  appendPhoto(formData, 'senior_citizen_card_back_photo', payload.senior_citizen_card_back_photo);

  return formData;
}

async function interpretRegistrationResponse(response: Response): Promise<RegistrationResult> {
  const text = await response.text();
  const root = asRecord(safeParse(text));
  const success = root?.success === true;
  const message = typeof root?.message === 'string' ? root.message : null;

  // 2xx with success:true is the only success shape.
  if (response.ok && success) {
    return { ok: true };
  }

  if (response.status === 429) {
    return {
      ok: false,
      message: message ?? common.rateLimited,
      retryAfter: readRetryAfter(root, response),
    };
  }

  if (response.status === 422) {
    return {
      ok: false,
      message: message ?? 'Please fix the highlighted fields.',
      fieldErrors: fieldErrorsOf(root),
    };
  }

  if (response.status === 409) {
    // Conflicting resource: duplicate phone number or document number.
    return { ok: false, message: message ?? common.generic };
  }

  // 2xx but success:false — the duplicate-email anti-enumeration
  // response. No account was created, so it is a failure here.
  if (response.ok && !success) {
    return { ok: false, message: message ?? common.generic };
  }

  if (response.status >= 500) {
    return { ok: false, message: common.serverError };
  }

  return { ok: false, message: message ?? common.generic };
}

export class PlatformRegistrationService implements RegistrationService {
  async register(data: RegistrationData): Promise<RegistrationResult> {
    const payload = toRegistrationPayload(data);
    const formData = toFormData(payload);

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // Show exactly what register sends; passwords are redacted (never logged).
      console.log('[register] request fields', {
        name: payload.name,
        name_en: payload.name_en,
        user_type: payload.user_type,
        email: payload.email,
        phone: payload.phone,
        locale: 'n/a (not sent)',
        password: '***',
        password_confirmation: '***',
        hasCollegePhoto: Boolean(payload.college_id_card_photo?.uri),
        hasCitizenshipFrontPhoto: Boolean(payload.citizenship_front_photo?.uri),
        hasSeniorCardFrontPhoto: Boolean(payload.senior_citizen_card_front_photo?.uri),
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE_URL}${REGISTER_PATH}`, {
        method: 'POST',
        // `Accept` is set explicitly; `Content-Type` is left for `fetch`
        // to derive so the multipart boundary is included.
        headers: { Accept: 'application/json' },
        body: formData,
        signal: controller.signal,
      });
      return await interpretRegistrationResponse(response);
    } catch (error) {
      // No response reached us (DNS/offline/aborted): the only case
      // shown as "could not reach the server".
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        const reason = error instanceof Error ? `${error.name}: ${error.message}` : 'unknown error';
        console.log(`[register] no response (${reason})`);
      }
      if (error instanceof Error && error.name === 'AbortError') {
        return { ok: false, message: 'The request timed out. Check your connection and try again.' };
      }
      return { ok: false, message: common.network };
    } finally {
      clearTimeout(timeout);
    }
  }
}
