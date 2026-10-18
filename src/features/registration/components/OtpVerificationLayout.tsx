/**
 * Shared shell for both OTP verification screens.
 *
 * The email and phone screens are identical apart from a heading, a
 * destination and button labels, so both render through this component and
 * only supply their own copy. Keeping it here means the two screens can never
 * drift apart visually, and the state machine lives in one place.
 */

import { type ReactNode, type Ref } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { PrimaryButton } from '@/components/ui/primary-button';
import { Brand, Spacing } from '@/constants/theme';

import { OtpInput, type OtpInputRef } from './OtpInput';

type ResendVerificationStatus = { tone: 'success' | 'error'; message: string };

export type OtpVerificationLayoutProps = {
  /** 1-based step position within the overall flow. */
  step: number;
  heading: string;
  /** Already-formatted contact value shown under the heading. */
  destination: string;
  /** Optional label above the destination, e.g. "Email address". */
  destinationLabel?: string;
  message: string;
  code: string;
  onCodeChange: (code: string) => void;
  codeError: string | null;
  formError: string | null;
  isVerifying: boolean;
  isVerifyDisabled: boolean;
  verifyLabel: string;
  onVerify: () => void;
  onBack: () => void;
  secondsLeft: number;
  canResend: boolean;
  onResend: () => void;
  changeLabel: string;
  /** Development hint such as the mock code, or null in production. */
  devHint: string | null;
  otpInputRef: Ref<OtpInputRef>;
  footerNote: string;
  /**
   * Optional secondary action that (re)sends the backend verification email.
   * Supplied only where email is verified (never on the phone screen); when
   * present, an extra button and its status render under the OTP resend row.
   */
  onResendEmail?: () => void;
  resendEmailLabel?: string;
  isResendingEmail?: boolean;
  resendEmailStatus?: ResendVerificationStatus | null;
};

export function OtpVerificationLayout({
  step,
  heading,
  destination,
  destinationLabel,
  message,
  code,
  onCodeChange,
  codeError,
  formError,
  isVerifying,
  isVerifyDisabled,
  verifyLabel,
  onVerify,
  onBack,
  secondsLeft,
  canResend,
  onResend,
  changeLabel,
  devHint,
  otpInputRef,
  footerNote,
  onResendEmail,
  resendEmailLabel,
  isResendingEmail,
  resendEmailStatus,
}: OtpVerificationLayoutProps) {
  const insets = useSafeAreaInsets();
  const shownError = codeError ?? formError;

  const resendView: ReactNode = canResend ? (
    <Pressable accessibilityRole="button" hitSlop={8} onPress={onResend} style={styles.resendButton}>
      <Text style={styles.resendActive}>Resend code</Text>
    </Pressable>
  ) : (
    <View style={styles.resendButton}>
      <Text style={styles.resendWaiting}>Resend code in {secondsLeft}s</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.headerRow,
          { paddingTop: insets.top + Spacing.two, paddingHorizontal: Spacing.four },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          onPress={onBack}
          style={styles.backButton}
        >
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <View style={styles.stepIndicator}>
          <Text style={styles.stepLabel}>Step {step} of 7</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(step / 7) * 100}%` }]} />
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.five },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headingBlock}>
          <Text style={styles.title}>{heading}</Text>
          <Text style={styles.message}>{message}</Text>
        </View>

        <View style={styles.destinationCard}>
          <View style={styles.destinationIconWrap}>
            <SymbolView
              name={
                destinationLabel === 'Phone number'
                  ? { ios: 'phone.fill', android: 'phone', web: 'phone' }
                  : { ios: 'envelope.fill', android: 'email', web: 'email' }
              }
              size={20}
              tintColor={Brand.primary}
            />
          </View>
          <View style={styles.destinationTextWrap}>
            {destinationLabel && <Text style={styles.destinationLabel}>{destinationLabel}</Text>}
            <Text style={styles.destination} numberOfLines={1}>
              {destination}
            </Text>
          </View>
        </View>

        <OtpInput
          ref={otpInputRef}
          value={code}
          onChange={onCodeChange}
          hasError={Boolean(shownError)}
        />

        {shownError && <Text style={styles.error}>{shownError}</Text>}

        {devHint && (
          <View style={styles.devHint}>
            <Text style={styles.devHintText}>
              Development build: the mock code is {devHint}. No email or SMS is actually sent.
            </Text>
          </View>
        )}

        <View style={styles.footer}>
          <PrimaryButton
            label={verifyLabel}
            onPress={onVerify}
            disabled={isVerifyDisabled || isVerifying}
            style={isVerifyDisabled && !isVerifying ? styles.buttonDisabled : undefined}
          />
          {resendView}
          <Pressable accessibilityRole="button" hitSlop={8} onPress={onBack} style={styles.changeButton}>
            <Text style={styles.changeText}>{changeLabel}</Text>
          </Pressable>
        </View>

        {onResendEmail && (
          <View style={styles.emailResendBlock}>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              disabled={isResendingEmail}
              onPress={onResendEmail}
              style={styles.emailResendButton}
            >
              <Text style={[styles.emailResendText, isResendingEmail && styles.emailResendBusy]}>
                {isResendingEmail ? 'Sending…' : (resendEmailLabel ?? 'Resend verification email')}
              </Text>
            </Pressable>
            {resendEmailStatus && (
              <Text
                style={[
                  styles.emailResendStatus,
                  resendEmailStatus.tone === 'error' && styles.emailResendStatusError,
                ]}
              >
                {resendEmailStatus.message}
              </Text>
            )}
          </View>
        )}

        <Text style={styles.note}>{footerNote}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Brand.white,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: Spacing.two,
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
  stepIndicator: {
    flex: 1,
    gap: Spacing.one,
  },
  stepLabel: {
    color: Brand.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Brand.divider,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Brand.teal.primary,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    gap: Spacing.four,
  },
  headingBlock: {
    gap: Spacing.one,
  },
  title: {
    color: Brand.text,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  message: {
    color: Brand.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  destinationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 14,
    backgroundColor: Brand.inputBackground,
  },
  destinationIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Brand.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinationTextWrap: {
    flex: 1,
    gap: 2,
  },
  destinationLabel: {
    color: Brand.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  destination: {
    color: Brand.text,
    fontSize: 15,
    fontWeight: '600',
  },
  error: {
    color: Brand.error,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  devHint: {
    padding: Spacing.three,
    borderRadius: 12,
    backgroundColor: Brand.teal.light,
    borderLeftWidth: 3,
    borderLeftColor: Brand.teal.primary,
  },
  devHintText: {
    color: Brand.teal.text,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  footer: {
    gap: Spacing.two,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  resendButton: {
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  resendActive: {
    color: Brand.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  resendWaiting: {
    color: Brand.textSecondary,
    fontSize: 14,
  },
  changeButton: {
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  changeText: {
    color: Brand.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  note: {
    color: Brand.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  emailResendBlock: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  emailResendButton: {
    paddingVertical: Spacing.two,
  },
  emailResendText: {
    color: Brand.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  emailResendBusy: {
    color: Brand.textSecondary,
  },
  emailResendStatus: {
    color: Brand.teal.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
  emailResendStatusError: {
    color: Brand.error,
  },
});
