import { AppText, AppTextInput } from '@/components/typography/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { login as L, t } from '@/constants/strings';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type TextInput,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  inputRef?: Ref<TextInput>;
};

function LoginTextField({
  label,
  icon,
  error,
  trailing,
  onSubmit,
  inputRef,
  style,
  ...rest
}: LoginTextFieldProps) {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const hasError = Boolean(error);

  return (
    <View style={styles.field}>
      <AppText style={[styles.fieldLabel, { color: theme.text }]}>{label}</AppText>
      <View
        style={[
          styles.fieldInputContainer,
          {
            backgroundColor: theme.surfaceSecondary,
            borderColor: hasError ? theme.error : isFocused ? theme.actionPrimary : theme.border,
          },
        ]}
      >
        <SymbolView
          name={icon}
          size={18}
          tintColor={hasError ? theme.error : isFocused ? theme.actionPrimary : theme.textSecondary}
        />
        <AppTextInput
          ref={inputRef}
          placeholderTextColor={theme.textSecondary}
          style={[styles.fieldInput, { color: theme.text }, style]}
          onSubmitEditing={onSubmit}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...rest}
        />
        {trailing}
      </View>
      {hasError && (
        <AppText style={[styles.fieldError, { color: theme.error }]}>{error}</AppText>
      )}
    </View>
  );
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const searchParams = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(searchParams.email ?? '');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [generalError, setGeneralError] = useState<string | null>(() => consumePendingAuthMessage());
  const [cooldown, setCooldown] = useState(0);
  const passwordInputRef = useRef<TextInput>(null);

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
          // Keep the login screen active
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
      style={[styles.flex, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.background,
            paddingTop: insets.top + Spacing.four,
            paddingBottom: insets.bottom + Spacing.four,
            paddingHorizontal: Spacing.four,
          },
        ]}
        onStartShouldSetResponder={dismissKeyboard}
      >
        <StatusBar style={theme.isDark ? 'light' : 'dark'} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          {/* Streamlined Header with eYatra Logo and Name */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <Image
                source={require('@/assets/images/eyatra-logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <AppText style={[styles.appName, { color: theme.text }]}>eYatra</AppText>
            </View>
            <AppText style={[styles.title, { color: theme.text }]}>Sign In</AppText>
            <AppText style={[styles.subtitle, { color: theme.textSecondary }]}>
              {L.subtitle}
            </AppText>
          </View>

          {/* Clean Form Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.cardSurface,
                borderColor: theme.border,
              },
            ]}
          >
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
                blurOnSubmit={false}
                error={fieldErrors.email}
                icon={{ ios: 'envelope.fill', android: 'email', web: 'email' }}
                onSubmit={() => passwordInputRef.current?.focus()}
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
                inputRef={passwordInputRef}
                error={fieldErrors.password}
                icon={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
                trailing={
                  <Pressable
                    onPress={() => setIsPasswordVisible((visible) => !visible)}
                    accessibilityRole="button"
                    accessibilityLabel={isPasswordVisible ? L.hidePassword : L.showPassword}
                    hitSlop={10}
                    style={styles.visibilityToggle}
                  >
                    <SymbolView
                      name={{
                        ios: isPasswordVisible ? 'eye.slash.fill' : 'eye.fill',
                        android: isPasswordVisible ? 'visibility_off' : 'visibility',
                        web: isPasswordVisible ? 'visibility_off' : 'visibility',
                      }}
                      size={18}
                      tintColor={theme.textSecondary}
                    />
                  </Pressable>
                }
              />

              <View style={styles.forgotPasswordRow}>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() =>
                    router.push(
                      email
                        ? (`/forgot-password?email=${encodeURIComponent(email)}` as any)
                        : '/forgot-password',
                    )
                  }
                >
                  <AppText style={[styles.forgotPasswordLink, { color: theme.actionPrimary }]}>
                    Forgot Password?
                  </AppText>
                </Pressable>
              </View>

              {generalError && (
                <View style={[styles.errorBanner, { backgroundColor: `${theme.error}15` }]}>
                  <AppText style={[styles.generalError, { color: theme.error }]}>
                    {generalError}
                  </AppText>
                </View>
              )}

              {cooldown > 0 && (
                <AppText style={[styles.cooldownText, { color: theme.textSecondary }]}>
                  {t(L.retryIn, { seconds: cooldown })}
                </AppText>
              )}
            </View>

            <View style={styles.actions}>
              <PrimaryButton
                label={isSubmitting ? L.loggingIn : L.loginCta}
                onPress={handleSubmit}
                disabled={isDisabled}
                style={[
                  styles.submitButton,
                  { backgroundColor: theme.actionPrimary },
                  isSubmitting && styles.buttonLoading,
                ]}
              />

              <View style={styles.registerRow}>
                <AppText style={[styles.registerPrompt, { color: theme.textSecondary }]}>
                  {L.registerPrompt}
                </AppText>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => router.push('/register/personal-info')}
                >
                  <AppText style={[styles.registerLink, { color: theme.actionPrimary }]}>
                    {L.registerCta}
                  </AppText>
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
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Spacing.four,
    paddingVertical: Spacing.three,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  logoImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  appName: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  // Main Headings -> 800 (ExtraBold)
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  // Body text -> 400 (Regular)
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    textAlign: 'center',
  },
  card: {
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.four,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  form: {
    gap: Spacing.three,
  },
  field: {
    gap: 6,
  },
  // Small labels -> 500 (Medium)
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  fieldInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    height: 48,
  },
  // Body text input -> 400 (Regular)
  fieldInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    height: '100%',
  },
  visibilityToggle: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldError: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  forgotPasswordRow: {
    alignItems: 'flex-end',
    marginTop: -2,
  },
  // Subheadings/link -> 600 (SemiBold)
  forgotPasswordLink: {
    fontSize: 13,
    fontWeight: '600',
  },
  errorBanner: {
    borderRadius: 10,
    padding: Spacing.two,
  },
  generalError: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  cooldownText: {
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'center',
  },
  actions: {
    gap: Spacing.three,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 14,
  },
  buttonLoading: {
    opacity: 0.7,
  },
  registerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.one,
  },
  registerPrompt: {
    fontSize: 14,
    fontWeight: '400',
  },
  // Buttons/CTA -> 700 (Bold)
  registerLink: {
    fontSize: 14,
    fontWeight: '700',
  },
});
