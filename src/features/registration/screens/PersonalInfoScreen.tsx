import { AppText } from '@/components/typography/app-text';
import { router } from 'expo-router';
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
import { SymbolView } from 'expo-symbols';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Palette, Spacing } from '@/constants/theme';
import { FontFamilies } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';

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
  const theme = useTheme();
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
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />

      {/* Header with step progress */}
      <View
        style={[
          styles.headerRow,
          { paddingTop: insets.top + Spacing.two, paddingHorizontal: Spacing.four },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back to login"
          hitSlop={8}
          onPress={goBack}
          style={[
            styles.backButton,
            {
              backgroundColor: theme.isDark ? '#002235' : '#FAF4EB',
              borderColor: theme.border,
            },
          ]}
        >
          <SymbolView
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            size={18}
            tintColor={theme.text}
          />
        </Pressable>

        <View style={styles.stepIndicator}>
          <AppText style={[styles.stepLabel, { color: theme.textSecondary }]}>
            Step 1 of 5
          </AppText>
          <View style={[styles.progressTrack, { backgroundColor: theme.borderLight }]}>
            <View style={[styles.progressFill, { width: '20%' }]} />
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
          <AppText style={styles.eyebrow}>eYATRA · NEPAL TRANSIT</AppText>
          <AppText style={[styles.title, { color: theme.text }]}>Create Account</AppText>
          <AppText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Enter your personal details to begin seamless transit travel
          </AppText>
        </View>

        {/* Personal Details Section */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.isDark ? '#002235' : Palette.white,
              borderColor: theme.border,
            },
          ]}
        >
          <AppText style={styles.sectionTitle}>Personal Details</AppText>
          <FormTextField
            label="Full Name (English)"
            placeholder="e.g. Aarav Sharma"
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

        {/* Contact Information Section */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.isDark ? '#002235' : Palette.white,
              borderColor: theme.border,
            },
          ]}
        >
          <AppText style={styles.sectionTitle}>Contact &amp; Address</AppText>
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
            label="Mobile Phone Number"
            placeholder="98XXXXXXXX"
            value={personal.phoneNumber}
            onChangeText={(text) => updateField('phoneNumber', text)}
            error={errors.phoneNumber}
            required
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            prefix="+977"
          />

          <FormTextField
            label="Home / Work Address"
            placeholder="e.g. Kathmandu, Ward No. 4"
            value={personal.address}
            onChangeText={(text) => updateField('address', text)}
            error={errors.address}
            required
            autoCapitalize="words"
          />
        </View>

        {/* Date of Birth Section */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.isDark ? '#002235' : Palette.white,
              borderColor: theme.border,
            },
          ]}
        >
          <AppText style={styles.sectionTitle}>Date of Birth</AppText>
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
            <AppText style={[styles.syncHint, { color: theme.textSecondary }]}>
              Filled automatically from your other calendar selection
            </AppText>
          )}
        </View>

        {/* Security Section */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.isDark ? '#002235' : Palette.white,
              borderColor: theme.border,
            },
          ]}
        >
          <AppText style={styles.sectionTitle}>Security &amp; Password</AppText>
          <FormTextField
            label="Password"
            placeholder="Create password (min. 8 characters)"
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

        {formError && (
          <View style={styles.errorBox}>
            <AppText style={styles.formError}>{formError}</AppText>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={handleContinue}
          style={styles.continueButton}
        >
          <LinearGradient
            colors={[Palette.crimsonRed, Palette.deepMaroon]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.continueGradient}
          >
            <AppText style={styles.continueText}>Continue to User Type</AppText>
            <SymbolView
              name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
              size={16}
              tintColor={Palette.white}
            />
          </LinearGradient>
        </Pressable>

        <View style={styles.loginRow}>
          <AppText style={[styles.loginPrompt, { color: theme.textSecondary }]}>
            Already have an account?
          </AppText>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={goToLogin}>
            <AppText style={styles.loginLink}>Login to eYatra</AppText>
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
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIndicator: {
    flex: 1,
    gap: Spacing.one,
  },
  stepLabel: {
    fontFamily: FontFamilies.semiBold,
    fontSize: 12,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Palette.crimsonRed,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    gap: Spacing.four,
  },
  headingBlock: {
    gap: 4,
  },
  eyebrow: {
    color: Palette.crimsonRed,
    fontFamily: FontFamilies.extraBold,
    fontSize: 11,
    letterSpacing: 1,
  },
  title: {
    fontFamily: FontFamilies.extraBold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: FontFamilies.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: Palette.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    color: Palette.crimsonRed,
    fontFamily: FontFamilies.bold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  syncHint: {
    fontFamily: FontFamilies.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  errorBox: {
    backgroundColor: '#FDF0D5',
    borderColor: Palette.crimsonRed,
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
  },
  formError: {
    color: Palette.crimsonRed,
    fontFamily: FontFamilies.medium,
    fontSize: 13,
    textAlign: 'center',
  },
  continueButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Palette.crimsonRed,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 4,
  },
  continueGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  continueText: {
    fontFamily: FontFamilies.bold,
    fontSize: 15,
    color: Palette.white,
  },
  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.two,
  },
  loginPrompt: {
    fontFamily: FontFamilies.regular,
    fontSize: 14,
  },
  loginLink: {
    color: Palette.crimsonRed,
    fontFamily: FontFamilies.bold,
    fontSize: 14,
  },
});