import { AppText } from '@/components/typography/app-text';
import { SymbolView } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/primary-button';
import { PaginationDots } from '@/components/ui/pagination-dots';
import { Brand, Spacing } from '@/constants/theme';
import { Typography } from '@/constants/typography';

import {
  OnboardingIllustration,
  type OnboardingIllustrationName,
} from './OnboardingIllustration';

export type OnboardingScreenProps = {
  illustration: OnboardingIllustrationName;
  title: string;
  description: string;
  step: number;
  totalSteps: number;
  buttonLabel: string;
  onButtonPress: () => void;
  onSkip?: () => void;
  onBack?: () => void;
};

export function OnboardingScreen({
  illustration,
  title,
  description,
  step,
  totalSteps,
  buttonLabel,
  onButtonPress,
  onSkip,
  onBack,
}: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const isFirstStep = step === 1;

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + Spacing.two,
          paddingBottom: insets.bottom + Spacing.three,
        },
      ]}
    >
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View style={styles.headerSide}>
          {!isFirstStep && (
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={12}
              style={styles.backButton}
            >
              <SymbolView
                name={{
                  ios: 'chevron.backward',
                  android: 'arrow_back',
                  web: 'arrow_back',
                }}
                size={22}
                tintColor={Brand.text}
              />
            </Pressable>
          )}
        </View>

        <View style={[styles.headerSide, styles.headerSideRight]}>
          {onSkip && (
            <Pressable
              onPress={onSkip}
              accessibilityRole="button"
              hitSlop={12}
              style={styles.skipButton}
            >
              <AppText style={styles.skipText}>Skip</AppText>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.content}>
        <OnboardingIllustration name={illustration} />
        <AppText style={[styles.title, Typography.decorativeCursive]}>{title}</AppText>
        <AppText style={[Typography.italicDescription, styles.description]}>{description}</AppText>
      </View>

      <View style={styles.footer}>
        <PaginationDots total={totalSteps} activeIndex={step - 1} />
        <PrimaryButton label={buttonLabel} onPress={onButtonPress} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Brand.white,
    paddingHorizontal: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  headerSide: {
    minWidth: 44,
    height: 44,
    justifyContent: 'center',
  },
  headerSideRight: {
    alignItems: 'flex-end',
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButton: {
    height: 44,
    paddingHorizontal: Spacing.two,
    justifyContent: 'center',
  },
  skipText: {
    color: Brand.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.two,
  },
  title: {
    color: Brand.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  description: {
    color: Brand.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 320,
  },
  footer: {
    gap: Spacing.three,
  },
});
