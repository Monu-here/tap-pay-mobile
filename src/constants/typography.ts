import { StyleSheet, type TextStyle } from 'react-native';

export const FontFamilies = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',
  regularItalic: 'PlusJakartaSans_400Regular_Italic',
  mediumItalic: 'PlusJakartaSans_500Medium_Italic',
  semiBoldItalic: 'PlusJakartaSans_600SemiBold_Italic',
  boldItalic: 'PlusJakartaSans_700Bold_Italic',
  extraBoldItalic: 'PlusJakartaSans_800ExtraBold_Italic',
} as const;

/**
 * Standard Typography Hierarchy:
 * - Main headings: 800 (ExtraBold)
 * - Page titles:   700 (Bold)
 * - Buttons:       700 (Bold)
 * - Subheadings:   600 (SemiBold)
 * - Body text:     400 (Regular)
 * - Small labels:  500 (Medium)
 */
export const Typography = StyleSheet.create({
  // Main Headings -> 800 (ExtraBold)
  display: { fontFamily: FontFamilies.extraBold, fontSize: 34, lineHeight: 42 } as TextStyle,
  mainHeading: { fontFamily: FontFamilies.extraBold, fontSize: 30, lineHeight: 38 } as TextStyle,

  // Page Titles -> 700 (Bold)
  screenTitle: { fontFamily: FontFamilies.bold, fontSize: 28, lineHeight: 36 } as TextStyle,
  pageTitle: { fontFamily: FontFamilies.bold, fontSize: 24, lineHeight: 32 } as TextStyle,
  walletAmount: { fontFamily: FontFamilies.bold, fontSize: 30, lineHeight: 38 } as TextStyle,

  // Buttons -> 700 (Bold)
  button: { fontFamily: FontFamilies.bold, fontSize: 16 } as TextStyle,

  // Subheadings -> 600 (SemiBold)
  sectionTitle: { fontFamily: FontFamilies.semiBold, fontSize: 20, lineHeight: 28 } as TextStyle,
  subheading: { fontFamily: FontFamilies.semiBold, fontSize: 18, lineHeight: 26 } as TextStyle,

  // Body Text -> 400 (Regular)
  body: { fontFamily: FontFamilies.regular, fontSize: 16, lineHeight: 24 } as TextStyle,
  bodySmall: { fontFamily: FontFamilies.regular, fontSize: 14, lineHeight: 20 } as TextStyle,
  secondary: { fontFamily: FontFamilies.regular, fontSize: 14, lineHeight: 20 } as TextStyle,
  inputValue: { fontFamily: FontFamilies.regular, fontSize: 16 } as TextStyle,

  // Small Labels -> 500 (Medium)
  smallLabel: { fontFamily: FontFamilies.medium, fontSize: 12, lineHeight: 16 } as TextStyle,
  inputLabel: { fontFamily: FontFamilies.medium, fontSize: 14, lineHeight: 18 } as TextStyle,
  navigationLabel: { fontFamily: FontFamilies.medium, fontSize: 12, lineHeight: 16 } as TextStyle,
  badge: { fontFamily: FontFamilies.medium, fontSize: 11, lineHeight: 14 } as TextStyle,
  transactionStatus: { fontFamily: FontFamilies.medium, fontSize: 12 } as TextStyle,
  error: { fontFamily: FontFamilies.medium, fontSize: 13, lineHeight: 19 } as TextStyle,

  // Supporting emphasis
  italicDescription: {
    fontFamily: FontFamilies.regularItalic,
    fontSize: 14,
    lineHeight: 20,
  } as TextStyle,
  promotional: {
    fontFamily: FontFamilies.boldItalic,
    fontSize: 22,
    lineHeight: 30,
  } as TextStyle,
});

export type FontWeight = 'regular' | 'medium' | 'semiBold' | 'bold' | 'extraBold';

export function normalizeWeight(weight: TextStyle['fontWeight']): FontWeight {
  if (
    weight === '800' ||
    weight === 800 ||
    weight === '900' ||
    weight === 900 ||
    weight === 'heavy' ||
    weight === 'black'
  ) {
    return 'extraBold';
  }
  if (weight === 'bold' || weight === '700' || weight === 700) {
    return 'bold';
  }
  if (weight === '600' || weight === 600) return 'semiBold';
  if (weight === '500' || weight === 500) return 'medium';
  return 'regular';
}

export function getFontFamily(
  weight: TextStyle['fontWeight'] = '400',
  italic = false,
): string {
  const normalizedWeight = normalizeWeight(weight);

  if (italic) {
    if (normalizedWeight === 'regular') return FontFamilies.regularItalic;
    if (normalizedWeight === 'medium') return FontFamilies.mediumItalic;
    if (normalizedWeight === 'semiBold') return FontFamilies.semiBoldItalic;
    if (normalizedWeight === 'bold') return FontFamilies.boldItalic;
    return FontFamilies.extraBoldItalic;
  }

  return FontFamilies[normalizedWeight];
}
