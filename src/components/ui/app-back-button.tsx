import { router, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { IconSizes, Radius, Shadows } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type AppBackButtonProps = {
  accessibilityLabel?: string;
  fallbackHref?: Href;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function AppBackButton({
  accessibilityLabel = 'Go back',
  fallbackHref = '/(tabs)/home',
  onPress,
  disabled = false,
  style,
}: AppBackButtonProps) {
  const theme = useTheme();
  const handlePress = () => {
    Keyboard.dismiss();
    if (onPress) {
      onPress();
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace(fallbackHref);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        style,
        {
          backgroundColor: theme.surfacePrimary,
          borderColor: theme.border,
        },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
      hitSlop={6}
    >
      <SymbolView
        name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
        size={IconSizes.medium}
        tintColor={theme.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: Radius.medium,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.5,
  },
});
