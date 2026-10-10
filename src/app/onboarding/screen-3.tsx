import { router } from 'expo-router';

import { OnboardingScreen } from '@/features/onboarding/components/OnboardingScreen';
import { onboardingScreens } from '@/features/onboarding/data';

export default function OnboardingScreen3Route() {
  const content = onboardingScreens[2];

  return (
    <OnboardingScreen
      illustration={content.illustration}
      title={content.title}
      description={content.description}
      step={3}
      totalSteps={onboardingScreens.length}
      buttonLabel="Continue"
      onButtonPress={() => router.replace('/login')}
      onBack={() => router.back()}
    />
  );
}
