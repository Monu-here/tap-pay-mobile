import React from 'react';
import {
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';

import { AppText } from '@/components/typography/app-text';
import { Palette, Spacing } from '@/constants/theme';
import { FontFamilies } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { OnboardingIllustration } from './OnboardingIllustration';
import type { OnboardingFeature, OnboardingScreenContent } from '../data';

export type OnboardingScreenProps = {
  content: OnboardingScreenContent;
  step: number;
  totalSteps: number;
  buttonLabel?: string;
  onButtonPress: () => void;
  onSkip?: () => void;
  onBack?: () => void;
  onSelectStep?: (index: number) => void;
};

const FEATURE_ICONS: Record<
  OnboardingFeature['icon'],
  { ios: SFSymbol; android: AndroidSymbol; web: AndroidSymbol }
> = {
  qrcode: { ios: 'qrcode', android: 'qr_code', web: 'qr_code' },
  bolt: { ios: 'bolt.fill', android: 'flash_on', web: 'flash_on' },
  location: { ios: 'location.fill', android: 'near_me', web: 'near_me' },
  card: { ios: 'creditcard.fill', android: 'credit_card', web: 'credit_card' },
  shield: { ios: 'checkmark.shield.fill', android: 'verified_user', web: 'verified_user' },
  lock: { ios: 'lock.fill', android: 'lock', web: 'lock' },
};

export function OnboardingScreen({
  content,
  step,
  totalSteps,
  buttonLabel,
  onButtonPress,
  onSkip,
  onBack,
  onSelectStep,
}: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const isFirstStep = step === 1;
  const isLastStep = step === totalSteps;

  // Horizontal swipe gesture responder
  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dy) < 30;
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx < -50) {
            // Swipe left -> Next
            onButtonPress();
          } else if (gestureState.dx > 50 && onBack && !isFirstStep) {
            // Swipe right -> Back
            onBack();
          }
        },
      }),
    [onButtonPress, onBack, isFirstStep],
  );

  const gradientColors: [string, string, string] = theme.isDark
    ? ['#00141F', '#002235', '#003049']
    : ['#FFFDF9', '#FAF3E7', '#FDF0D5'];

  return (
    <View style={styles.outerContainer} {...panResponder.panHandlers}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View
        style={[
          styles.container,
          {
            paddingTop: Math.max(insets.top, 16) + Spacing.two,
            paddingBottom: Math.max(insets.bottom, 16) + Spacing.two,
          },
        ]}
      >
        {/* Top Header Navigation */}
        <Animated.View
          entering={FadeInUp.duration(500).springify()}
          style={styles.header}
        >
          {/* Brand Logo & Tag */}
          <View style={styles.brandRow}>
            <Image
              source={require('@/assets/images/eyatra-logo.png')}
              style={styles.logoImage}
              contentFit="contain"
            />
            <View>
              <AppText
                style={[
                  styles.brandName,
                  { color: theme.isDark ? Palette.warmCream : Palette.prussianNavy },
                ]}
              >
                eYatra
              </AppText>
              <AppText
                style={[
                  styles.brandTagline,
                  { color: theme.isDark ? Palette.slateBlue : '#667085' },
                ]}
              >
                Nepal Transit Pay
              </AppText>
            </View>
          </View>

          {/* Step Pill & Skip Button */}
          <View style={styles.headerRight}>
            <View
              style={[
                styles.stepCounterBadge,
                {
                  backgroundColor: theme.isDark
                    ? 'rgba(253, 240, 213, 0.1)'
                    : 'rgba(0, 48, 73, 0.06)',
                  borderColor: theme.isDark
                    ? 'rgba(253, 240, 213, 0.18)'
                    : 'rgba(0, 48, 73, 0.12)',
                },
              ]}
            >
              <AppText
                style={[
                  styles.stepCounterText,
                  { color: theme.isDark ? Palette.warmCream : Palette.prussianNavy },
                ]}
              >
                0{step} <AppText style={styles.stepCounterMuted}>/ 0{totalSteps}</AppText>
              </AppText>
            </View>

            {onSkip && !isLastStep && (
              <Pressable
                onPress={onSkip}
                accessibilityRole="button"
                accessibilityLabel="Skip intro walkthrough"
                hitSlop={12}
                style={({ pressed }) => [
                  styles.skipButton,
                  {
                    backgroundColor: theme.isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(0, 0, 0, 0.04)',
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <AppText
                  style={[
                    styles.skipText,
                    { color: theme.isDark ? Palette.slateBlue : Palette.prussianNavy },
                  ]}
                >
                  Skip
                </AppText>
              </Pressable>
            )}
          </View>
        </Animated.View>

        {/* Scrollable Main Area for various device heights */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          bounces={false}
        >
          {/* Animated 3D Concept Illustration */}
          <OnboardingIllustration source={content.imageSource} step={step} />

          {/* Text and Features Information */}
          <View style={styles.textContainer}>
            {/* Concept Badge Pill */}
            <Animated.View
              key={`badge-${step}`}
              entering={FadeInDown.duration(400).delay(100).springify()}
              style={[
                styles.badgePill,
                {
                  backgroundColor: theme.isDark
                    ? 'rgba(193, 18, 31, 0.2)'
                    : 'rgba(193, 18, 31, 0.1)',
                  borderColor: Palette.crimsonRed,
                },
              ]}
            >
              <View style={styles.badgeIndicator} />
              <AppText style={styles.badgeText}>{content.badge}</AppText>
            </Animated.View>

            {/* Concept Headline */}
            <Animated.View
              key={`title-${step}`}
              entering={FadeInDown.duration(500).delay(200).springify()}
            >
              <AppText
                style={[
                  styles.title,
                  { color: theme.isDark ? Palette.warmCream : Palette.prussianNavy },
                ]}
              >
                {content.title}
              </AppText>
            </Animated.View>

            {/* Subtitle / Description */}
            <Animated.View
              key={`desc-${step}`}
              entering={FadeInDown.duration(500).delay(300).springify()}
            >
              <AppText
                style={[
                  styles.description,
                  { color: theme.isDark ? '#A3C2D7' : '#385A6F' },
                ]}
              >
                {content.description}
              </AppText>
            </Animated.View>

            {/* Concept Features List */}
            <Animated.View
              key={`features-${step}`}
              entering={FadeInDown.duration(550).delay(400).springify()}
              style={styles.featuresRow}
            >
              {content.features.map((feature, idx) => {
                const iconDef = FEATURE_ICONS[feature.icon] ?? FEATURE_ICONS.qrcode;
                return (
                  <View
                    key={idx}
                    style={[
                      styles.featureCard,
                      {
                        backgroundColor: theme.isDark
                          ? 'rgba(0, 34, 53, 0.8)'
                          : 'rgba(255, 255, 255, 0.85)',
                        borderColor: theme.isDark
                          ? 'rgba(21, 71, 102, 0.7)'
                          : 'rgba(229, 213, 186, 0.8)',
                      },
                    ]}
                  >
                    <View style={styles.featureIconBox}>
                      <SymbolView
                        name={iconDef}
                        size={18}
                        tintColor={Palette.crimsonRed}
                      />
                    </View>
                    <View style={styles.featureTextBox}>
                      <AppText
                        style={[
                          styles.featureTitle,
                          {
                            color: theme.isDark
                              ? Palette.warmCream
                              : Palette.prussianNavy,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {feature.title}
                      </AppText>
                      <AppText
                        style={[
                          styles.featureSubtitle,
                          { color: theme.isDark ? '#7E9DB5' : '#5E7487' },
                        ]}
                        numberOfLines={2}
                      >
                        {feature.subtitle}
                      </AppText>
                    </View>
                  </View>
                );
              })}
            </Animated.View>
          </View>
        </ScrollView>

        {/* Bottom Interactive Navigation Footer */}
        <Animated.View
          entering={FadeInDown.duration(500).delay(350).springify()}
          style={styles.footer}
        >
          {/* Animated Pagination Dots */}
          <View style={styles.paginationRow}>
            {Array.from({ length: totalSteps }, (_, idx) => {
              const active = idx === step - 1;
              return (
                <Pressable
                  key={idx}
                  onPress={() => onSelectStep?.(idx + 1)}
                  style={styles.dotTouchArea}
                  hitSlop={8}
                >
                  <View
                    style={[
                      styles.dot,
                      active
                        ? styles.activeDot
                        : [
                            styles.inactiveDot,
                            {
                              backgroundColor: theme.isDark
                                ? 'rgba(102, 155, 188, 0.35)'
                                : 'rgba(0, 48, 73, 0.2)',
                            },
                          ],
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>

          {/* Action Buttons Row */}
          <View style={styles.actionRow}>
            {!isFirstStep && (
              <Pressable
                onPress={onBack}
                accessibilityRole="button"
                accessibilityLabel="Go to previous screen"
                hitSlop={8}
                style={({ pressed }) => [
                  styles.backRoundButton,
                  {
                    backgroundColor: theme.isDark
                      ? 'rgba(0, 34, 53, 0.9)'
                      : 'rgba(255, 255, 255, 0.95)',
                    borderColor: theme.isDark
                      ? 'rgba(21, 71, 102, 0.9)'
                      : 'rgba(229, 213, 186, 0.9)',
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <SymbolView
                  name={{
                    ios: 'arrow.left',
                    android: 'arrow_back',
                    web: 'arrow_back',
                  }}
                  size={20}
                  tintColor={theme.isDark ? Palette.warmCream : Palette.prussianNavy}
                />
              </Pressable>
            )}

            {/* Primary Action Button */}
            <View style={{ flex: 1 }}>
              <Pressable
                onPress={onButtonPress}
                accessibilityRole="button"
                accessibilityLabel={buttonLabel ?? (isLastStep ? 'Get Started' : 'Next Step')}
                style={({ pressed }) => [
                  styles.primaryActionButton,
                  { transform: [{ scale: pressed ? 0.96 : 1 }] },
                ]}
              >
                <LinearGradient
                  colors={[Palette.crimsonRed, Palette.deepMaroon]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryActionGradient}
                >
                  <AppText style={styles.primaryActionText}>
                    {buttonLabel ?? (isLastStep ? 'Get Started with eYatra' : 'Next Step')}
                  </AppText>
                  <View style={styles.buttonIconCircle}>
                    <SymbolView
                      name={{
                        ios: isLastStep ? 'checkmark' : 'arrow.right',
                        android: isLastStep ? 'check' : 'arrow_forward',
                        web: isLastStep ? 'check' : 'arrow_forward',
                      }}
                      size={16}
                      tintColor={Palette.white}
                    />
                  </View>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    marginBottom: 4,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoImage: {
    width: 38,
    height: 38,
    borderRadius: 10,
  },
  brandName: {
    fontFamily: FontFamilies.extraBold,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  brandTagline: {
    fontFamily: FontFamilies.medium,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepCounterBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  stepCounterText: {
    fontFamily: FontFamilies.bold,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  stepCounterMuted: {
    fontFamily: FontFamilies.regular,
    opacity: 0.6,
  },
  skipButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  skipText: {
    fontFamily: FontFamilies.semiBold,
    fontSize: 13,
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  textContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginTop: 4,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    marginBottom: 10,
  },
  badgeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Palette.crimsonRed,
  },
  badgeText: {
    fontFamily: FontFamilies.bold,
    fontSize: 11,
    color: Palette.crimsonRed,
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: FontFamilies.extraBold,
    fontSize: 26,
    lineHeight: 33,
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  description: {
    fontFamily: FontFamilies.regular,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 330,
    marginBottom: 18,
  },
  featuresRow: {
    width: '100%',
    gap: 8,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    shadowColor: Palette.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  featureIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(193, 18, 31, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTextBox: {
    flex: 1,
  },
  featureTitle: {
    fontFamily: FontFamilies.bold,
    fontSize: 13,
    lineHeight: 17,
  },
  featureSubtitle: {
    fontFamily: FontFamilies.regular,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 1,
  },
  footer: {
    width: '100%',
    gap: 16,
    paddingTop: 8,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dotTouchArea: {
    padding: 4,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  activeDot: {
    width: 28,
    backgroundColor: Palette.crimsonRed,
    shadowColor: Palette.crimsonRed,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
  inactiveDot: {
    width: 7,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backRoundButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Palette.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryActionButton: {
    height: 54,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: Palette.crimsonRed,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryActionGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 10,
  },
  primaryActionText: {
    fontFamily: FontFamilies.bold,
    fontSize: 16,
    color: Palette.white,
    letterSpacing: -0.2,
  },
  buttonIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
