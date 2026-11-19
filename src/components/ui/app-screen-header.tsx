import { AppText } from '@/components/typography/app-text';
import { AppBackButton, type AppBackButtonProps } from '@/components/ui/app-back-button';
import { IconSizes, Radius, ScreenLayout, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Pressable,
  StyleSheet,
  View,
  type ReactNode,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export type AppScreenHeaderProps = {
  title: string;
  subtitle?: string;
  backButton?: AppBackButtonProps;
  rightAction?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function AppScreenHeader({
  title,
  subtitle,
  backButton,
  rightAction,
  style,
}: AppScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + Spacing.two,
          backgroundColor: theme.background,
          borderBottomColor: theme.border,
        },
        style,
      ]}
    >
      <AppBackButton {...backButton} />
      <View style={styles.titleContainer}>
        <AppText style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {rightAction ?? <View style={styles.actionSpacer} />}
    </View>
  );
}

export type AppHeaderIconButtonProps = {
  accessibilityLabel: string;
  icon: { ios: SFSymbol; android: AndroidSymbol; web: AndroidSymbol };
  onPress: () => void;
};

export function AppHeaderIconButton({
  accessibilityLabel,
  icon,
  onPress,
}: AppHeaderIconButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: theme.surfacePrimary, borderColor: theme.border },
        pressed && styles.pressed,
      ]}
      hitSlop={6}
    >
      <SymbolView
        name={icon}
        size={IconSizes.medium}
        tintColor={theme.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: ScreenLayout.headerMinHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: ScreenLayout.horizontalPadding,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleContainer: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionSpacer: {
    width: 44,
    height: 44,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.medium,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
});
