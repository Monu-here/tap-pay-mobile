import { router } from 'expo-router';

import { OnboardingScreen } from '@/features/onboarding/components/OnboardingScreen';
import { onboardingScreens } from '@/features/onboarding/data';
import { setCompletedOnboarding } from '@/features/auth/session';

export default function OnboardingScreen1Route() {
  const content = onboardingScreens[0];

  const handleSkip = async () => {
    await setCompletedOnboarding(true);
    router.replace('/login');
  };

  return (
    <OnboardingScreen
      content={content}
      step={1}
      totalSteps={onboardingScreens.length}
      buttonLabel="Next Step"
      onButtonPress={() => router.push('/onboarding/screen-2')}
      onSkip={handleSkip}
      onSelectStep={(step) => {
        if (step === 2) router.push('/onboarding/screen-2');
        if (step === 3) router.push('/onboarding/screen-3');
      }}
    />
  );
}
