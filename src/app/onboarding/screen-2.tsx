import { router } from 'expo-router';

import { OnboardingScreen } from '@/features/onboarding/components/OnboardingScreen';
import { onboardingScreens } from '@/features/onboarding/data';

export default function OnboardingScreen2Route() {
  const content = onboardingScreens[1];

  return (
    <OnboardingScreen
      illustration={content.illustration}
      title={content.title}
      description={content.description}
      step={2}
      totalSteps={onboardingScreens.length}
      buttonLabel="Next"
      onButtonPress={() => router.push('/onboarding/screen-3')}
      onSkip={() => router.replace('/login')}
      onBack={() => router.back()}
    />
  );
}
