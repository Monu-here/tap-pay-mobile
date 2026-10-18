/**
 * Registration service selector.
 *
 * Screens import `registrationService` from here and never construct an
 * implementation themselves.
 */

import { PlatformRegistrationService } from './platformRegistrationService';
import type { RegistrationService } from './types';

export const registrationService: RegistrationService = new PlatformRegistrationService();

export { toRegistrationPayload } from './payload';
export type { RegistrationPayload, RegistrationResult, RegistrationService } from './types';
