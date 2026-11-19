import { router } from 'expo-router';

import { OnboardingScreen } from '@/features/onboarding/components/OnboardingScreen';
import { onboardingScreens } from '@/features/onboarding/data';
import { setCompletedOnboarding } from '@/features/auth/session';

export default function OnboardingScreen2Route() {
  const content = onboardingScreens[1];

  const handleSkip = async () => {
    await setCompletedOnboarding(true);
    router.replace('/login');
  };

  return (
    <OnboardingScreen
      content={content}
      step={2}
      totalSteps={onboardingScreens.length}
      buttonLabel="Next Step"
      onButtonPress={() => router.push('/onboarding/screen-3')}
      onSkip={handleSkip}
      onBack={() => router.back()}
      onSelectStep={(step) => {
        if (step === 1) router.back();
        if (step === 3) router.push('/onboarding/screen-3');
      }}
    />
  );
}
