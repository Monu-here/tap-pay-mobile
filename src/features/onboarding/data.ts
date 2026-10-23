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
    title: 'Scan to Pay',
    description:
      'Scan the official driver QR code and confirm your fare using your Tap & Pay wallet.',
  },
  {
    illustration: 'ride',
    title: 'Ride Anywhere',
    description:
      'Add money to your wallet, manage your transit card, and review your bus travel history.',
  },
  {
    illustration: 'security',
    title: 'Travel Securely',
    description:
      'Your payments are protected with bank-grade security, so you can ride with total peace of mind.',
  },
];
