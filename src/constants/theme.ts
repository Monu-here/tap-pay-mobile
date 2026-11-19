import '@/global.css';

import { Platform } from 'react-native';

/**
 * 5-Color Brand Palette extracted from the design pattern:
 * - Deep Maroon:   #780000
 * - Crimson Red:   #C1121F
 * - Warm Cream:    #FDF0D5
 * - Prussian Navy: #003049
 * - Slate Blue:    #669BBC
 */
export const Palette = {
  deepMaroon: '#780000',
  crimsonRed: '#C1121F',
  warmCream: '#FDF0D5',
  prussianNavy: '#003049',
  slateBlue: '#669BBC',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const LightColors = {
  background: Palette.warmCream,
  surfacePrimary: '#FFFFFF',
  surfaceSecondary: '#FAF4EB',
  surfaceElevated: '#F5E5C9',
  border: '#E5D5BA',
  borderLight: '#F0E5D0',
  textPrimary: Palette.prussianNavy,
  textSecondary: '#385A6F',
  textMuted: Palette.slateBlue,
  actionPrimary: Palette.crimsonRed,
  actionPrimaryText: '#FFFFFF',
  actionSecondary: Palette.warmCream,
  actionSecondaryText: Palette.deepMaroon,
  cardSurface: '#FFFFFF',
  cardVirtual: Palette.prussianNavy,
  badgeBackground: '#F5E5C9',
  badgeText: Palette.deepMaroon,
} as const;

export const DarkColors = {
  background: '#001824',
  surfacePrimary: '#002235',
  surfaceSecondary: Palette.prussianNavy,
  surfaceElevated: '#0A3F5E',
  border: '#154766',
  borderLight: '#1E577A',
  textPrimary: Palette.warmCream,
  textSecondary: '#A3C2D7',
  textMuted: Palette.slateBlue,
  actionPrimary: Palette.crimsonRed,
  actionPrimaryText: '#FFFFFF',
  actionSecondary: Palette.prussianNavy,
  actionSecondaryText: Palette.slateBlue,
  cardSurface: '#002235',
  cardVirtual: Palette.deepMaroon,
  badgeBackground: '#1F384C',
  badgeText: Palette.warmCream,
} as const;

export const Monochrome = LightColors;

export const DriverColors = LightColors;

export const Colors = {
  light: {
    ...LightColors,
    text: LightColors.textPrimary,
    background: LightColors.background,
    backgroundElement: LightColors.surfaceSecondary,
    backgroundSelected: LightColors.surfaceElevated,
    textSecondary: LightColors.textSecondary,
    border: LightColors.border,
    primary: Palette.crimsonRed,
    primaryDark: Palette.deepMaroon,
    accent: Palette.slateBlue,
    navy: Palette.prussianNavy,
    cream: Palette.warmCream,
    card: LightColors.cardSurface,
    error: Palette.crimsonRed,
  },
  dark: {
    ...DarkColors,
    text: DarkColors.textPrimary,
    background: DarkColors.background,
    backgroundElement: DarkColors.surfaceSecondary,
    backgroundSelected: DarkColors.surfaceElevated,
    textSecondary: DarkColors.textSecondary,
    border: DarkColors.border,
    primary: Palette.crimsonRed,
    primaryDark: Palette.deepMaroon,
    accent: Palette.slateBlue,
    navy: Palette.prussianNavy,
    cream: Palette.warmCream,
    card: DarkColors.cardSurface,
    error: Palette.crimsonRed,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light;

export function getThemeTokens(scheme: 'light' | 'dark') {
  return Colors[scheme];
}

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

export const Radius = {
  small: 8,
  medium: 12,
  card: 16,
  large: 20,
  pill: 999,
} as const;

export const IconSizes = {
  small: 16,
  medium: 20,
  large: 24,
} as const;

export const ScreenLayout = {
  horizontalPadding: Spacing.four,
  headerMinHeight: 56,
  contentMaxWidth: 800,
} as const;

export const Shadows = {
  card: {
    shadowColor: Palette.prussianNavy,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
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

  primary: Palette.crimsonRed,
  primaryText: '#FFFFFF',
  primaryDark: Palette.deepMaroon,
  accent: Palette.slateBlue,
  navy: Palette.prussianNavy,
  cream: Palette.warmCream,

  text: Monochrome.textPrimary,
  textSecondary: Monochrome.textSecondary,
  textMuted: Monochrome.textMuted,
  divider: Monochrome.border,
  inputBackground: Monochrome.surfaceSecondary,
  white: '#FFFFFF',
  black: '#000000',
  error: Palette.crimsonRed,

  card: Monochrome.cardSurface,
  cardElevated: Monochrome.surfaceElevated,
  cardVirtual: Monochrome.cardVirtual,

  teal: {
    primary: Palette.crimsonRed,
    primaryDark: Palette.deepMaroon,
    light: Palette.warmCream,
    soft: Palette.warmCream,
    text: Palette.deepMaroon,
  },

  selection: {
    selectedBorder: Palette.crimsonRed,
    selectedBackground: Monochrome.surfaceElevated,
    unselectedBackground: Monochrome.surfaceSecondary,
  },
} as const;

export const SemanticColors = {
  success: '#1B8A5A',
  warning: '#C27803',
  error: Palette.crimsonRed,
  information: Palette.slateBlue,
  gold: '#E9B96E',
} as const;
