import { AppText } from '@/components/typography/app-text';
import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Palette, Spacing } from '@/constants/theme';
import { FontFamilies } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
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
import { useVerification } from '../hooks/useVerification';
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
    case 'deliveryFailed':
      return 'Unable to deliver SMS code. Please check your network and try again.';
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

export function VerificationScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { user } = useSession();
  const dashboardPath = getRoleDashboardPath(getUserRole(user));

  const phoneInputRef = useRef<OtpCodeInputHandle | null>(null);
  const phoneVerified = user?.phone_verified === true;

  // Refetch user after successful verify so stored session reflects server state
  const refreshUser = useCallback(async () => {
    const result = await getCurrentUser();
    if (result.ok) await setSession({ user: result.data });
  }, []);

  const phone = useVerification({
    channel: 'phone',
    verified: phoneVerified,
    onVerified: refreshUser,
    inputRef: phoneInputRef,
  });

  // Guard: require saved token
  useEffect(() => {
    if (!getSession().token) {
      router.replace('/login');
    }
  }, []);

  // Phone verified -> proceed to dashboard
  useEffect(() => {
    if (phoneVerified) {
      router.replace(dashboardPath as any);
    }
  }, [dashboardPath, phoneVerified]);

  // Android hardware back
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
    return <Redirect href="/login" />;
  }

  const errorMessage = messageForError(phone.error);

  const resendLabel =
    phone.secondsLeft > 0
      ? `Resend code in ${phone.secondsLeft}s`
      : phone.codeSent
      ? 'Resend SMS Code'
      : 'Send SMS Code';

  const userPhone = user.phone || 'Your registered phone';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />

      {/* Branded Header */}
      <LinearGradient
        colors={['#003049', '#001824']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.headerRow}>
          {!REQUIRE_VERIFICATION ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to Home"
              onPress={() => router.replace(dashboardPath as any)}
              style={styles.backBtn}
              hitSlop={8}
            >
              <SymbolView
                name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
                size={20}
                tintColor={Palette.warmCream}
              />
            </Pressable>
          ) : (
            <View style={{ width: 38 }} />
          )}

          <View style={styles.headerCenter}>
            <AppText style={styles.headerSubtitle}>eYatra Security</AppText>
            <AppText style={styles.headerTitle}>Phone Verification</AppText>
          </View>

          {!REQUIRE_VERIFICATION ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace(dashboardPath as any)}
              style={styles.skipBtn}
            >
              <AppText style={styles.skipText}>Skip</AppText>
            </Pressable>
          ) : (
            <View style={{ width: 38 }} />
          )}
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.five }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Verification Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.isDark ? '#002235' : Palette.white,
              borderColor: theme.border,
            },
          ]}
        >
          {/* Card Icon & Header */}
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <SymbolView
                name={{ ios: 'phone.badge.checkmark', android: 'verified_user', web: 'verified_user' }}
                size={24}
                tintColor={Palette.crimsonRed}
              />
            </View>

            <View style={styles.cardHeaderText}>
              <AppText style={[styles.cardTitle, { color: theme.text }]}>
                Verify Mobile Number
              </AppText>
              <AppText style={[styles.cardDestination, { color: theme.textSecondary }]}>
                {userPhone}
              </AppText>
            </View>

            <View
              style={[
                styles.badge,
                phone.isVerified ? styles.badgeVerified : styles.badgePending,
              ]}
            >
              <AppText
                style={[
                  styles.badgeText,
                  phone.isVerified ? styles.badgeTextVerified : styles.badgeTextPending,
                ]}
              >
                {phone.isVerified ? 'VERIFIED' : 'PENDING'}
              </AppText>
            </View>
          </View>

          {phone.isVerified ? (
            <View style={styles.verifiedRow}>
              <View style={styles.verifiedDot}>
                <AppText style={styles.verifiedDotText}>✓</AppText>
              </View>
              <AppText style={[styles.verifiedText, { color: '#1B8A5A' }]}>
                Mobile number verified successfully. Redirecting...
              </AppText>
            </View>
          ) : (
            <View style={styles.cardBody}>
              <AppText style={[styles.helper, { color: theme.textSecondary }]}>
                Enter the 6-digit SMS verification code sent to your mobile.
              </AppText>

              {/* 6-Digit OTP Code Input */}
              <View style={styles.otpInputWrap}>
                <OtpCodeInput
                  ref={phoneInputRef}
                  value={phone.code}
                  onChange={phone.setCode}
                  onComplete={phone.submit}
                  autoFocus
                  hasError={Boolean(errorMessage)}
                  length={VERIFICATION_CODE_LENGTH}
                />
              </View>

              {phone.codeSent && !errorMessage && (
                <AppText style={[styles.sentHint, { color: '#1B8A5A' }]}>
                  SMS code sent. Please check your messages.
                </AppText>
              )}

              {errorMessage && (
                <View style={styles.errorBox}>
                  <AppText style={styles.errorText}>{errorMessage}</AppText>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => phone.submit(phone.code)}
                  disabled={phone.code.length !== VERIFICATION_CODE_LENGTH || phone.isBusy}
                  style={[
                    styles.verifyBtn,
                    (phone.code.length !== VERIFICATION_CODE_LENGTH || phone.isBusy) &&
                      styles.disabledBtn,
                  ]}
                >
                  <LinearGradient
                    colors={[Palette.crimsonRed, Palette.deepMaroon]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.verifyBtnGradient}
                  >
                    {phone.isBusy ? (
                      <ActivityIndicator size="small" color={Palette.white} />
                    ) : (
                      <AppText style={styles.verifyBtnText}>Verify Code</AppText>
                    )}
                  </LinearGradient>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={phone.send}
                  disabled={phone.isBusy || phone.secondsLeft > 0}
                  style={styles.resendBtn}
                >
                  <AppText
                    style={[
                      styles.resendText,
                      {
                        color:
                          phone.secondsLeft > 0
                            ? theme.textMuted
                            : Palette.crimsonRed,
                      },
                    ]}
                  >
                    {resendLabel}
                  </AppText>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {VERIFICATION_DEV_CODE_FOR_DISPLAY && (
          <AppText style={[styles.devHint, { color: theme.textMuted }]}>
            {V.devCodeHint}
          </AppText>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerGradient: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerSubtitle: {
    color: Palette.slateBlue,
    fontFamily: FontFamilies.medium,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: Palette.warmCream,
    fontFamily: FontFamilies.extraBold,
    fontSize: 20,
    letterSpacing: -0.3,
  },
  skipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  skipText: {
    fontFamily: FontFamilies.bold,
    fontSize: 13,
    color: Palette.warmCream,
  },
  scrollContent: {
    padding: Spacing.four,
    gap: 16,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    gap: 18,
    shadowColor: Palette.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(193, 18, 31, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontFamily: FontFamilies.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  cardDestination: {
    fontFamily: FontFamilies.regular,
    fontSize: 13,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgePending: {
    backgroundColor: 'rgba(194, 120, 3, 0.12)',
  },
  badgeVerified: {
    backgroundColor: 'rgba(27, 138, 90, 0.12)',
  },
  badgeText: {
    fontFamily: FontFamilies.extraBold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  badgeTextPending: {
    color: '#C27803',
  },
  badgeTextVerified: {
    color: '#1B8A5A',
  },
  cardBody: {
    gap: 16,
  },
  helper: {
    fontFamily: FontFamilies.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  otpInputWrap: {
    marginVertical: 4,
  },
  sentHint: {
    fontFamily: FontFamilies.medium,
    fontSize: 12,
  },
  errorBox: {
    backgroundColor: '#FDF0D5',
    borderColor: Palette.crimsonRed,
    borderWidth: 1,
    padding: 10,
    borderRadius: 12,
  },
  errorText: {
    fontFamily: FontFamilies.medium,
    fontSize: 12,
    color: Palette.crimsonRed,
  },
  actions: {
    gap: 12,
    marginTop: 4,
  },
  verifyBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Palette.crimsonRed,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  verifyBtnGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnText: {
    fontFamily: FontFamilies.bold,
    fontSize: 15,
    color: Palette.white,
  },
  disabledBtn: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  resendBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  resendText: {
    fontFamily: FontFamilies.bold,
    fontSize: 13,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  verifiedDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1B8A5A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedDotText: {
    color: Palette.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  verifiedText: {
    fontFamily: FontFamilies.semiBold,
    fontSize: 13,
  },
  devHint: {
    fontSize: 11,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
