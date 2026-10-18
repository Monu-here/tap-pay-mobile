/**
 * Registration form state manager.
 *
 * A React Context wraps the entire multi-step registration flow so that
 * entered data survives back/forward navigation between screens. State is
 * kept purely in memory — no network persistence — so the shape is
 * trivially replaceable with a Redux slice or React Query cache later.
 *
 * Email and phone verification are tracked independently in
 * `data.verification`. Each channel records the exact value that was
 * verified, so a changed contact detail stops matching and therefore stops
 * counting as verified without any explicit reset step.
 */

import type {
  ChannelVerification,
  DocumentsByUserType,
  PersonalInfo,
  RegistrationData,
  UserType,
  VerificationChannel,
} from './types';
import { EMPTY_DOCUMENTS, EMPTY_REGISTRATION } from './types';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { canonicalPhoneKey } from './utils/phone';

type RegistrationContextValue = {
  data: RegistrationData;
  setPersonal: (personal: PersonalInfo) => void;
  setUserType: (userType: UserType | null) => void;
  setDocuments: (documents: RegistrationData['documents']) => void;
  updatePersonalField: <K extends keyof PersonalInfo>(key: K, value: PersonalInfo[K]) => void;
  /** Marks one channel verified against the value that was just verified. */
  markChannelVerified: (channel: VerificationChannel, verifiedValue: string) => void;
  /** Clears one channel, or both when called with no argument. */
  clearChannelVerification: (channel?: VerificationChannel) => void;
  /** True when the channel is verified *and* still matches the current form value. */
  isChannelVerified: (channel: VerificationChannel) => boolean;
  /** True when both email and phone are currently verified. */
  isFullyVerified: boolean;
  resetRegistration: () => void;
};

const RegistrationContext = createContext<RegistrationContextValue | null>(null);

export function useRegistration() {
  const context = useContext(RegistrationContext);
  if (!context) {
    throw new Error('useRegistration must be used within a RegistrationProvider');
  }
  return context;
}

function emptyDocumentsFor(userType: UserType | null): RegistrationData['documents'] {
  if (!userType) return null;
  return EMPTY_DOCUMENTS[userType];
}

/**
 * The canonical value a channel is verified against. Emails compare
 * case-insensitively; phones are normalized so `+977` (added by the picker)
 * and `977` typed by hand are the same key.
 */
function currentChannelValue(
  data: RegistrationData,
  channel: VerificationChannel,
): string {
  if (channel === 'email') return data.personal.email.trim().toLowerCase();
  return canonicalPhoneKey(data.personal.phoneNumber);
}

export function RegistrationProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<RegistrationData>(EMPTY_REGISTRATION);

  const setPersonal = useCallback((personal: PersonalInfo) => {
    setData((prev) => ({ ...prev, personal }));
  }, []);

  const setUserType = useCallback((userType: UserType | null) => {
    setData((prev) => {
      const nextDocuments = userType === prev.userType ? prev.documents : emptyDocumentsFor(userType);
      return { ...prev, userType, documents: nextDocuments };
    });
  }, []);

  const setDocuments = useCallback((documents: RegistrationData['documents']) => {
    setData((prev) => ({ ...prev, documents }));
  }, []);

  const updatePersonalField = useCallback(
    <K extends keyof PersonalInfo>(key: K, value: PersonalInfo[K]) => {
      setData((prev) => ({
        ...prev,
        personal: { ...prev.personal, [key]: value },
      }));
    },
    [],
  );

  const markChannelVerified = useCallback(
    (channel: VerificationChannel, verifiedValue: string) => {
      setData((prev) => ({
        ...prev,
        verification: {
          ...prev.verification,
          [channel]: {
            verifiedValue,
            verifiedAt: new Date().toISOString(),
          } satisfies ChannelVerification,
        },
      }));
    },
    [],
  );

  const clearChannelVerification = useCallback((channel?: VerificationChannel) => {
    setData((prev) => {
      const cleared: ChannelVerification = { verifiedValue: null, verifiedAt: null };
      if (!channel) {
        return {
          ...prev,
          verification: { email: cleared, phone: cleared },
        };
      }
      return {
        ...prev,
        verification: { ...prev.verification, [channel]: cleared },
      };
    });
  }, []);

  const isChannelVerified = useCallback(
    (channel: VerificationChannel) => {
      const record = data.verification[channel];
      if (!record.verifiedValue) return false;
      return record.verifiedValue === currentChannelValue(data, channel);
    },
    [data],
  );

  const isFullyVerified = useMemo(
    () => isChannelVerified('email') && isChannelVerified('phone'),
    [isChannelVerified],
  );

  const resetRegistration = useCallback(() => {
    setData(EMPTY_REGISTRATION);
  }, []);

  const value = useMemo(
    () => ({
      data,
      setPersonal,
      setUserType,
      setDocuments,
      updatePersonalField,
      markChannelVerified,
      clearChannelVerification,
      isChannelVerified,
      isFullyVerified,
      resetRegistration,
    }),
    [
      data,
      setPersonal,
      setUserType,
      setDocuments,
      updatePersonalField,
      markChannelVerified,
      clearChannelVerification,
      isChannelVerified,
      isFullyVerified,
      resetRegistration,
    ],
  );

  return (
    <RegistrationContext.Provider value={value}>{children}</RegistrationContext.Provider>
  );
}

export type { DocumentsByUserType };
