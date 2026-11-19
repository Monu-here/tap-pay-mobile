import { useEffect } from 'react';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  FadeInDown,
} from 'react-native-reanimated';
import { Palette } from '@/constants/theme';

export type OnboardingIllustrationProps = {
  source: ImageSourcePropType;
  step: number;
};

export function OnboardingIllustration({ source, step }: OnboardingIllustrationProps) {
  // Smooth breathing / float animation for the hero card
  const translateY = useSharedValue(0);
  const glowScale = useSharedValue(1);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
        withTiming(4, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );

    glowScale.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.96, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, [step, translateY, glowScale]);

  const animatedHeroStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const animatedGlowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
  }));

  return (
    <View style={styles.wrapper}>
      {/* Ambient Pulsing Glow Circle */}
      <Animated.View style={[styles.glowRing, animatedGlowStyle]} />
      <Animated.View style={[styles.glowInnerRing, animatedGlowStyle]} />

      {/* Hero Animated Container */}
      <Animated.View
        key={`step-hero-${step}`}
        entering={FadeInDown.duration(600).springify().damping(16)}
        style={[styles.heroContainer, animatedHeroStyle]}
      >
        <Image
          source={source}
          style={styles.heroImage}
          contentFit="cover"
          transition={400}
        />
        <View style={styles.imageOverlayBorder} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    position: 'relative',
  },
  glowRing: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(193, 18, 31, 0.08)',
  },
  glowInnerRing: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(0, 48, 73, 0.05)',
  },
  heroContainer: {
    width: 260,
    height: 260,
    borderRadius: 36,
    overflow: 'hidden',
    backgroundColor: Palette.white,
    shadowColor: Palette.prussianNavy,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 12,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlayBorder: {
    ...StyleSheet.absoluteFill,
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.65)',
  },
});
