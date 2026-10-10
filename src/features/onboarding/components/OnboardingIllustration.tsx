import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { Brand } from '@/constants/theme';

export type OnboardingIllustrationName = 'pay' | 'ride' | 'security';

const ICONS: Record<
  OnboardingIllustrationName,
  { ios: SFSymbol; android: AndroidSymbol; web: AndroidSymbol }
> = {
  pay: { ios: 'creditcard.fill', android: 'credit_card', web: 'credit_card' },
  ride: {
    ios: 'bus.fill',
    android: 'directions_bus',
    web: 'directions_bus',
  },
  security: {
    ios: 'checkmark.seal.fill',
    android: 'verified_user',
    web: 'verified_user',
  },
};

/**
 * Temporary placeholder illustration.
 * TODO: replace with the supplied onboarding artwork
 * (e.g. <Image source={require('@/assets/images/onboarding-1.png')} />).
 */
export function OnboardingIllustration({
  name,
}: {
  name: OnboardingIllustrationName;
}) {
  const icon = ICONS[name];

  return (
    <View style={styles.container}>
      <View style={[styles.circle, styles.circleLarge]} />
      <View style={[styles.circle, styles.circleSmall]} />
      <View style={styles.tile}>
        <SymbolView name={icon} size={76} tintColor={Brand.white} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#E8F4FE',
  },
  circleLarge: {
    width: 240,
    height: 240,
  },
  circleSmall: {
    width: 180,
    height: 180,
    backgroundColor: '#D6EBFD',
  },
  tile: {
    width: 128,
    height: 128,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.primary,
    experimental_backgroundImage: `linear-gradient(160deg, ${Brand.gradientStart}, ${Brand.gradientEnd})`,
  },
});
