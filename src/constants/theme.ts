import '@/global.css';

import { Platform } from 'react-native';

/** Premium Urban Mobility palette used by the existing shared screen styles. */

export const Monochrome = {
  background: '#F5F7F5',
  surfacePrimary: '#FFFFFF',
  surfaceSecondary: '#FFFFFF',
  surfaceElevated: '#E3F4EF',
  border: '#E5EBE8',
  borderLight: '#E5EBE8',
  textPrimary: '#172B3A',
  textSecondary: '#687782',
  textMuted: '#687782',
  actionPrimary: '#0F766E',
  actionPrimaryText: '#FFFFFF',
  actionSecondary: '#E3F4EF',
  actionSecondaryText: '#115E59',
  cardSurface: '#FFFFFF',
  cardVirtual: '#115E59',
  badgeBackground: '#E3F4EF',
  badgeText: '#115E59',
} as const;

const DarkColors = {
  background: '#111111',
  surfacePrimary: '#000000',
  surfaceSecondary: '#1C1C1C',
  surfaceElevated: '#262626',
  border: '#383838',
  textPrimary: '#FFFFFF',
  textSecondary: '#B3B3B3',
  textMuted: '#858585',
} as const;

export const Colors = {
  light: {
    text: Monochrome.textPrimary,
    background: Monochrome.background,
    backgroundElement: Monochrome.surfaceSecondary,
    backgroundSelected: Monochrome.surfaceElevated,
    textSecondary: Monochrome.textSecondary,
    border: Monochrome.border,
  },
  dark: {
    text: DarkColors.textPrimary,
    background: DarkColors.background,
    backgroundElement: DarkColors.surfaceSecondary,
    backgroundSelected: DarkColors.surfaceElevated,
    textSecondary: DarkColors.textSecondary,
    border: DarkColors.border,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
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

export const Brand = {
  background: Monochrome.background,
  surfacePrimary: Monochrome.surfacePrimary,
  surfaceSecondary: Monochrome.surfaceSecondary,
  surfaceElevated: Monochrome.surfaceElevated,
  border: Monochrome.border,
  borderLight: Monochrome.borderLight,

  primary: Monochrome.actionPrimary,
  primaryText: Monochrome.actionPrimaryText,
  primaryDark: '#115E59',

  text: Monochrome.textPrimary,
  textSecondary: Monochrome.textSecondary,
  textMuted: Monochrome.textMuted,
  divider: Monochrome.border,
  inputBackground: Monochrome.surfaceSecondary,
  white: '#FFFFFF',
  black: '#000000',
  error: '#C2414B',

  card: Monochrome.cardSurface,
  cardElevated: Monochrome.surfaceElevated,

  teal: {
    primary: Monochrome.actionPrimary,
    primaryDark: '#115E59',
    light: '#E3F4EF',
    soft: '#E3F4EF',
    text: '#FFFFFF',
  },

  selection: {
    selectedBorder: Monochrome.actionPrimary,
    selectedBackground: Monochrome.surfaceElevated,
    unselectedBackground: Monochrome.surfaceSecondary,
  },
} as const;

export const SemanticColors = {
  success: '#16845B',
  warning: '#B7791F',
  error: '#C2414B',
  information: '#3478B8',
  gold: '#E9B96E',
} as const;
