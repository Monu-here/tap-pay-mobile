import {AppText, AppTextInput } from '@/components/typography/app-text';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { PrimaryButton } from '@/components/ui/primary-button';
import { Brand, Spacing } from '@/constants/theme';
import { forgotPassword } from '@/features/auth/services/auth';

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      const result = await forgotPassword(email);
      if (result.ok) {
        setMessage('If an account matches that email, a password reset link has been dispatched.');
      } else {
        setError(result.message || 'Unable to send password reset link. Please try again.');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <SymbolView
              name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
              size={22}
              tintColor={Brand.text}
            />
            <AppText style={styles.backText}>Back to Sign In</AppText>
          </Pressable>

          <View style={styles.header}>
            <AppText style={styles.title}>Forgot Password</AppText>
            <AppText style={styles.subtitle}>
              Enter your registered email address. We&apos;ll send instructions to reset your password.
            </AppText>
          </View>

          {message ? (
            <View style={styles.successBox}>
              <SymbolView
                name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                size={28}
                tintColor={Brand.teal.primary}
              />
              <AppText style={styles.successText}>{message}</AppText>
              <PrimaryButton
                title="Enter Reset Token"
                onPress={() => router.push(`/reset-password?email=${encodeURIComponent(email)}` as any)}
                style={styles.actionButton}
              />
            </View>
          ) : (
            <View style={styles.form}>
              <View style={styles.field}>
                <AppText style={styles.fieldLabel}>Email Address</AppText>
                <View style={[styles.inputContainer, error ? styles.inputError : null]}>
                  <SymbolView
                    name={{ ios: 'envelope.fill', android: 'mail', web: 'mail' }}
                    size={18}
                    tintColor={Brand.textSecondary}
                  />
                  <AppTextInput
                    style={styles.input}
                    value={email}
                    onChangeText={(val) => {
                      setEmail(val);
                      setError(null);
                    }}
                    placeholder="name@example.com"
                    placeholderTextColor={Brand.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                {error && <AppText style={styles.errorText}>{error}</AppText>}
              </View>

              <PrimaryButton
                title={isSubmitting ? 'Sending Link...' : 'Send Reset Link'}
                onPress={handleSubmit}
                disabled={isSubmitting}
                style={styles.submitButton}
              />

              <Pressable
                onPress={() => router.push(`/reset-password?email=${encodeURIComponent(email)}` as any)}
                style={styles.tokenPrompt}
              >
                <AppText style={styles.tokenPromptText}>Already have a reset token? Enter it here</AppText>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Brand.white,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.three,
  },
  backText: {
    fontSize: 16,
    color: Brand.text,
    fontWeight: '500',
  },
  header: {
    marginBottom: Spacing.five,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Brand.text,
    marginBottom: Spacing.two,
  },
  subtitle: {
    fontSize: 15,
    color: Brand.textSecondary,
    lineHeight: 22,
  },
  form: {
    gap: Spacing.four,
  },
  field: {
    gap: Spacing.one,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.text,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.inputBackground,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputError: {
    borderColor: Brand.error,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Brand.text,
  },
  errorText: {
    fontSize: 13,
    color: Brand.error,
    marginTop: 4,
  },
  submitButton: {
    marginTop: Spacing.two,
  },
  tokenPrompt: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  tokenPromptText: {
    fontSize: 14,
    color: Brand.primary,
    fontWeight: '600',
  },
  successBox: {
    backgroundColor: Brand.teal.light,
    borderRadius: 16,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
  },
  successText: {
    fontSize: 15,
    color: Brand.teal.text,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  actionButton: {
    width: '100%',
    marginTop: Spacing.two,
  },
});
