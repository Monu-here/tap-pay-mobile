/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/**
 * Fixed brand colors for the Tap & Pay onboarding and login flows.
 * Derived from the app splash screen background (#208AEF) and the
 * app icon gradient (#3C9FFE -> #0274DF).
 */
export const Brand = {
  primary: '#208AEF',
  primaryDark: '#0274DF',
  gradientStart: '#3C9FFE',
  gradientEnd: '#0274DF',
  text: '#0A1B2E',
  textSecondary: '#5C6B7A',
  divider: '#E3E9F0',
  inputBackground: '#F3F6FA',
  white: '#FFFFFF',
  error: '#DC2626',
  /**
   * Teal accent palette used for the Tap & Pay registration flow.
   * Derived from the app icon secondary gradient (#00B8A9 -> #00796B).
   */
  teal: {
    primary: '#00B8A9',
    primaryDark: '#00796B',
    light: '#E0F2F1',
    soft: '#B2DFDB',
    text: '#004D40',
  },
  /**
   * User-type card selection states.
   */
  selection: {
    selectedBorder: '#208AEF',
    selectedBackground: '#E8F1FF',
    unselectedBackground: '#FFFFFF',
  },
} as const;
