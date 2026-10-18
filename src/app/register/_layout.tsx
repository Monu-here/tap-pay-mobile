import { Stack } from 'expo-router';

import { RegistrationProvider } from '@/features/registration/RegistrationContext';

export default function RegisterLayout() {
  return (
    <RegistrationProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </RegistrationProvider>
  );
}