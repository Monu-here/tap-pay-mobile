import { AppText } from '@/components/typography/app-text';
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import type { ReactNode } from 'react';

import { Monochrome } from '@/constants/theme';

export type PrimaryButtonProps = Omit<PressableProps, 'style'> & {
  label?: string;
  title?: string;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  leadingIcon?: ReactNode;
};

export function PrimaryButton({
  label,
  title,
  style,
  labelStyle,
  leadingIcon,
  disabled = false,
  ...rest
}: PrimaryButtonProps) {
  const text = label ?? title ?? '';
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        style,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressed,
      ]}
      disabled={disabled}
      {...rest}
    >
      {leadingIcon}
      <AppText style={[styles.label, labelStyle, disabled && styles.disabledLabel]}>{text}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: Monochrome.actionPrimary,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  disabledButton: {
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  pressed: {
    opacity: 0.88,
  },
  label: {
    color: Monochrome.actionPrimaryText,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  disabledLabel: {
    color: Monochrome.textMuted,
  },
});
