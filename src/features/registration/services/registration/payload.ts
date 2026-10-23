/**
 * Maps local registration form state onto the register request.
 *
 * The register endpoint is a multipart form that takes the account
 * fields (`name`, `name_en`, `user_type`, `email`, `phone`,
 * `password`, `password_confirmation`) plus a set of identity
 * document fields that depend on the selected user type. Photo
 * fields are `DocumentImage` references that the service attaches
 * to the `FormData` as file parts.
 *
 * Email is trimmed + lowercased; the phone is reshaped into the
 * wire format (`+977-<10-digit local number>`).
 */

import type { RegistrationData, UserType } from '../../types';
import { canonicalPhoneKey } from '../../utils/phone';
import type { RegistrationPayload } from './types';

/**
 * The API's `user_type` values. The local form uses `senior`, the
 * backend expects `senior_citizen`.
 */
const API_USER_TYPES: Record<Exclude<UserType, null>, string> = {
  student: 'student',
  general: 'general',
  senior: 'senior_citizen',
};

/**
 * API phone format: `+977-<10-digit local number>`.
 *
 * `canonicalPhoneKey` yields `977` + the 10 local digits regardless of
 * whether the user typed the country code, so slicing the first three
 * digits recovers the local part deterministically.
 */
function toApiPhone(value: string): string {
  const key = canonicalPhoneKey(value);
  const local = key.startsWith('977') ? key.slice(3) : key;
  return `+977-${local}`;
}

export function toRegistrationPayload(data: RegistrationData): RegistrationPayload {
  const { personal, userType, documents } = data;

  const payload: RegistrationPayload = {
    // `name` is the local-script name; `name_en` the Romanized one.
    // `name` falls back to the English name so it is never empty.
    name: personal.fullNameNepali.trim() || personal.fullNameEnglish.trim(),
    name_en: personal.fullNameEnglish.trim(),
    name_np: personal.fullNameNepali.trim(),
    user_type: userType ? API_USER_TYPES[userType] : '',
    email: personal.email.trim().toLowerCase(),
    phone: toApiPhone(personal.phoneNumber),
    address: personal.address.trim(),
    date_of_birth_ad: personal.dateOfBirthAD,
    date_of_birth_bs: personal.dateOfBirthBS,
    password: personal.password,
    // The register validator uses Laravel's `confirmed` rule on `password`.
    password_confirmation: personal.confirmPassword,
  };

  // Identity document fields are keyed by user type. Only the fields
  // for the selected type are attached; the backend ignores the rest.
  if (userType === 'student' && documents && 'collegeName' in documents) {
    payload.college_name = documents.collegeName.trim();
    payload.college_address = documents.collegeAddress.trim();
    payload.college_id_number = documents.collegeIdNumber.trim();
    const expiry = documents.collegeIdExpiry.trim();
    if (expiry) payload.college_id_card_expiry_date = expiry;
    payload.college_id_card_photo = documents.collegeIdPhoto;
  } else if (userType === 'general' && documents && 'citizenshipNumber' in documents) {
    payload.citizenship_number = documents.citizenshipNumber.trim();
    payload.citizenship_front_photo = documents.citizenshipFrontPhoto;
    if (documents.citizenshipBackPhoto) {
      payload.citizenship_back_photo = documents.citizenshipBackPhoto;
    }
  } else if (userType === 'senior' && documents && 'seniorCardNumber' in documents) {
    payload.senior_citizen_card_number = documents.seniorCardNumber.trim();
    payload.senior_citizen_card_front_photo = documents.seniorCardFrontPhoto;
    if (documents.seniorCardBackPhoto) {
      payload.senior_citizen_card_back_photo = documents.seniorCardBackPhoto;
    }
  }

  return payload;
}
