import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { PrimaryButton } from '@/components/ui/primary-button';
import { Brand, Spacing } from '@/constants/theme';
import { resetPassword } from '@/features/auth/services/auth';

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const searchParams = useLocalSearchParams<{ email?: string; token?: string }>();

  const [email, setEmail] = useState(searchParams.email ?? '');
  const [token, setToken] = useState(searchParams.token ?? '');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !token.trim()) {
      setError('Email and reset token are required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== passwordConfirmation) {
      setError('Passwords do not match.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await resetPassword(email, token, password, passwordConfirmation);
      if (result.ok) {
        setSuccess(true);
      } else {
        setError(result.message || 'Unable to reset password. Please check your token and try again.');
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
          <Pressable onPress={() => router.replace('/login')} style={styles.backButton}>
            <SymbolView
              name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
              size={22}
              tintColor={Brand.text}
            />
            <Text style={styles.backText}>Cancel and Sign In</Text>
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Enter the reset token received in your email and choose a secure new password.
            </Text>
          </View>

          {success ? (
            <View style={styles.successBox}>
              <SymbolView
                name={{ ios: 'checkmark.shield.fill', android: 'verified_user', web: 'verified_user' }}
                size={36}
                tintColor={Brand.teal.primary}
              />
              <Text style={styles.successTitle}>Password Updated!</Text>
              <Text style={styles.successText}>
                Your password has been securely reset. You can now sign in with your new credentials.
              </Text>
              <PrimaryButton
                title="Proceed to Sign In"
                onPress={() => router.replace('/login')}
                style={styles.actionButton}
              />
            </View>
          ) : (
            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Email Address</Text>
                <View style={styles.inputContainer}>
                  <TextInput
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
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Reset Token</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    value={token}
                    onChangeText={(val) => {
                      setToken(val);
                      setError(null);
                    }}
                    placeholder="Paste 64-character token"
                    placeholderTextColor={Brand.textSecondary}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>New Password</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={(val) => {
                      setPassword(val);
                      setError(null);
                    }}
                    placeholder="At least 8 characters"
                    placeholderTextColor={Brand.textSecondary}
                    secureTextEntry
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Confirm New Password</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    value={passwordConfirmation}
                    onChangeText={(val) => {
                      setPasswordConfirmation(val);
                      setError(null);
                    }}
                    placeholder="Re-enter password"
                    placeholderTextColor={Brand.textSecondary}
                    secureTextEntry
                  />
                </View>
              </View>

              {error && <Text style={styles.errorText}>{error}</Text>}

              <PrimaryButton
                title={isSubmitting ? 'Resetting Password...' : 'Reset Password'}
                onPress={handleSubmit}
                disabled={isSubmitting}
                style={styles.submitButton}
              />
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
    marginBottom: Spacing.four,
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
    backgroundColor: Brand.inputBackground,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  input: {
    fontSize: 16,
    color: Brand.text,
  },
  errorText: {
    fontSize: 14,
    color: Brand.error,
    fontWeight: '500',
    marginTop: 2,
  },
  submitButton: {
    marginTop: Spacing.two,
  },
  successBox: {
    backgroundColor: Brand.teal.light,
    borderRadius: 16,
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.three,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Brand.teal.text,
  },
  successText: {
    fontSize: 15,
    color: Brand.teal.text,
    textAlign: 'center',
    lineHeight: 22,
  },
  actionButton: {
    width: '100%',
    marginTop: Spacing.two,
  },
});
