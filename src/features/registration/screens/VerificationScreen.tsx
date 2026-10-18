/**
 * Screen — Email + phone OTP verification.
 *
 * One card per channel, showing verified/pending status and, when pending, a
 * 6-digit auto-submitting OTP input with a Send/Resend button on a cooldown.
 * Each successful verify refreshes the stored user (`GET /auth/me`); once both
 * channels are verified the user is sent into the app. `REQUIRE_VERIFICATION`
 * toggles a "Skip for now" escape hatch and how the Android back button behaves.
 */

import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/primary-button';
import { Brand, Spacing } from '@/constants/theme';

import { getCurrentUser } from '../../auth/services/verification';
import {
  getRoleDashboardPath,
  getSession,
  getUserRole,
  setSession,
} from '../../auth/session';
import { useSession } from '../../auth/useSession';
import { OtpCodeInput, type OtpCodeInputHandle } from '../components/OtpCodeInput';
import {
  REQUIRE_VERIFICATION,
  VERIFICATION_CODE_LENGTH,
  VERIFICATION_DEV_CODE_FOR_DISPLAY,
} from '../config/verification';
import { useVerification, type VerificationChannelState } from '../hooks/useVerification';
import { t, verification as V } from '@/constants/strings';

function messageForError(
  error: { key: string; message?: string; params?: Record<string, string | number> } | null,
): string | null {
  if (!error) return null;
  if (error.message) return error.message;
  switch (error.key) {
    case 'incomplete':
      return t(V.error.incomplete, { length: error.params?.length ?? VERIFICATION_CODE_LENGTH });
    case 'invalid':
    case 'invalidOrExpired':
      return 'Incorrect verification code. Please try again.';
    case 'expired':
      return 'Your verification code has expired. Request a new code.';
    case 'tooManyAttempts':
      return 'Too many incorrect attempts. Request a new code to continue.';
    case 'mailSendFailed':
    case 'deliveryFailed':
      return 'Unable to deliver the verification code. Please try again later.';
    case 'rateLimited':
      return t(V.error.rateLimited, { seconds: error.params?.seconds ?? 60 });
    case 'network':
    case 'timeout':
      return 'Unable to connect to the server. Check your connection.';
    case 'unauthorized':
      return V.error.sessionExpired;
    default:
      return V.error.server;
  }
}

type ChannelCardProps = {
  channel: 'email' | 'phone';
  state: VerificationChannelState;
  title: string;
  destination: string;
  inputRef: RefObject<OtpCodeInputHandle | null>;
};

function ChannelCard({ channel, state, title, destination, inputRef }: ChannelCardProps) {
  const errorMessage = messageForError(state.error);

  const resendLabel =
    state.secondsLeft > 0
      ? t(V.resendIn, { seconds: state.secondsLeft })
      : state.codeSent
        ? V.resendCode
        : V.sendCode;

  const sentSuccessHint =
    channel === 'email'
      ? 'Verification code sent. Check your inbox and spam folder.'
      : 'Verification code sent. Check your SMS messages.';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardDestination} numberOfLines={1}>
            {destination}
          </Text>
        </View>
        <View style={[styles.badge, state.isVerified ? styles.badgeVerified : styles.badgePending]}>
          <Text
            style={[
              styles.badgeText,
              state.isVerified ? styles.badgeTextVerified : styles.badgeTextPending,
            ]}
          >
            {state.isVerified ? V.verifiedBadge : V.pendingBadge}
          </Text>
        </View>
      </View>

      {state.isVerified ? (
        <View style={styles.verifiedRow}>
          <View style={styles.verifiedDot}>
            <Text style={styles.verifiedDotText}>✓</Text>
          </View>
          <Text style={styles.verifiedText}>{V.verifiedBadge}</Text>
        </View>
      ) : (
        <View style={styles.cardBody}>
          <Text style={styles.helper}>{V.codeHelper}</Text>
          <OtpCodeInput
            ref={inputRef}
            value={state.code}
            onChange={state.setCode}
            onComplete={state.submit}
            autoFocus
            hasError={Boolean(errorMessage)}
            length={VERIFICATION_CODE_LENGTH}
          />
          {state.codeSent && !errorMessage && (
            <Text style={styles.sentHint}>{sentSuccessHint}</Text>
          )}
          {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
          <PrimaryButton
            label={
              state.status === 'sending'
                ? V.sending
                : state.status === 'verifying'
                  ? V.verifying
                  : resendLabel
            }
            onPress={state.send}
            disabled={state.isBusy || state.secondsLeft > 0}
          />
        </View>
      )}
    </View>
  );
}

