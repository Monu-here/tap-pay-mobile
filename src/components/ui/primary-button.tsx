import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Brand } from '@/constants/theme';

export type PrimaryButtonProps = Omit<PressableProps, 'style'> & {
  label?: string;
  title?: string;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({ label, title, style, ...rest }: PrimaryButtonProps) {
  const text = label ?? title ?? '';
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}
      {...rest}
    >
      <Text style={styles.label}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: Brand.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    color: Brand.white,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
