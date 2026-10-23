import { AppText } from '@/components/typography/app-text';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/primary-button';
import { Brand, Spacing } from '@/constants/theme';

import { useRegistration } from '../RegistrationContext';
import { registrationService } from '../services/registration';
import type { RegistrationResult } from '../services/registration/types';
import {
  EMPTY_PERSONAL,
  type DocumentImage,
  type GeneralDocuments,
  type SeniorDocuments,
  type StudentDocuments,
  type UserType,
} from '../types';

const USER_TYPE_LABELS: Record<Exclude<UserType, null>, string> = {
  student: 'Student',
  general: 'General',
  senior: 'Senior Citizen',
};

const formatValue = (value: string) => (value.trim() ? value.trim() : '—');

export function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const { data } = useRegistration();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitFieldErrors, setSubmitFieldErrors] = useState<string[]>([]);
  const [cooldown, setCooldown] = useState(0);

  const personal = data?.personal ?? EMPTY_PERSONAL;
  const userType = data?.userType ?? null;
  const documents = data?.documents ?? null;

  // Rate-limit cooldown (from a 429); cleared on unmount.
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

  const handleSubmit = async () => {
    setSubmitError(null);
    setSubmitFieldErrors([]);
    setIsSubmitting(true);

    // 1) Create the account via the register endpoint. A 202 carries no
    //    token — it only confirms creation, so the user is signed in
    //    later (after their contact channels are verified).
    let registrationResult: RegistrationResult;
    try {
      registrationResult = await registrationService.register(data);
    } catch {
      setIsSubmitting(false);
      setSubmitError('Could not submit your account details. Please check your connection and try again.');
      return;
    }
    setIsSubmitting(false);

    if (!registrationResult.ok) {
      setSubmitError(registrationResult.message);
      setSubmitFieldErrors(
        Object.entries(registrationResult.fieldErrors ?? {}).map(
          ([field, message]) => `${field.replaceAll('_', ' ')}: ${message}`,
        ),
      );
      if (registrationResult.retryAfter) setCooldown(registrationResult.retryAfter);
      return;
    }

    // 2) Registration succeeded and the backend has issued verification
    //    codes for the email and phone on file. Move to the email OTP
    //    step; the form state is preserved in the registration context.
    router.replace('/register/email-otp');
  };

  const goEditPersonal = () => router.push('/register/personal-info');
  const goEditUserType = () => router.push('/register/user-type');
  const goEditDocuments = () => router.push('/register/documents');

  const renderPhotoStatus = (image?: DocumentImage | null) =>
    image ? 'Attached' : 'Not attached';

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

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
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <AppText style={styles.backIcon}>←</AppText>
        </Pressable>
        <View style={styles.stepIndicator}>
          <AppText style={styles.stepLabel}>Step 4 of 7</AppText>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(4 / 7) * 100}%` }]} />
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.five },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headingBlock}>
          <AppText style={styles.title}>Review Your Details</AppText>
          <AppText style={styles.subtitle}>
            Please check everything looks right before submitting
          </AppText>
        </View>

        <View style={styles.notice}>
          <AppText style={styles.noticeText}>
            Your identity documents will be reviewed by our team before your
            account is approved.
          </AppText>
        </View>

        <ReviewSection
          title="Personal Information"
          onEdit={goEditPersonal}
          rows={[
            { label: 'Full Name (English)', value: formatValue(personal.fullNameEnglish) },
            { label: 'Full Name (Nepali)', value: formatValue(personal.fullNameNepali) },
            { label: 'Date of Birth (AD)', value: formatValue(personal.dateOfBirthAD) },
            { label: 'Date of Birth (BS)', value: formatValue(personal.dateOfBirthBS) },
          ]}
        />

        <ReviewSection
          title="Contact Information"
          onEdit={goEditPersonal}
          rows={[
            { label: 'Email', value: formatValue(personal.email) },
            {
              label: 'Phone',
              value: personal.phoneNumber
                ? `+977 ${formatValue(personal.phoneNumber)}`
                : '—',
            },
            { label: 'Address', value: formatValue(personal.address) },
          ]}
        />

        <ReviewSection
          title="User Type"
          onEdit={goEditUserType}
          rows={[
            {
              label: 'Selected Type',
              value: userType ? USER_TYPE_LABELS[userType] : 'Not selected',
            },
          ]}
        />

        {userType === 'student' && documents && (
          <ReviewSection
            title="College Information"
            onEdit={goEditDocuments}
            rows={[
              {
                label: 'College Name',
                value: formatValue((documents as StudentDocuments).collegeName),
              },
              {
                label: 'College Address',
                value: formatValue((documents as StudentDocuments).collegeAddress),
              },
              {
                label: 'ID Card Number',
                value: formatValue((documents as StudentDocuments).collegeIdNumber),
              },
              {
                label: 'ID Card Expiry',
                value: (documents as StudentDocuments).collegeIdExpiry.trim()
                  ? formatValue((documents as StudentDocuments).collegeIdExpiry)
                  : 'Not applicable',
              },
              {
                label: 'ID Card Photo',
                value: renderPhotoStatus((documents as StudentDocuments).collegeIdPhoto),
              },
            ]}
          />
        )}

        {userType === 'general' && documents && (
          <ReviewSection
            title="Citizenship Information"
            onEdit={goEditDocuments}
            rows={[
              {
                label: 'Certificate Number',
                value: formatValue((documents as GeneralDocuments).citizenshipNumber),
              },
              {
                label: 'Front Photo',
                value: renderPhotoStatus((documents as GeneralDocuments).citizenshipFrontPhoto),
              },
              {
                label: 'Back Photo',
                value: renderPhotoStatus((documents as GeneralDocuments).citizenshipBackPhoto),
              },
            ]}
          />
        )}

        {userType === 'senior' && documents && (
          <ReviewSection
            title="Senior Citizen Card Information"
            onEdit={goEditDocuments}
            rows={[
              {
                label: 'Card Number',
                value: formatValue((documents as SeniorDocuments).seniorCardNumber),
              },
              {
                label: 'Front Photo',
                value: renderPhotoStatus((documents as SeniorDocuments).seniorCardFrontPhoto),
              },
              {
                label: 'Back Photo',
                value: renderPhotoStatus((documents as SeniorDocuments).seniorCardBackPhoto),
              },
            ]}
          />
        )}

        <View style={styles.footer}>
          {submitError && (
            <View style={styles.submitErrorBox} accessibilityRole="alert">
              <AppText style={styles.submitError}>{submitError}</AppText>
              {submitFieldErrors.map((message) => (
                <AppText key={message} style={styles.submitFieldError}>{message}</AppText>
              ))}
            </View>
          )}
          {cooldown > 0 && (
            <AppText style={styles.submitCooldown}>{`You can try again in ${cooldown}s`}</AppText>
          )}
          <PrimaryButton
            label={isSubmitting ? 'Creating account…' : 'Continue to Verification'}
            onPress={handleSubmit}
            disabled={isSubmitting || cooldown > 0}
            style={isSubmitting ? styles.buttonDisabled : undefined}
          />
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            disabled={isSubmitting}
            onPress={() => router.back()}
            style={styles.backTextButton}
          >
            <AppText style={styles.backText}>Back</AppText>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

type ReviewRow = { label: string; value: string };

function ReviewSection({
  title,
  rows,
  onEdit,
}: {
  title: string;
  rows: ReviewRow[];
  onEdit: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <AppText style={styles.cardTitle}>{title}</AppText>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onEdit}>
          <AppText style={styles.editButton}>Edit</AppText>
        </Pressable>
      </View>
      <View style={styles.rows}>
        {rows.map((row) => (
          <View key={row.label} style={styles.row}>
            <AppText style={styles.rowLabel}>{row.label}</AppText>
            <AppText style={styles.rowValue}>{row.value}</AppText>
          </View>
        ))}
      </View>
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
  subtitle: {
    color: Brand.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  notice: {
    padding: Spacing.three,
    borderRadius: 12,
    backgroundColor: Brand.teal.light,
    borderLeftWidth: 3,
    borderLeftColor: Brand.teal.primary,
  },
  noticeText: {
    color: Brand.teal.text,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Brand.divider,
    backgroundColor: Brand.white,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Brand.divider,
    paddingBottom: Spacing.two,
  },
  cardTitle: {
    color: Brand.text,
    fontSize: 15,
    fontWeight: '700',
  },
  editButton: {
    color: Brand.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  rows: {
    gap: Spacing.two,
  },
  row: {
    gap: 2,
  },
  rowLabel: {
    color: Brand.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  rowValue: {
    color: Brand.text,
    fontSize: 15,
    lineHeight: 21,
  },
  footer: {
    gap: Spacing.two,
  },
  submitErrorBox: {
    gap: Spacing.one,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0C6C9',
    backgroundColor: '#FCEBEC',
    padding: Spacing.three,
  },
  submitError: {
    color: Brand.error,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  submitFieldError: {
    color: Brand.text,
    fontSize: 12,
    lineHeight: 18,
  },
  submitCooldown: {
    color: Brand.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  backTextButton: {
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  backText: {
    color: Brand.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
});