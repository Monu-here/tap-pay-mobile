import { router } from 'expo-router';

import { OnboardingScreen } from '@/features/onboarding/components/OnboardingScreen';
import { onboardingScreens } from '@/features/onboarding/data';

export default function OnboardingScreen1Route() {
  const content = onboardingScreens[0];

  return (
    <OnboardingScreen
      illustration={content.illustration}
      title={content.title}
      description={content.description}
      step={1}
      totalSteps={onboardingScreens.length}
      buttonLabel="Next"
      onButtonPress={() => router.push('/onboarding/screen-2')}
      onSkip={() => router.replace('/login')}
    />
  );
}
