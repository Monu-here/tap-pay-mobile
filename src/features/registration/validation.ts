/**
 * Client-side validation helpers for the registration flow.
 *
 * These functions return a human-readable error string or `null` when the
 * value is valid. They are intentionally lightweight — no network calls,
 * no persistence — so they can be reused on every screen.
 */

import type {
  GeneralDocuments,
  PersonalInfo,
  RegistrationData,
  SeniorDocuments,
  StudentDocuments,
  UserType,
} from './types';
import { convertAdToBs, formatBsIso } from './utils/nepaliDate';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NEPAL_PHONE_REGEX = /^977\d{10}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Strips a leading +977 / 977 prefix and keeps only digits. */
function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('977')) return digits;
  return `977${digits}`;
}

export function validateFullName(value: string, label: string): string | null {
  if (!value.trim()) return `${label} is required`;
  if (value.trim().length < 2) return `${label} must be at least 2 characters`;
  return null;
}

export function validateEmail(value: string): string | null {
  if (!value.trim()) return 'Email is required';
  if (!EMAIL_REGEX.test(value.trim())) return 'Enter a valid email address';
  return null;
}

export function validatePhone(value: string): string | null {
  if (!value.trim()) return 'Phone number is required';
  const normalized = normalizePhone(value.trim());
  if (!NEPAL_PHONE_REGEX.test(normalized)) {
    return 'Enter a valid Nepali number (977 followed by 10 digits)';
  }
  return null;
}

export function validateAddress(value: string): string | null {
  if (!value.trim()) return 'Address is required';
  if (value.trim().length < 5) return 'Address must be at least 5 characters';
  return null;
}

export function validateDate(value: string, label: string): string | null {
  if (!value.trim()) return `${label} is required`;
  if (!DATE_REGEX.test(value.trim())) return `${label} must use YYYY-MM-DD format`;
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return 'Password is required';
  if (value.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(value)) return 'Password must include an uppercase letter';
  if (!/[a-z]/.test(value)) return 'Password must include a lowercase letter';
  if (!/[0-9]/.test(value)) return 'Password must include a number';
  return null;
}

export function validateConfirmPassword(password: string, confirm: string): string | null {
  if (!confirm) return 'Please confirm your password';
  if (password !== confirm) return 'Passwords do not match';
  return null;
}

export function validateUserType(value: UserType | null): string | null {
  if (!value) return 'Please select a user type to continue';
  return null;
}

export type PersonalInfoErrors = Record<keyof PersonalInfo, string | undefined>;

/** Both DOB fields must be present and describe the same calendar day. */
export function validateDatePair(adIso: string, bsIso: string): string | null {
  if (!adIso.trim() || !bsIso.trim()) return 'Please select your date of birth';

  const adError = validateDate(adIso, 'Date of Birth (AD)');
  if (adError) return adError;

  const bsError = validateDate(bsIso, 'Date of Birth (BS)');
  if (bsError) return bsError;

  // Cross-check the pair: converting the AD date must land on the BS date.
  // A mismatch means the two fields drifted apart, so state is stale.
  const fromAd = convertAdToBs(adIso);
  if (!fromAd.ok) return fromAd.message;
  if (formatBsIso(fromAd.value) !== bsIso.trim()) {
    return 'The AD and BS dates do not match. Please reselect your date of birth.';
  }

  return null;
}

export function validatePersonalInfo(personal: PersonalInfo): PersonalInfoErrors {
  const pairError = validateDatePair(personal.dateOfBirthAD, personal.dateOfBirthBS);
  return {
    fullNameEnglish: validateFullName(personal.fullNameEnglish, 'Full Name (English)') ?? undefined,
    fullNameNepali: validateFullName(personal.fullNameNepali, 'Full Name (Nepali)') ?? undefined,
    email: validateEmail(personal.email) ?? undefined,
    phoneNumber: validatePhone(personal.phoneNumber) ?? undefined,
    address: validateAddress(personal.address) ?? undefined,
    dateOfBirthAD: pairError ?? undefined,
    dateOfBirthBS: undefined,
    password: validatePassword(personal.password) ?? undefined,
    confirmPassword:
      validateConfirmPassword(personal.password, personal.confirmPassword) ?? undefined,
  };
}

export type DocumentErrors = Record<string, string | undefined>;

/** Validates the documents that belong to the currently selected user type. */
export function validateDocumentsForUserType(
  userType: UserType,
  documents: RegistrationData['documents'],
): DocumentErrors {
  const errors: DocumentErrors = {};
  if (!documents) return errors;

  if (userType === 'student') {
    const d = documents as StudentDocuments;
    if (!d.collegeName.trim()) errors.collegeName = 'College name is required';
    if (!d.collegeAddress.trim()) errors.collegeAddress = 'College address is required';
    if (!d.collegeIdNumber.trim()) errors.collegeIdNumber = 'College ID card number is required';
    if (d.collegeIdExpiry.trim() && !DATE_REGEX.test(d.collegeIdExpiry.trim())) {
      errors.collegeIdExpiry = 'Expiry date must use YYYY-MM-DD format';
    }
    if (!d.collegeIdPhoto) errors.collegeIdPhoto = 'College ID card photo is required';
  } else if (userType === 'general') {
    const d = documents as GeneralDocuments;
    if (!d.citizenshipNumber.trim()) {
      errors.citizenshipNumber = 'Citizenship certificate number is required';
    }
    if (!d.citizenshipFrontPhoto) errors.citizenshipFrontPhoto = 'Citizenship front photo is required';
  } else if (userType === 'senior') {
    const d = documents as SeniorDocuments;
    if (!d.seniorCardNumber.trim()) errors.seniorCardNumber = 'Senior citizen card number is required';
    if (!d.seniorCardFrontPhoto) {
      errors.seniorCardFrontPhoto = 'Senior citizen card front photo is required';
    }
  }

  return errors;
}

export function isRegistrationComplete(data: RegistrationData): boolean {
  if (!data.userType) return false;
  if (Object.values(validatePersonalInfo(data.personal)).some(Boolean)) return false;
  if (Object.values(validateDocumentsForUserType(data.userType, data.documents)).some(Boolean)) {
    return false;
  }
  return true;
}