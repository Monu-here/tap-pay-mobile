import { StyleSheet, type TextStyle } from 'react-native';

export const FontFamilies = {
  regular: 'NunitoSans_400Regular',
  medium: 'NunitoSans_500Medium',
  semiBold: 'NunitoSans_600SemiBold',
  bold: 'NunitoSans_700Bold',
  regularItalic: 'NunitoSans_400Regular_Italic',
  mediumItalic: 'NunitoSans_500Medium_Italic',
  semiBoldItalic: 'NunitoSans_600SemiBold_Italic',
  boldItalic: 'NunitoSans_700Bold_Italic',
  devanagari: {
    regular: 'NotoSansDevanagari_400Regular',
    medium: 'NotoSansDevanagari_500Medium',
    semiBold: 'NotoSansDevanagari_600SemiBold',
    bold: 'NotoSansDevanagari_700Bold',
  },
  cursive: 'Caveat_400Regular',
} as const;

export const Typography = StyleSheet.create({
  display: { fontFamily: FontFamilies.bold, fontSize: 34, lineHeight: 42 } as TextStyle,
  screenTitle: { fontFamily: FontFamilies.bold, fontSize: 28, lineHeight: 36 } as TextStyle,
  sectionTitle: { fontFamily: FontFamilies.semiBold, fontSize: 20, lineHeight: 28 } as TextStyle,
  body: { fontFamily: FontFamilies.regular, fontSize: 16, lineHeight: 24 } as TextStyle,
  secondary: { fontFamily: FontFamilies.regular, fontSize: 14, lineHeight: 20 } as TextStyle,
  italicDescription: {
    fontFamily: FontFamilies.regularItalic,
    fontSize: 14,
    lineHeight: 20,
  } as TextStyle,
  decorativeCursive: {
    fontFamily: FontFamilies.cursive,
    fontSize: 30,
    lineHeight: 38,
  } as TextStyle,
  button: { fontFamily: FontFamilies.semiBold, fontSize: 16 } as TextStyle,
  inputLabel: { fontFamily: FontFamilies.medium, fontSize: 14 } as TextStyle,
  inputValue: { fontFamily: FontFamilies.regular, fontSize: 16 } as TextStyle,
  navigationLabel: { fontFamily: FontFamilies.semiBold, fontSize: 12 } as TextStyle,
  walletAmount: { fontFamily: FontFamilies.bold, fontSize: 30, lineHeight: 38 } as TextStyle,
  transactionStatus: { fontFamily: FontFamilies.semiBold, fontSize: 12 } as TextStyle,
  error: { fontFamily: FontFamilies.medium, fontSize: 13, lineHeight: 19 } as TextStyle,
  promotional: {
    fontFamily: FontFamilies.boldItalic,
    fontSize: 22,
    lineHeight: 30,
  } as TextStyle,
});

type FontWeight = 'regular' | 'medium' | 'semiBold' | 'bold';

function normalizeWeight(weight: TextStyle['fontWeight']): FontWeight {
  if (weight === 'bold' || weight === '700' || weight === 700 || weight === '800' || weight === 800 || weight === '900' || weight === 900) {
    return 'bold';
  }
  if (weight === '600' || weight === 600) return 'semiBold';
  if (weight === '500' || weight === 500) return 'medium';
  return 'regular';
}

export function getFontFamily(
  weight: TextStyle['fontWeight'] = '400',
  italic = false,
  devanagari = false,
): string {
  const normalizedWeight = normalizeWeight(weight);
  if (devanagari) return FontFamilies.devanagari[normalizedWeight];

  if (italic) {
    if (normalizedWeight === 'regular') return FontFamilies.regularItalic;
    if (normalizedWeight === 'medium') return FontFamilies.mediumItalic;
    if (normalizedWeight === 'semiBold') return FontFamilies.semiBoldItalic;
    return FontFamilies.boldItalic;
  }

  return FontFamilies[normalizedWeight];
}
