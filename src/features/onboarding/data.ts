import type { ImageSourcePropType } from 'react-native';

export type OnboardingFeature = {
  icon: 'qrcode' | 'location' | 'shield' | 'card' | 'bolt' | 'lock';
  title: string;
  subtitle: string;
};

export type OnboardingScreenContent = {
  id: string;
  step: number;
  badge: string;
  title: string;
  highlightWord: string;
  description: string;
  imageSource: ImageSourcePropType;
  features: OnboardingFeature[];
};

export const onboardingScreens: OnboardingScreenContent[] = [
  {
    id: 'scan-pay',
    step: 1,
    badge: 'CASHLESS COMMUTE',
    title: 'Scan & Pay on Any Bus in Seconds',
    highlightWord: 'Scan & Pay',
    description:
      'Never worry about loose change again. Scan the conductor QR code or tap your eYatra card for instant fare confirmation.',
    imageSource: require('@/assets/images/onboarding-1.jpg'),
    features: [
      {
        icon: 'qrcode',
        title: 'Instant QR Fares',
        subtitle: 'Auto-calculated fares based on your travel stop',
      },
      {
        icon: 'bolt',
        title: 'Offline Tap & Go',
        subtitle: 'Ride without delay even with low cellular signal',
      },
    ],
  },
  {
    id: 'track-routes',
    step: 2,
    badge: 'SMART TRANSIT',
    title: 'Live Bus Tracking & Transit Routes',
    highlightWord: 'Live Bus Tracking',
    description:
      'Track arriving buses across Kathmandu and beyond. See live stop ETAs, accurate routes, and plan your journey with zero guesswork.',
    imageSource: require('@/assets/images/onboarding-2.jpg'),
    features: [
      {
        icon: 'location',
        title: 'Real-time ETAs',
        subtitle: 'Accurate bus arrival times at your nearest stop',
      },
      {
        icon: 'card',
        title: 'Complete Journey Log',
        subtitle: 'Review past routes, driver ratings, and receipts',
      },
    ],
  },
  {
    id: 'secure-wallet',
    step: 3,
    badge: 'BANK-GRADE TRUST',
    title: 'Secure Transit Pass & Digital Wallet',
    highlightWord: 'Secure Transit Pass',
    description:
      'Protected with MPIN and biometric security. Top up effortlessly with eSewa, Khalti, or bank transfer for uninterrupted journeys.',
    imageSource: require('@/assets/images/onboarding-3.jpg'),
    features: [
      {
        icon: 'shield',
        title: 'MPIN & Biometric Lock',
        subtitle: 'Your wallet balance and card pass stay strictly protected',
      },
      {
        icon: 'lock',
        title: 'Instant Seamless Top-up',
        subtitle: 'Recharge in seconds via eSewa, Khalti, or Mobile Banking',
      },
    ],
  },
];
