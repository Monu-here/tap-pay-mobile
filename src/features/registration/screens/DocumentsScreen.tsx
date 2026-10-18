import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
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

import { DocumentUpload } from '../components/DocumentUpload';
import { FormTextField } from '../components/FormTextField';
import { useRegistration } from '../RegistrationContext';
import type {
  GeneralDocuments,
  SeniorDocuments,
  StudentDocuments,
  UserType,
} from '../types';

type DocumentErrors = Record<string, string | undefined>;

const USER_TYPE_TITLES: Record<Exclude<UserType, null>, string> = {
  student: 'Student Details',
  general: 'Identity Verification',
  senior: 'Senior Citizen Details',
};

export function DocumentsScreen() {
  const insets = useSafeAreaInsets();
  const { data, setDocuments } = useRegistration();
  const userType = data.userType;
  const [errors, setErrors] = useState<DocumentErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  /**
   * The context stores documents in a shape that depends on the user type, so
   * the updater has to narrow before patching. Each branch validates that the
   * guard holds and falls through to a no-op when the shape does not match.
   */
  const updateDocuments = (patch: Partial<StudentDocuments & GeneralDocuments & SeniorDocuments>) => {
    if (!userType || !data.documents) return;
    setDocuments({ ...data.documents, ...patch } as StudentDocuments);
    const clearedKeys = Object.keys(patch) as (keyof StudentDocuments)[];
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of clearedKeys) next[key] = undefined;
      return next;
    });
  };

  const handleContinue = () => {
    setFormError(null);
    if (!userType || !data.documents) {
      router.replace('/register/user-type');
      return;
    }

    const nextErrors: DocumentErrors = {};

    if (userType === 'student') {
      const d = data.documents as StudentDocuments;
      if (!d.collegeName.trim()) nextErrors.collegeName = 'College name is required';
      if (!d.collegeAddress.trim()) nextErrors.collegeAddress = 'College address is required';
      if (!d.collegeIdNumber.trim()) nextErrors.collegeIdNumber = 'College ID card number is required';
      if (!d.collegeIdPhoto) nextErrors.collegeIdPhoto = 'College ID card photo is required';
    } else if (userType === 'general') {
      const d = data.documents as GeneralDocuments;
      if (!d.citizenshipNumber.trim()) nextErrors.citizenshipNumber = 'Citizenship certificate number is required';
      if (!d.citizenshipFrontPhoto) nextErrors.citizenshipFrontPhoto = 'Citizenship front photo is required';
    } else if (userType === 'senior') {
      const d = data.documents as SeniorDocuments;
      if (!d.seniorCardNumber.trim()) nextErrors.seniorCardNumber = 'Senior citizen card number is required';
      if (!d.seniorCardFrontPhoto) nextErrors.seniorCardFrontPhoto = 'Senior citizen card front photo is required';
    }

    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      setFormError('Please provide the required details and documents.');
      return;
    }
    router.push('/register/review');
  };

  if (!userType || !data.documents) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.centerText}>Please select a user type first.</Text>
        <PrimaryButton label="Select User Type" onPress={() => router.replace('/register/user-type')} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <View style={styles.stepIndicator}>
          <Text style={styles.stepLabel}>Step 3 of 7</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: "43%" }]} />
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
          <Text style={styles.title}>{USER_TYPE_TITLES[userType]}</Text>
          <Text style={styles.subtitle}>
            Provide your identity details so we can verify your account
          </Text>
        </View>

        {userType === 'student' && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>College Information</Text>
              <FormTextField
                label="College Name"
                placeholder="Enter your college name"
                value={(data.documents as StudentDocuments).collegeName}
                onChangeText={(text) => updateDocuments({ collegeName: text })}
                error={errors.collegeName}
                required
              />
              <FormTextField
                label="College Address"
                placeholder="City, Street"
                value={(data.documents as StudentDocuments).collegeAddress}
                onChangeText={(text) => updateDocuments({ collegeAddress: text })}
                error={errors.collegeAddress}
                required
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>College ID Card</Text>
              <FormTextField
                label="College ID Card Number"
                placeholder="Enter ID card number"
                value={(data.documents as StudentDocuments).collegeIdNumber}
                onChangeText={(text) => updateDocuments({ collegeIdNumber: text })}
                error={errors.collegeIdNumber}
                required
                keyboardType="number-pad"
              />
              <FormTextField
                label="College ID Card Expiry (if applicable)"
                placeholder="YYYY-MM-DD, or leave blank"
                value={(data.documents as StudentDocuments).collegeIdExpiry}
                onChangeText={(text) => updateDocuments({ collegeIdExpiry: text })}
                error={errors.collegeIdExpiry}
                keyboardType="numbers-and-punctuation"
              />
              <DocumentUpload
                label="College ID Card Photo"
                hint="A clear photo of your college ID card"
                value={(data.documents as StudentDocuments).collegeIdPhoto}
                onChange={(image) => updateDocuments({ collegeIdPhoto: image })}
                required
              />
            </View>
          </>
        )}

        {userType === 'general' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Citizenship</Text>
            <FormTextField
              label="Citizenship Certificate Number"
              placeholder="Enter certificate number"
              value={(data.documents as GeneralDocuments).citizenshipNumber}
              onChangeText={(text) => updateDocuments({ citizenshipNumber: text })}
              error={errors.citizenshipNumber}
              required
              keyboardType="number-pad"
            />
            <DocumentUpload
              label="Citizenship Certificate Front Photo"
              hint="A clear photo of the front page of your certificate"
              value={(data.documents as GeneralDocuments).citizenshipFrontPhoto}
              onChange={(image) => updateDocuments({ citizenshipFrontPhoto: image })}
              required
            />
            <DocumentUpload
              label="Citizenship Certificate Back Photo (if required)"
              hint="Required when the reverse side holds important details"
              value={(data.documents as GeneralDocuments).citizenshipBackPhoto}
              onChange={(image) => updateDocuments({ citizenshipBackPhoto: image })}
            />
          </View>
        )}

        {userType === 'senior' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Senior Citizen Card</Text>
            <FormTextField
              label="Senior Citizen Card Number"
              placeholder="Enter card number"
              value={(data.documents as SeniorDocuments).seniorCardNumber}
              onChangeText={(text) => updateDocuments({ seniorCardNumber: text })}
              error={errors.seniorCardNumber}
              required
              keyboardType="number-pad"
            />
            <DocumentUpload
              label="Senior Citizen Card Front Photo"
              hint="A clear photo of the front of your senior citizen card"
              value={(data.documents as SeniorDocuments).seniorCardFrontPhoto}
              onChange={(image) => updateDocuments({ seniorCardFrontPhoto: image })}
              required
            />
            <DocumentUpload
              label="Senior Citizen Card Back Photo (if required)"
              hint="Required when the reverse side holds important details"
              value={(data.documents as SeniorDocuments).seniorCardBackPhoto}
              onChange={(image) => updateDocuments({ seniorCardBackPhoto: image })}
            />
          </View>
        )}

        {formError && <Text style={styles.formError}>{formError}</Text>}

        <View style={styles.footer}>
          <PrimaryButton label="Continue" onPress={handleContinue} />
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.back()}
            style={styles.backTextButton}
          >
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Brand.white,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: Brand.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  centerText: {
    color: Brand.textSecondary,
    fontSize: 15,
    textAlign: 'center',
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
  section: {
    gap: Spacing.three,
  },
  sectionTitle: {
    color: Brand.teal.text,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  formError: {
    color: Brand.error,
    fontSize: 13,
    textAlign: 'center',
  },
  footer: {
    gap: Spacing.two,
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