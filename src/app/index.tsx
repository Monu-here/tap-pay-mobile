import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';

import { AppText } from '@/components/typography/app-text';
import { Palette, Spacing } from '@/constants/theme';
import { FontFamilies } from '@/constants/typography';
import { getMe } from '@/features/auth/services/auth';
import {
  clearSession,
  getRoleDashboardPath,
  getSession,
  getUserRole,
  hasCompletedOnboarding,
  isSessionValid,
  restoreSession,
  setPendingAuthMessage,
  setSession,
} from '@/features/auth/session';

export default function Index() {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let active = true;

    const routeUnauthenticated = async () => {
      const seenOnboarding = await hasCompletedOnboarding();
      if (!active) return;
      if (!seenOnboarding) {
        router.replace('/onboarding/screen-1');
      } else {
        router.replace('/login');
      }
    };

    void (async () => {
      try {
        await restoreSession();
      } catch {
        if (!active) return;
        setPendingAuthMessage('Unable to restore your secure session. Please sign in again.');
        await routeUnauthenticated();
        return;
      }
      if (!active) return;

      // No token, or an expired one -> onboarding or login
      const { token } = getSession();
      if (!token || !isSessionValid()) {
        try {
          await clearSession();
        } catch {
          setPendingAuthMessage('Could not clear the expired secure session. Please sign in again.');
        }
        await routeUnauthenticated();
        return;
      }

      try {
        const result = await getMe();
        if (!active) return;

        if (result.ok) {
          await setSession({ user: result.data });
          const needsVerification =
            result.data.email_verified === false || result.data.phone_verified === false;
          const target = getRoleDashboardPath(getUserRole(result.data));
          router.replace(needsVerification ? '/register/verification' : (target as any));
          return;
        }
        if (result.status === 401) {
          await routeUnauthenticated();
          return;
        }
        // Token stays stored; route according to stored role.
        const target = getRoleDashboardPath(getUserRole(getSession().user));
        router.replace(target as any);
      } catch {
        if (!active) return;
        try {
          await clearSession();
        } catch {
          setPendingAuthMessage('Unable to clear the secure session. Please sign in again.');
        }
        await routeUnauthenticated();
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.logoCard}>
        <Image
          source={require('@/assets/images/eyatra-logo.png')}
          style={styles.logo}
          contentFit="contain"
        />
      </View>
      <View style={styles.textGroup}>
        <AppText style={styles.brand}>eYatra</AppText>
        <AppText style={styles.tagline}>Smart Transit &amp; Bus Pay</AppText>
      </View>
      <ActivityIndicator size="small" color={Palette.crimsonRed} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.prussianNavy,
    gap: Spacing.three,
  },
  logoCard: {
    width: 90,
    height: 90,
    borderRadius: 24,
    backgroundColor: Palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Palette.black,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  logo: {
    width: 76,
    height: 76,
  },
  textGroup: {
    alignItems: 'center',
    gap: 4,
  },
  brand: {
    color: Palette.warmCream,
    fontFamily: FontFamilies.extraBold,
    fontSize: 26,
    letterSpacing: -0.5,
  },
  tagline: {
    color: Palette.slateBlue,
    fontFamily: FontFamilies.medium,
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  spinner: {
    marginTop: 8,
  },
});
