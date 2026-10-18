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

import { AdDatePickerModal } from '../components/AdDatePickerModal';
import { BsDatePickerModal } from '../components/BsDatePickerModal';
import { DatePickerField } from '../components/DatePickerField';
import { FormTextField, VisibilityToggle } from '../components/FormTextField';
import { useRegistration } from '../RegistrationContext';
import { validatePersonalInfo } from '../validation';
import { convertAdToBs, convertBsToAd, formatBsIso, todayAdIso, type BsDate } from '../utils/nepaliDate';
import type { PersonalInfo } from '../types';

export function PersonalInfoScreen() {
  const insets = useSafeAreaInsets();
  const { data, setPersonal } = useRegistration();
  const [personal, setLocalPersonal] = useState<PersonalInfo>(data.personal);
  const [errors, setErrors] = useState<Partial<Record<keyof PersonalInfo, string>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showAdPicker, setShowAdPicker] = useState(false);
  const [showBsPicker, setShowBsPicker] = useState(false);

  const updateField = <K extends keyof PersonalInfo>(key: K, value: PersonalInfo[K]) => {
    setLocalPersonal((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const setDateError = (message: string | null) => {
    setErrors((prev) => ({ ...prev, dateOfBirthAD: message ?? undefined }));
  };

  /**
   * Bidirectional sync is done event-driven and one-directional per
   * interaction — no `useEffect` mirrors one field into the other, so there
   * is no render feedback loop. Each handler writes both fields in a single
   * update, and an invalid selection writes nothing.
   */
  const handleAdDateSelected = (adIso: string) => {
    const outcome = convertAdToBs(adIso, { rejectFuture: true });
    if (!outcome.ok) {
      setDateError(outcome.message);
      return;
    }
    setDateError(null);
    setLocalPersonal((prev) => ({
      ...prev,
      dateOfBirthAD: adIso,
      dateOfBirthBS: formatBsIso(outcome.value),
    }));
  };

  const handleBsDateSelected = (bs: BsDate) => {
    const outcome = convertBsToAd(bs, { rejectFuture: true });
    if (!outcome.ok) {
      setDateError(outcome.message);
      return;
    }
    setDateError(null);
    setLocalPersonal((prev) => ({
      ...prev,
      dateOfBirthAD: outcome.value,
      dateOfBirthBS: formatBsIso(bs),
    }));
  };

  const handleContinue = () => {
    const validationErrors = validatePersonalInfo(personal);
    setErrors(validationErrors);
    if (Object.values(validationErrors).some(Boolean)) {
      setFormError('Please review the highlighted fields and try again.');
      return;
    }
    setFormError(null);
    setPersonal(personal);
    router.push('/register/user-type');
  };

  const goBack = () => {
    router.replace('/login');
  };

  const goToLogin = () => {
    router.replace('/login');
  };

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
          onPress={goBack}
          style={styles.backButton}
        >
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <View style={styles.stepIndicator}>
          <Text style={styles.stepLabel}>Step 1 of 7</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: "14%" }]} />
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
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Enter your personal details to get started</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Details</Text>
          <FormTextField
            label="Full Name (English)"
            placeholder="Enter your full name"
            value={personal.fullNameEnglish}
            onChangeText={(text) => updateField('fullNameEnglish', text)}
            error={errors.fullNameEnglish}
            required
            autoCapitalize="words"
            textContentType="name"
          />
          <FormTextField
            label="Full Name (Nepali)"
            placeholder="पूरा नाम लेख्नुहोस्"
            value={personal.fullNameNepali}
            onChangeText={(text) => updateField('fullNameNepali', text)}
            error={errors.fullNameNepali}
            required
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <FormTextField
            label="Email Address"
            placeholder="you@example.com"
            value={personal.email}
            onChangeText={(text) => updateField('email', text)}
            error={errors.email}
            required
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
          />
          <FormTextField
            label="Phone Number"
            placeholder="+977 98XXXXXXXX"
            value={personal.phoneNumber}
            onChangeText={(text) => updateField('phoneNumber', text)}
            error={errors.phoneNumber}
            required
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            prefix="+977"
          />
         


           <FormTextField
            label="Address"
            placeholder="City, Street, Ward No."
            value={personal.address}
            onChangeText={(text) => updateField('address', text)}
            error={errors.address}
            required
            autoCapitalize="words"
            textContentType="name"
          />


        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Date of Birth</Text>
          <DatePickerField
            label="Date of Birth (AD)"
            placeholder="Select Gregorian date"
            value={personal.dateOfBirthAD || null}
            onPress={() => setShowAdPicker(true)}
            error={errors.dateOfBirthAD}
            required
            suffix="AD"
          />
          <DatePickerField
            label="Date of Birth (BS)"
            placeholder="Select Bikram Sambat date"
            value={personal.dateOfBirthBS || null}
            onPress={() => setShowBsPicker(true)}
            required
            suffix="BS"
          />
          {personal.dateOfBirthAD && personal.dateOfBirthBS && !errors.dateOfBirthAD && (
            <Text style={styles.syncHint}>
              Filled automatically from your other selection
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <FormTextField
            label="Password"
            placeholder="Create a password"
            value={personal.password}
            onChangeText={(text) => updateField('password', text)}
            error={errors.password}
            required
            secureTextEntry={!showPassword}
            textContentType="newPassword"
            trailing={
              <VisibilityToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />
            }
          />
          <FormTextField
            label="Confirm Password"
            placeholder="Re-enter your password"
            value={personal.confirmPassword}
            onChangeText={(text) => updateField('confirmPassword', text)}
            error={errors.confirmPassword}
            required
            secureTextEntry={!showConfirmPassword}
            textContentType="newPassword"
            trailing={
              <VisibilityToggle
                visible={showConfirmPassword}
                onToggle={() => setShowConfirmPassword((v) => !v)}
              />
            }
          />
        </View>

        {formError && <Text style={styles.formError}>{formError}</Text>}

        <PrimaryButton label="Continue" onPress={handleContinue} />

        <View style={styles.loginRow}>
          <Text style={styles.loginPrompt}>Already have an account?</Text>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={goToLogin}>
            <Text style={styles.loginLink}>Login</Text>
          </Pressable>
        </View>
      </ScrollView>

      <AdDatePickerModal
        visible={showAdPicker}
        value={personal.dateOfBirthAD || null}
        maximumDate={todayAdIso()}
        onCancel={() => setShowAdPicker(false)}
        onConfirm={(adIso) => {
          setShowAdPicker(false);
          handleAdDateSelected(adIso);
        }}
      />

      <BsDatePickerModal
        visible={showBsPicker}
        value={personal.dateOfBirthBS || null}
        onCancel={() => setShowBsPicker(false)}
        onConfirm={(bs) => {
          setShowBsPicker(false);
          handleBsDateSelected(bs);
        }}
      />
    </KeyboardAvoidingView>
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
    gap: Spacing.five,
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
  textArea: {
    height: 84,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    textAlignVertical: 'top',
  },
  syncHint: {
    color: Brand.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  formError: {
    color: Brand.error,
    fontSize: 13,
    textAlign: 'center',
  },
  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.two,
  },
  loginPrompt: {
    color: Brand.textSecondary,
    fontSize: 14,
  },
  loginLink: {
    color: Brand.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});