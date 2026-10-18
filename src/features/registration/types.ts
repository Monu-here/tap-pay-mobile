/**
 * Shared types for the Tap & Pay registration flow.
 *
 * These types describe the local form state only. No server payloads are
 * constructed here — the shape is intentionally simple so it can be mapped
 * to a Laravel REST API later without breaking the UI layer.
 */

export type UserType = 'student' | 'general' | 'senior';

export type DocumentImage = {
  uri: string;
  width?: number;
  height?: number;
  /** File name returned by the picker, useful for future uploads. */
  fileName?: string;
  /** MIME type returned by the picker, useful for future uploads. */
  mimeType?: string;
};

export type PersonalInfo = {
  fullNameEnglish: string;
  fullNameNepali: string;
  email: string;
  phoneNumber: string;
  address: string;
  dateOfBirthAD: string;
  dateOfBirthBS: string;
  password: string;
  confirmPassword: string;
};

export type StudentDocuments = {
  collegeName: string;
  collegeAddress: string;
  collegeIdNumber: string;
  collegeIdExpiry: string;
  collegeIdPhoto: DocumentImage | null;
};

export type GeneralDocuments = {
  citizenshipNumber: string;
  citizenshipFrontPhoto: DocumentImage | null;
  citizenshipBackPhoto: DocumentImage | null;
};

export type SeniorDocuments = {
  seniorCardNumber: string;
  seniorCardFrontPhoto: DocumentImage | null;
  seniorCardBackPhoto: DocumentImage | null;
};

export type RegistrationData = {
  personal: PersonalInfo;
  userType: UserType | null;
  documents: StudentDocuments | GeneralDocuments | SeniorDocuments | null;
  verification: VerificationState;
};

/** The two independent contact channels that must each be verified. */
export type VerificationChannel = 'email' | 'phone';

/**
 * Verification state for one channel.
 *
 * `verifiedValue` records the exact address/number that was verified rather
 * than a bare boolean. Comparing it against the current form value is what
 * makes a changed contact detail automatically count as unverified again —
 * no separate invalidation step to forget.
 */
export type ChannelVerification = {
  verifiedValue: string | null;
  /** ISO timestamp of a successful verification. */
  verifiedAt: string | null;
};

export type VerificationState = {
  email: ChannelVerification;
  phone: ChannelVerification;
};

/** A discriminated document shape keyed by user type. */
export type DocumentsByUserType = {
  student: StudentDocuments;
  general: GeneralDocuments;
  senior: SeniorDocuments;
};

export const EMPTY_PERSONAL: PersonalInfo = {
  fullNameEnglish: '',
  fullNameNepali: '',
  email: '',
  phoneNumber: '',
  address: '',
  dateOfBirthAD: '',
  dateOfBirthBS: '',
  password: '',
  confirmPassword: '',
};

export const EMPTY_DOCUMENTS: DocumentsByUserType = {
  student: {
    collegeName: '',
    collegeAddress: '',
    collegeIdNumber: '',
    collegeIdExpiry: '',
    collegeIdPhoto: null,
  },
  general: {
    citizenshipNumber: '',
    citizenshipFrontPhoto: null,
    citizenshipBackPhoto: null,
  },
  senior: {
    seniorCardNumber: '',
    seniorCardFrontPhoto: null,
    seniorCardBackPhoto: null,
  },
};

export const EMPTY_VERIFICATION: VerificationState = {
  email: { verifiedValue: null, verifiedAt: null },
  phone: { verifiedValue: null, verifiedAt: null },
};

export const EMPTY_REGISTRATION: RegistrationData = {
  personal: EMPTY_PERSONAL,
  userType: null,
  documents: null,
  verification: EMPTY_VERIFICATION,
};