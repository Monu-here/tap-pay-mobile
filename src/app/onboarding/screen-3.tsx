import { router } from 'expo-router';

import { OnboardingScreen } from '@/features/onboarding/components/OnboardingScreen';
import { onboardingScreens } from '@/features/onboarding/data';
import { setCompletedOnboarding } from '@/features/auth/session';

export default function OnboardingScreen3Route() {
  const content = onboardingScreens[2];

  const handleFinish = async () => {
    await setCompletedOnboarding(true);
    router.replace('/login');
  };

  return (
    <OnboardingScreen
      content={content}
      step={3}
      totalSteps={onboardingScreens.length}
      buttonLabel="Get Started with eYatra"
      onButtonPress={handleFinish}
      onSkip={handleFinish}
      onBack={() => router.back()}
      onSelectStep={(step) => {
        if (step === 1) router.navigate('/onboarding/screen-1');
        if (step === 2) router.back();
      }}
    />
  );
}
