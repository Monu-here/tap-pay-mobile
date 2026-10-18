/**
 * HTTP implementation of the email verification service.
 *
 * Talks to the platform's confirmation endpoints:
 *
 *   POST /auth/resend-verification      (auth:sanctum) -> 202 { data: { verified }, message }
 *   GET  /auth/verify-email/{id}/{hash} (signed)       -> 200  { data: { verified }, message }
 *
 * `verify` is a public signed link, so it carries no auth header — the
 * signature is its proof of identity. `resend` is declared `auth:sanctum`, but
 * the current build calls it unauthenticated, so the bearer token is optional
 * and only attached when the caller supplies one.
 *
 * The response envelope from the controller's `ok()`/`accepted()` helpers is
 * read tolerantly (checking both a wrapped `data` object and the top level),
 * so a `{ data, message }` body and a flatter one both parse correctly.
 */

import { API_BASE_URL } from '../../config/api';
import type {
  EmailVerificationErrorReason,
  EmailVerificationOutcome,
  EmailVerificationService,
  VerifyEmailParams,
} from './types';

/**
 * Confirmation routes live under the API base (`.../api/v1`) auth group, so
 * these paths are relative to `API_BASE_URL`. Confirm the exact prefix matches
 * the Laravel route names (`auth.resend-verification`, `verification.verify`).
 */
const AUTH_BASE_PATH = '/auth';
const RESEND_PATH = `${AUTH_BASE_PATH}/resend-verification`;
const VERIFY_PATH = `${AUTH_BASE_PATH}/verify-email`;

const REQUEST_TIMEOUT_MS = 15000;

export class LaravelEmailVerificationService implements EmailVerificationService {
  async resend(accessToken?: string): Promise<EmailVerificationOutcome> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    // The route is `auth:sanctum`; the current build calls it without a token,
    // but the header is attached the moment a caller has one.
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE_URL}${RESEND_PATH}`, {
        method: 'POST',
        headers,
        // The endpoint validates nothing from the body, but sends JSON to keep
        // the request well-formed for the FormRequest.
        body: JSON.stringify({}),
        signal: controller.signal,
      });
      return await toOutcome(response, 'resend');
    } catch (error) {
      return networkOrAbortOutcome(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  async verify({ id, hash, query }: VerifyEmailParams): Promise<EmailVerificationOutcome> {
    // Built by string concatenation rather than the WHATWG `URL`/`URLSearchParams`
    // API, which is only partially available on Hermes.
    let url = `${API_BASE_URL}${VERIFY_PATH}/${encodeURIComponent(String(id))}/${encodeURIComponent(hash)}`;
    if (query) {
      url += `?signature=${encodeURIComponent(query.signature)}&expires=${encodeURIComponent(String(query.expires))}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      return await toOutcome(response, 'verify');
    } catch (error) {
      return networkOrAbortOutcome(error);
    } finally {
      clearTimeout(timeout);
    }
  }
}

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

function readVerified(body: unknown): boolean | null {
  const root = asRecord(body);
  if (!root) return null;
  if (typeof root.verified === 'boolean') return root.verified;
  const data = asRecord(root.data);
  if (data && typeof data.verified === 'boolean') return data.verified;
  return null;
}

function readMessage(body: unknown): string | null {
  const root = asRecord(body);
  if (!root) return null;
  if (typeof root.message === 'string') return root.message;
  const data = asRecord(root.data);
  if (data && typeof data.message === 'string') return data.message;
  return null;
}

function defaultSuccessMessage(kind: 'resend' | 'verify', verified: boolean): string {
  if (kind === 'resend') {
    return verified
      ? 'This address is already verified.'
      : 'Verification email sent. Please check your inbox.';
  }
  return 'Your email address has been verified.';
}

function reasonForStatus(status: number): EmailVerificationErrorReason {
  if (status === 401) return 'unauthenticated';
  if (status === 403 || status === 404) return 'invalid';
  if (status === 429) return 'throttled';
  return 'unknown';
}

function defaultErrorMessage(status: number): string {
  if (status === 401) return 'Your session has expired. Please sign in and try again.';
  if (status === 403) return 'This verification link is invalid or has expired.';
  if (status === 404) return "We couldn't find an account to verify.";
  if (status === 429) return 'Too many attempts. Please wait a moment and try again.';
  return 'Something went wrong. Please try again.';
}

async function toOutcome(
  response: Response,
  kind: 'resend' | 'verify',
): Promise<EmailVerificationOutcome> {
  const text = await response.text();
  const body = text ? safeParse(text) : null;

  if (response.ok) {
    // A successful `verify` (200) means the address is verified whether the link
    // was just followed or had been used before, so the flag defaults to true.
    const verified = readVerified(body) ?? kind === 'verify';
    return {
      ok: true,
      verified,
      message: readMessage(body) ?? defaultSuccessMessage(kind, verified),
    };
  }

  return {
    ok: false,
    message: readMessage(body) ?? defaultErrorMessage(response.status),
    reason: reasonForStatus(response.status),
  };
}

function networkOrAbortOutcome(error: unknown): EmailVerificationOutcome {
  if (error instanceof Error && error.name === 'AbortError') {
    return {
      ok: false,
      message: 'The request timed out. Check your connection and try again.',
      reason: 'network',
    };
  }
  return {
    ok: false,
    message: 'Could not reach the server. Check your connection and try again.',
    reason: 'network',
  };
}
