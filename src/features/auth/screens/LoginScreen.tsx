import {AppText, AppTextInput } from '@/components/typography/app-text';
/**
 * Screen — Login.
 *
 * Calls the real `POST /auth/login` endpoint via `login()`. On success it saves
 * the session (token + user) and routes by verification state: any unverified
 * channel goes to the OTP `VerificationScreen`, otherwise into the app. No
 * password or token is ever logged.
 */

import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { PrimaryButton } from '@/components/ui/primary-button';
import { t, login as L } from '@/constants/strings';
import { Brand, Spacing } from '@/constants/theme';

import { getDeviceName, login } from '../services/auth';
import {
  clearSession,
  consumePendingAuthMessage,
  getRoleDashboardPath,
  getUserRole,
  saveSession,
} from '../session';

type SymbolName = { ios: SFSymbol; android: AndroidSymbol; web: AndroidSymbol };

type LoginTextFieldProps = TextInputProps & {
  label: string;
  icon: SymbolName;
  error?: string | null;
  trailing?: ReactNode;
  onSubmit?: () => void;
};

function LoginTextField({
  label,
  icon,
  error,
  trailing,
  onSubmit,
  style,
  ...rest
}: LoginTextFieldProps) {
  const hasError = Boolean(error);
  return (
    <View style={styles.field}>
      <AppText style={styles.fieldLabel}>{label}</AppText>
      <View
        style={[
          styles.fieldInputContainer,
          hasError && styles.fieldInputContainerError,
        ]}
      >
        <SymbolView
          name={icon}
          size={18}
          tintColor={hasError ? Brand.error : Brand.textSecondary}
        />
        <AppTextInput
          placeholderTextColor={Brand.textSecondary}
          style={[styles.fieldInput, style]}
          onSubmitEditing={onSubmit}
          {...rest}
        />
        {trailing}
      </View>
      {hasError && <AppText style={styles.fieldError}>{error}</AppText>}
    </View>
  );
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginScreen() {
  const insets = useSafeAreaInsets();
  const searchParams = useLocalSearchParams<{ email?: string }>();

  // Prefill the email handed back from a failed signup-then-login.
  const [email, setEmail] = useState(searchParams.email ?? '');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  // Surface a session-expired notice set by a global 401 (read once on mount).
  const [generalError, setGeneralError] = useState<string | null>(() => consumePendingAuthMessage());
  const [cooldown, setCooldown] = useState(0);

  // Rate-limit cooldown; cleared on unmount.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => {
      setCooldown((current) => {
        if (current <= 1) {
          clearInterval(id);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const dismissKeyboard = () => {
    Keyboard.dismiss();
    return false;
  };

  const validate = (): boolean => {
    const trimmed = email.trim();
    const errors: { email?: string; password?: string } = {};
    if (!trimmed) errors.email = L.error.emailRequired;
    else if (!EMAIL_REGEX.test(trimmed)) errors.email = L.error.emailInvalid;
    if (!password) errors.password = L.error.passwordRequired;
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    setGeneralError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    const result = await login(email, password, getDeviceName());
    setIsSubmitting(false);

    if (result.ok) {
      try {
        await saveSession({ token: result.token, expiresAt: result.expiresAt, user: result.user });
      } catch {
        try {
          await clearSession();
        } catch {
          // Keep the login screen active; do not enter the app without secure persistence.
        }
        setGeneralError('Could not securely save your session. Please try signing in again.');
        return;
      }
      const needsVerification =
        result.user.email_verified === false || result.user.phone_verified === false;
      const destination = getRoleDashboardPath(getUserRole(result.user));
      router.replace(needsVerification ? '/register/verification' : (destination as any));
      return;
    }

    switch (result.reason) {
      case 'validation':
        setFieldErrors({
          email: result.fieldErrors?.email,
          password: result.fieldErrors?.password,
        });
        setGeneralError(result.message);
        break;
      case 'invalidCredentials':
        setFieldErrors({});
        setGeneralError(result.message);
        break;
      case 'rateLimited':
        setFieldErrors({});
        setGeneralError(L.rateLimited);
        setCooldown(result.retryAfter ?? 30);
        break;
      case 'network':
        setGeneralError(L.error.network);
        break;
      case 'unauthorized':
        setGeneralError(L.error.sessionExpired);
        break;
      default:
        setGeneralError(result.message || L.error.generic);
        break;
    }
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
    if (generalError) setGeneralError(null);
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
    if (generalError) setGeneralError(null);
  };

  const isDisabled =
    isSubmitting || cooldown > 0 || email.trim().length === 0 || password.length === 0;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + Spacing.five,
            paddingBottom: insets.bottom + Spacing.four,
            paddingHorizontal: Spacing.four,
          },
        ]}
        onStartShouldSetResponder={dismissKeyboard}
      >
        <StatusBar style="dark" />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandHeader}>
            <View style={styles.logoContainer}>
              <View style={styles.logoMark}>
                <SymbolView
                  name={{ ios: 'creditcard.fill', android: 'credit_card', web: 'credit_card' }}
                  size={25}
                  tintColor={Brand.white}
                />
              </View>
              <AppText style={styles.logoText}>Tap &amp; Pay</AppText>
            </View>
            <AppText style={styles.brandCaption}>SMARTER TRAVEL ACROSS NEPAL</AppText>
          </View>

          <View style={styles.heading}>
            <AppText style={styles.eyebrow}>WELCOME BACK</AppText>
            <AppText style={styles.title}>{L.title}</AppText>
            <AppText style={styles.subtitle}>{L.subtitle}</AppText>
          </View>

          <View style={styles.loginCard}>
            <View style={styles.form}>
              <LoginTextField
                label={L.emailLabel}
                value={email}
                onChangeText={handleEmailChange}
                placeholder={L.emailPlaceholder}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                error={fieldErrors.email}
                icon={{ ios: 'envelope.fill', android: 'email', web: 'email' }}
              />
              <LoginTextField
                label={L.passwordLabel}
                value={password}
                onChangeText={handlePasswordChange}
                placeholder={L.passwordPlaceholder}
                secureTextEntry={!isPasswordVisible}
                textContentType="password"
                autoCapitalize="none"
                returnKeyType="go"
                onSubmit={handleSubmit}
                error={fieldErrors.password}
                icon={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
                trailing={
                  <Pressable
                    onPress={() => setIsPasswordVisible((visible) => !visible)}
                    accessibilityRole="button"
                    accessibilityLabel={isPasswordVisible ? L.hidePassword : L.showPassword}
                    hitSlop={8}
                    style={styles.visibilityToggle}
                  >
                    <SymbolView
                      name={{
                        ios: isPasswordVisible ? 'eye.slash.fill' : 'eye.fill',
                        android: isPasswordVisible ? 'visibility_off' : 'visibility',
                        web: isPasswordVisible ? 'visibility_off' : 'visibility',
                      }}
                      size={18}
                      tintColor={Brand.textSecondary}
                    />
                  </Pressable>
                }
              />

              <View style={styles.forgotPasswordRow}>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => router.push(email ? `/forgot-password?email=${encodeURIComponent(email)}` as any : '/forgot-password')}
                >
                  <AppText style={styles.forgotPasswordLink}>Forgot Password?</AppText>
                </Pressable>
              </View>

              {generalError && <AppText style={styles.generalError}>{generalError}</AppText>}
              {cooldown > 0 && (
                <AppText style={styles.cooldownText}>{t(L.retryIn, { seconds: cooldown })}</AppText>
              )}
            </View>

            <View style={styles.footer}>
              <PrimaryButton
                label={isSubmitting ? L.loggingIn : L.loginCta}
                onPress={handleSubmit}
                disabled={isDisabled}
                style={isSubmitting ? styles.buttonLoading : undefined}
              />

              <View style={styles.registerRow}>
                <AppText style={styles.registerPrompt}>{L.registerPrompt}</AppText>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => router.push('/register/personal-info')}
                >
                  <AppText style={styles.registerLink}>{L.registerCta}</AppText>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Brand.background,
  },
  container: {
    flex: 1,
    backgroundColor: Brand.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Spacing.five,
    paddingVertical: Spacing.four,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Spacing.two,
  },
  brandHeader: {
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  logoMark: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.primary,
  },
  logoText: {
    color: Brand.text,
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  brandCaption: {
    color: Brand.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  heading: {
    gap: Spacing.one,
  },
  eyebrow: {
    color: Brand.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    color: Brand.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: Brand.textSecondary,
    fontSize: 16,
    lineHeight: 24,
  },
  form: {
    gap: Spacing.three,
  },
  loginCard: {
    backgroundColor: Brand.white,
    borderRadius: 24,
    padding: Spacing.four,
    gap: Spacing.four,
    borderWidth: 1,
    borderColor: Brand.border,
    shadowColor: '#183B35',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 3,
  },
  field: {
    gap: Spacing.one,
  },
  fieldLabel: {
    color: Brand.text,
    fontSize: 14,
    fontWeight: '600',
  },
  fieldInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: Brand.inputBackground,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    height: 52,
  },
  fieldInput: {
    flex: 1,
    color: Brand.text,
    fontSize: 16,
    height: '100%',
  },
  visibilityToggle: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generalError: {
    color: Brand.error,
    fontSize: 14,
    textAlign: 'center',
  },
  cooldownText: {
    color: Brand.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  footer: {
    gap: Spacing.three,
  },
  forgotPasswordRow: {
    alignItems: 'flex-end',
    marginTop: -Spacing.one,
  },
  forgotPasswordLink: {
    color: Brand.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  registerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  registerPrompt: {
    color: Brand.textSecondary,
    fontSize: 14,
  },
  registerLink: {
    color: Brand.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  fieldInputContainerError: {
    borderWidth: 1,
    borderColor: Brand.error,
  },
  fieldError: {
    color: Brand.error,
    fontSize: 12,
    marginTop: Spacing.half,
  },
  buttonLoading: {
    opacity: 0.7,
  },
});
