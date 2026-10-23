/**
 * Registration (signup) service contract.
 *
 * The screens depend only on the `RegistrationService` interface, so the
 * HTTP client is the single place that knows the URL and body. The
 * register endpoint is a multipart form: `POST /auth/register` returns
 * 202 Accepted with no token and no user, so success here only means
 * the account was created — obtaining the session is the login call's
 * job (done separately, after verification).
 */

import type { DocumentImage, RegistrationData } from '../../types';

/**
 * The request the register endpoint accepts. String fields are sent as
 * form parts; `*_photo` fields are `DocumentImage` references that the
 * service attaches to the `FormData` as file parts (jpeg/jpg/png).
 */
export type RegistrationPayload = {
  name: string;
  name_en: string;
  name_np?: string;
  user_type: string;
  email: string;
  phone: string;
  address?: string;
  date_of_birth_ad?: string;
  date_of_birth_bs?: string;
  password: string;
  password_confirmation: string;
  // Student
  college_name?: string;
  college_address?: string;
  college_id_number?: string;
  college_id_card_expiry_date?: string;
  college_id_card_photo?: DocumentImage | null;
  // General
  citizenship_number?: string;
  citizenship_front_photo?: DocumentImage | null;
  citizenship_back_photo?: DocumentImage | null;
  // Senior citizen
  senior_citizen_card_number?: string;
  senior_citizen_card_front_photo?: DocumentImage | null;
  senior_citizen_card_back_photo?: DocumentImage | null;
};

export type RegistrationResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
      /** Field-level validation errors keyed by the API field name (422). */
      fieldErrors?: Record<string, string>;
      /** Populated on 429 with the backend's `retry_after` (seconds). */
      retryAfter?: number;
    };

export interface RegistrationService {
  register(data: RegistrationData): Promise<RegistrationResult>;
}
