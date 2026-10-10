import type { OnboardingIllustrationName } from './components/OnboardingIllustration';

export type OnboardingScreenContent = {
  illustration: OnboardingIllustrationName;
  title: string;
  description: string;
};

/**
 * Centralized onboarding content.
 * TODO: replace the placeholder copy with the supplied designs.
 */
export const onboardingScreens: OnboardingScreenContent[] = [
  {
    illustration: 'pay',
    title: 'Tap to Pay',
    description:
      'Pay for every ride with a single tap. No cash, no tickets — just tap your phone and go.',
  },
  {
    illustration: 'ride',
    title: 'Ride Anywhere',
    description:
      'One wallet for buses, trains, and metro lines across the city. Top up once and travel everywhere.',
  },
  {
    illustration: 'security',
    title: 'Travel Securely',
    description:
      'Your payments are protected with bank-grade security, so you can ride with total peace of mind.',
  },
];