export function VerificationScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const dashboardPath = getRoleDashboardPath(getUserRole(user));

  const emailInputRef = useRef<OtpCodeInputHandle | null>(null);
  const phoneInputRef = useRef<OtpCodeInputHandle | null>(null);

  const emailVerified = user?.email_verified === true;
  const phoneVerified = user?.phone_verified === true;

  // Refetch the authoritative user after each successful verify so the stored
  // session (and this screen) reflect the server's flags.
  const refreshUser = useCallback(async () => {
    const result = await getCurrentUser();
    if (result.ok) await setSession({ user: result.data });
  }, []);

  const email = useVerification({
    channel: 'email',
    verified: emailVerified,
    onVerified: refreshUser,
    inputRef: emailInputRef,
  });
  const phone = useVerification({
    channel: 'phone',
    verified: phoneVerified,
    onVerified: refreshUser,
    inputRef: phoneInputRef,
  });

  // On open: require a saved token. No token -> back to login (cannot verify anonymously).
  useEffect(() => {
    if (!getSession().token) {
      router.replace('/login');
    }
  }, []);

  // Both channels verified -> into the app.
  useEffect(() => {
    if (emailVerified && phoneVerified) {
      router.replace(dashboardPath as any);
    }
  }, [dashboardPath, emailVerified, phoneVerified]);

  // Android hardware back: when verification is required keep the user here,
  // otherwise treat it like "skip".
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!REQUIRE_VERIFICATION) {
        router.replace(dashboardPath as any);
      }
      return true;
    });
    return () => subscription.remove();
  }, [dashboardPath]);

  if (!user) {
    // Session missing (e.g., a restart before persistence lands): back to login.
    return <Redirect href="/login" />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.headerRow, { paddingTop: insets.top + Spacing.two }]}>
        {!REQUIRE_VERIFICATION && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={V.back}
            hitSlop={8}
            onPress={() => router.replace(dashboardPath as any)}
            style={styles.backButton}
          >
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heading}>
          <Text style={styles.title}>{V.title}</Text>
          <Text style={styles.subtitle}>{V.subtitle}</Text>
        </View>

        <ChannelCard
          channel="email"
          state={email}
          title={V.emailSectionTitle}
          destination={user.email || '—'}
          inputRef={emailInputRef}
        />
        <ChannelCard
          channel="phone"
          state={phone}
          title={V.phoneSectionTitle}
          destination={user.phone || '—'}
          inputRef={phoneInputRef}
        />

        {VERIFICATION_DEV_CODE_FOR_DISPLAY && (
          <Text style={styles.devHint}>{V.devCodeHint}</Text>
        )}

        {!REQUIRE_VERIFICATION && (
          <PrimaryButton
            label={V.skip}
            style={styles.skipButton}
            onPress={() => router.replace(dashboardPath as any)}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Brand.white,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Brand.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 18,
    color: Brand.text,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    gap: Spacing.four,
  },
  heading: {
    gap: Spacing.one,
  },
  title: {
    color: Brand.text,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: Brand.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Brand.divider,
    backgroundColor: Brand.white,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  cardHeaderText: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    color: Brand.text,
    fontSize: 15,
    fontWeight: '700',
  },
  cardDestination: {
    color: Brand.textSecondary,
    fontSize: 14,
  },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 999,
  },
  badgeVerified: {
    backgroundColor: Brand.teal.light,
  },
  badgePending: {
    backgroundColor: Brand.inputBackground,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeTextVerified: {
    color: Brand.teal.text,
  },
  badgeTextPending: {
    color: Brand.textSecondary,
  },
  cardBody: {
    gap: Spacing.three,
  },
  helper: {
    color: Brand.textSecondary,
    fontSize: 13,
  },
  sentHint: {
    color: Brand.teal.text,
    fontSize: 13,
    fontWeight: '500',
  },
  error: {
    color: Brand.error,
    fontSize: 13,
    fontWeight: '500',
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  verifiedDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Brand.teal.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedDotText: {
    color: Brand.white,
    fontSize: 14,
    fontWeight: '700',
  },
  verifiedText: {
    color: Brand.teal.text,
    fontSize: 14,
    fontWeight: '600',
  },
  devHint: {
    color: Brand.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  skipButton: {
    backgroundColor: Brand.inputBackground,
  },
});
