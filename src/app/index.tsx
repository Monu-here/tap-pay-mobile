/**
 * App entry / session restore.
 *
 * On launch: no token (or an expired one) -> login. A token present ->
 * confirmed with `GET /auth/me` (which refreshes the stored user), then routed
 * by verification state. A 401 clears the session and goes to login; any other
 * validation failure falls back to the home screen with the stored token.
 */

import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Brand, Spacing } from '@/constants/theme';

import { getMe } from '@/features/auth/services/auth';
import {
  clearSession,
  getRoleDashboardPath,
  getSession,
  getUserRole,
  isSessionValid,
  restoreSession,
  setPendingAuthMessage,
  setSession,
} from '@/features/auth/session';

export default function Index() {
  // Guards against React 18/19 StrictMode double-invocation in dev.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let active = true;

    void (async () => {
      try {
        await restoreSession();
      } catch {
        if (!active) return;
        setPendingAuthMessage('Unable to restore your secure session. Please sign in again.');
        router.replace('/login');
        return;
      }
      if (!active) return;

      // No token, or an expired one -> login.
      const { token } = getSession();
      if (!token || !isSessionValid()) {
        try {
          await clearSession();
        } catch {
          setPendingAuthMessage('Could not clear the expired secure session. Please sign in again.');
        }
        router.replace('/login');
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
          // The client also clears + redirects on 401; this is a safety net.
          router.replace('/login');
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
        router.replace('/login');
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Brand.teal.primary} />
      <Text style={styles.brand}>Tap &amp; Pay</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    backgroundColor: Brand.white,
  },
  brand: {
    color: Brand.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
