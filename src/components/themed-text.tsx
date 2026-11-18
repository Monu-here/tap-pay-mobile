import { AppText } from '@/components/typography/app-text';
import { StyleSheet, type TextProps } from 'react-native';

import { Monochrome, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <AppText
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  // Small labels: 500 (Medium)
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  // Body text: 400 (Regular)
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  // Main headings: 800 (ExtraBold)
  title: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 40,
  },
  // Subheadings: 600 (SemiBold)
  subtitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
  },
  link: {
    lineHeight: 24,
    fontSize: 14,
    fontWeight: '600',
  },
  linkPrimary: {
    lineHeight: 24,
    fontSize: 14,
    fontWeight: '600',
    color: Monochrome.actionPrimary,
  },
  code: {
    fontWeight: '500',
    fontSize: 12,
  },
});
