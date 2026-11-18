import {AppText, AppTextInput } from '@/components/typography/app-text';
import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { Brand as BaseBrand, DriverColors, Palette, Spacing } from '@/constants/theme';
import { useKeyboardDismissOnBlur } from '@/hooks/use-keyboard-dismiss-on-blur';
import {
  getConcessionApplications,
  getConcessionPolicies,
  getPassengerConcessions,
  submitConcessionApplication,
  type ConcessionApplication,
  type ConcessionSubmission,
} from '@/features/passenger/services/passengerApi';

type Category = ConcessionSubmission['category'];

const Brand = {
  ...BaseBrand,
  background: DriverColors.background,
  surfacePrimary: DriverColors.surfacePrimary,
  surfaceSecondary: DriverColors.surfaceSecondary,
  surfaceElevated: DriverColors.surfaceElevated,
  divider: DriverColors.border,
  text: DriverColors.textPrimary,
  textSecondary: DriverColors.textSecondary,
  error: '#FF8A8A',
  teal: {
    ...BaseBrand.teal,
    primary: DriverColors.actionPrimary,
    primaryDark: Palette.deepMaroon,
  },
};

export default function ConcessionScreen() {
  const insets = useSafeAreaInsets();
  useKeyboardDismissOnBlur();
  const [applications, setApplications] = useState<ConcessionApplication[]>([]);
  const [concessions, setConcessions] = useState<Record<Category, {
    status: string;
    submitted_at: string | null;
    reviewed_at: string | null;
    expires_at: string | null;
    review_note: string | null;
    discount_percentage: string | null;
    policy_version: number | null;
  }> | null>(null);
  const [policyPercentages, setPolicyPercentages] = useState<Partial<Record<Category, string>>>({});
  const [category, setCategory] = useState<Category>('student');
  const [renewalApplicationId, setRenewalApplicationId] = useState<number | null>(null);
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [studentId, setStudentId] = useState('');
  const [collegeName, setCollegeName] = useState('');
  const [collegeAddress, setCollegeAddress] = useState('');
  const [institutionType, setInstitutionType] = useState('');
  const [courseGrade, setCourseGrade] = useState('');
  const [enrollmentDate, setEnrollmentDate] = useState('');
  const [graduationDate, setGraduationDate] = useState('');
  const [expiry, setExpiry] = useState('');
  const [citizenshipNumber, setCitizenshipNumber] = useState('');
  const [citizenshipDistrict, setCitizenshipDistrict] = useState('');
  const [seniorCard, setSeniorCard] = useState('');
  const [consent, setConsent] = useState(false);
  const [document, setDocument] = useState<{ uri: string; fileName?: string; mimeType?: string } | null>(null);
  const [supportingDocument, setSupportingDocument] = useState<{ uri: string; fileName?: string; mimeType?: string } | null>(null);
  const [seniorIdDocument, setSeniorIdDocument] = useState<{ uri: string; fileName?: string; mimeType?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getConcessionApplications();
      if (!result.ok || !result.data) {
        setError(result.message || 'Unable to load concession applications.');
      } else {
        setApplications(result.data.applications);
      }
      const [summaryResult, policyResult] = await Promise.all([
        getPassengerConcessions(),
        getConcessionPolicies(),
      ]);
      if (summaryResult.ok && summaryResult.data) {
        setConcessions(summaryResult.data.concessions);
      }
      if (policyResult.ok && policyResult.data) {
        setPolicyPercentages(Object.fromEntries(
          policyResult.data.policies.map((policy) => [policy.category, policy.discount_percentage]),
        ));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load applications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void load());
    return () => cancelAnimationFrame(frame);
  }, [load]);

  const chooseDocument = async (target: 'primary' | 'supporting' | 'seniorId' = 'primary') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'application/pdf'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.uri) {
        setError('No supporting document was selected.');
        return;
      }
      const selected = {
        uri: asset.uri,
        fileName: asset.name ?? undefined,
        mimeType: asset.mimeType ?? undefined,
      };
      if (target === 'primary') setDocument(selected);
      else if (target === 'supporting') setSupportingDocument(selected);
      else setSeniorIdDocument(selected);
      setError(null);
    } catch (pickerError) {
      setError(pickerError instanceof Error ? pickerError.message : 'Unable to select a document.');
    }
  };

  const submit = async () => {
    Keyboard.dismiss();
    if (!document) {
      setError('Select a clear photo of your supporting document.');
      return;
    }
    if (!fullName.trim() || !dateOfBirth.trim() || !consent) {
      setError('Enter your name and date of birth, and confirm the information is accurate.');
      return;
    }
    if (category === 'student' && (
      !studentId.trim() || !collegeName.trim() || !institutionType.trim() ||
      !courseGrade.trim() || !enrollmentDate.trim() || !graduationDate.trim()
    )) {
      setError('Complete the student ID, institution, course, and enrollment dates.');
      return;
    }
    if (category === 'senior_citizen' && (!citizenshipNumber.trim() || !citizenshipDistrict.trim())) {
      setError('Enter your citizenship number and issuing district.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const submission: ConcessionSubmission = {
        category,
        full_name: fullName.trim(),
        date_of_birth: dateOfBirth.trim(),
        document,
        consent,
        ...(category === 'student'
          ? {
              student_id_number: studentId.trim(),
              college_name: collegeName.trim(),
              institution_type: institutionType.trim(),
              course_grade: courseGrade.trim(),
              enrollment_date: enrollmentDate.trim(),
              expected_graduation_date: graduationDate.trim(),
              ...(collegeAddress.trim() ? { college_address: collegeAddress.trim() } : {}),
              ...(expiry.trim() ? { student_id_expiry_date: expiry.trim() } : {}),
            }
          : {
              citizenship_number: citizenshipNumber.trim(),
              citizenship_issuing_district: citizenshipDistrict.trim(),
              ...(seniorCard.trim() ? { senior_card_number: seniorCard.trim() } : {}),
              ...(seniorIdDocument ? { seniorCitizenIdDocument: seniorIdDocument } : {}),
            }),
        ...(supportingDocument ? { supportingDocument } : {}),
      };
      const result = await submitConcessionApplication(submission, renewalApplicationId ?? undefined);
      if (!result.ok || !result.data) {
        setError(result.message || 'Your application could not be submitted.');
        return;
      }
      setApplications((current) => [result.data.application, ...current]);
      setDocument(null);
      setSupportingDocument(null);
      setSeniorIdDocument(null);
      setConsent(false);
      setRenewalApplicationId(null);
      Alert.alert('Application submitted', 'Your concession request is awaiting document review.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit your application.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="light" />
      <LinearGradient
        colors={['#003049', '#001824']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <AppText style={styles.backText}>‹  Back</AppText>
        </Pressable>
        <AppText style={styles.title}>Fare concession</AppText>
        <View style={styles.headerSpacer} />
      </LinearGradient>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        automaticallyAdjustKeyboardInsets
      >
        <AppText style={styles.intro}>
          Apply for a student or senior citizen travel concession. Only approved applications receive
          the currently active discount, and eligibility is verified by Gantabya Pay administrators.
        </AppText>
        <AppText style={styles.policyHint}>
          Active policy: {policyPercentages[category] ? `${policyPercentages[category]}%` : 'Not currently available'}
        </AppText>

        <AppTextInput
          accessibilityLabel="Full name"
          value={fullName}
          onChangeText={setFullName}
          placeholder="Full name as shown on your document"
          style={styles.input}
        />
        <AppTextInput
          accessibilityLabel="Date of birth"
          value={dateOfBirth}
          onChangeText={setDateOfBirth}
          placeholder="Date of birth (YYYY-MM-DD)"
          style={styles.input}
        />

        <AppText style={styles.label}>Concession category</AppText>
        <View style={styles.categoryRow}>
          {([
            ['student', 'Student'],
            ['senior_citizen', 'Senior citizen'],
          ] as const).map(([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: category === value }}
              onPress={() => setCategory(value)}
              style={[styles.category, category === value && styles.categorySelected]}
            >
              <AppText style={[styles.categoryText, category === value && styles.categoryTextSelected]}>
                {label}
              </AppText>
            </Pressable>
          ))}
        </View>

        {category === 'student' ? (
          <>
            <AppTextInput
              accessibilityLabel="Student ID number"
              value={studentId}
              onChangeText={setStudentId}
              placeholder="Student ID number"
              style={styles.input}
            />
            <AppTextInput
              accessibilityLabel="College name"
              value={collegeName}
              onChangeText={setCollegeName}
              placeholder="College or university"
              style={styles.input}
            />
            <AppTextInput
              accessibilityLabel="Institution type"
              value={institutionType}
              onChangeText={setInstitutionType}
              placeholder="Institution type (school, college, university)"
              style={styles.input}
            />
            <AppTextInput
              accessibilityLabel="Course or grade"
              value={courseGrade}
              onChangeText={setCourseGrade}
              placeholder="Course or grade"
              style={styles.input}
            />
            <AppTextInput
              accessibilityLabel="College address"
              value={collegeAddress}
              onChangeText={setCollegeAddress}
              placeholder="College address (optional)"
              style={styles.input}
            />
            <AppTextInput
              accessibilityLabel="Student ID expiry date"
              value={expiry}
              onChangeText={setExpiry}
              placeholder="Card expiry date (YYYY-MM-DD, optional)"
              style={styles.input}
            />
            <AppTextInput
              accessibilityLabel="Enrollment date"
              value={enrollmentDate}
              onChangeText={setEnrollmentDate}
              placeholder="Enrollment date (YYYY-MM-DD)"
              style={styles.input}
            />
            <AppTextInput
              accessibilityLabel="Expected graduation date"
              value={graduationDate}
              onChangeText={setGraduationDate}
              placeholder="Expected graduation date (YYYY-MM-DD)"
              style={styles.input}
            />
          </>
        ) : (
          <>
            <AppTextInput
              accessibilityLabel="Citizenship number"
              value={citizenshipNumber}
              onChangeText={setCitizenshipNumber}
              placeholder="Citizenship number"
              style={styles.input}
            />
            <AppTextInput
              accessibilityLabel="Citizenship issuing district"
              value={citizenshipDistrict}
              onChangeText={setCitizenshipDistrict}
              placeholder="Citizenship issuing district"
              style={styles.input}
            />
            <AppTextInput
              accessibilityLabel="Senior citizen ID number"
              value={seniorCard}
              onChangeText={setSeniorCard}
              placeholder="Senior citizen ID number (optional)"
              style={styles.input}
            />
            <AppText style={styles.hint}>
              Optional senior citizen ID document: {seniorIdDocument?.fileName || 'not selected'}
            </AppText>
            <Pressable accessibilityRole="button" onPress={() => void chooseDocument('seniorId')} style={styles.pick}>
              <AppText style={styles.pickText}>Choose senior citizen ID document</AppText>
            </Pressable>
          </>
        )}

        <AppText style={styles.label}>Primary verification document</AppText>
        <AppText style={styles.hint}>JPG, JPEG, PNG, or PDF. Maximum 2 MB.</AppText>
        {document ? (
          <View style={styles.previewWrap}>
            {document.mimeType?.startsWith('image/') ? (
              <Image source={{ uri: document.uri }} style={styles.preview} />
            ) : <AppText style={styles.hint}>{document.fileName || 'PDF document selected'}</AppText>}
            <Pressable accessibilityRole="button" onPress={() => setDocument(null)}>
              <AppText style={styles.removeText}>Remove document</AppText>
            </Pressable>
          </View>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => void chooseDocument()} style={styles.pick}>
            <AppText style={styles.pickText}>Choose document</AppText>
          </Pressable>
        )}
        <AppText style={styles.label}>Optional supporting document</AppText>
        <Pressable accessibilityRole="button" onPress={() => void chooseDocument('supporting')} style={styles.pick}>
          <AppText style={styles.pickText}>{supportingDocument?.fileName || 'Choose another document'}</AppText>
        </Pressable>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
          onPress={() => setConsent((checked) => !checked)}
          style={styles.consent}
        >
          <AppText style={styles.consentCheck}>{consent ? '☑' : '☐'}</AppText>
          <AppText style={styles.consentText}>
            I confirm that the information and documents submitted are accurate.
          </AppText>
        </Pressable>

        {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: saving }}
          disabled={saving}
          onPress={() => void submit()}
          style={[styles.submit, saving && styles.disabled]}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <AppText style={styles.submitText}>Submit for review</AppText>}
        </Pressable>

        <AppText style={styles.sectionTitle}>Your applications</AppText>
        {concessions?.[category] ? (
          <View style={styles.application}>
            <AppText style={styles.applicationTitle}>
              Current status: {concessions[category].status.replaceAll('_', ' ').toUpperCase()}
            </AppText>
            {concessions[category].discount_percentage ? (
              <AppText style={styles.approved}>
                Active concession: {concessions[category].discount_percentage}%
              </AppText>
            ) : null}
            {concessions[category].expires_at ? (
              <AppText style={styles.hint}>
                Expires {new Date(concessions[category].expires_at!).toLocaleDateString()}
              </AppText>
            ) : null}
            {concessions[category].review_note ? (
              <AppText style={styles.reviewNote}>{concessions[category].review_note}</AppText>
            ) : null}
            {['approved', 'expired', 'rejected'].includes(concessions[category].status) ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  const previous = applications.find((item) => item.category === category);
                  if (previous) setRenewalApplicationId(previous.id);
                }}
                style={styles.pick}
              >
                <AppText style={styles.pickText}>
                  {renewalApplicationId ? 'Renewal selected' : 'Renew / re-verify'}
                </AppText>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {loading ? (
          <ActivityIndicator color={Brand.teal.primary} />
        ) : applications.length === 0 ? (
          <AppText style={styles.hint}>No concession applications yet.</AppText>
        ) : applications.map((application) => (
          <View key={application.id} style={styles.application}>
            <View style={styles.applicationTop}>
              <AppText style={styles.applicationTitle}>
                {application.category === 'student' ? 'Student' : 'Senior citizen'}
              </AppText>
              <AppText style={[styles.status, application.status === 'approved' && styles.approved,
                application.status === 'rejected' && styles.rejected]}>
                {application.status.replace('_', ' ').toUpperCase()}
              </AppText>
            </View>
            <AppText style={styles.hint}>
              Submitted {new Date(application.submitted_at).toLocaleDateString()}
            </AppText>
            {application.review_note ? (
              <AppText style={styles.reviewNote}>Review note: {application.review_note}</AppText>
            ) : null}
          </View>
        ))}
      </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.background },
  header: {
    minHeight: 54, paddingHorizontal: Spacing.three, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.two,
  },
  formScroll: { flex: 1 },
  back: { minWidth: 70, paddingVertical: Spacing.two },
  backText: { color: Palette.warmCream, fontSize: 16, fontWeight: '600' },
  title: { color: Brand.text, fontSize: 18, fontWeight: '700' },
  headerSpacer: { width: 70 },
  content: { padding: Spacing.three, gap: Spacing.two },
  intro: { color: Brand.textSecondary, lineHeight: 21, marginBottom: Spacing.two },
  policyHint: { color: DriverColors.textSecondary, fontWeight: '700' },
  label: { color: Brand.text, fontSize: 14, fontWeight: '700', marginTop: Spacing.one },
  categoryRow: { flexDirection: 'row', gap: Spacing.two },
  category: {
    flex: 1, borderWidth: 1, borderColor: Brand.divider, borderRadius: 12,
    padding: Spacing.two, alignItems: 'center', backgroundColor: Brand.surfacePrimary,
  },
  categorySelected: { borderColor: DriverColors.actionPrimary, backgroundColor: Brand.surfaceElevated },
  categoryText: { color: Brand.textSecondary, fontWeight: '600' },
  categoryTextSelected: { color: DriverColors.textPrimary },
  input: {
    backgroundColor: Brand.surfacePrimary, borderWidth: 1, borderColor: Brand.divider,
    borderRadius: 12, paddingHorizontal: Spacing.two, paddingVertical: 13,
    color: Brand.text,
  },
  hint: { color: Brand.textSecondary, fontSize: 13, lineHeight: 19 },
  pick: {
    borderStyle: 'dashed', borderWidth: 1, borderColor: DriverColors.border,
    borderRadius: 12, minHeight: 58, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Brand.surfacePrimary,
  },
  pickText: { color: DriverColors.textPrimary, fontWeight: '700' },
  previewWrap: { gap: Spacing.one },
  consent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  consentCheck: { color: DriverColors.actionPrimary, fontSize: 20 },
  consentText: { flex: 1, color: Brand.text, lineHeight: 20 },
  preview: { height: 180, borderRadius: 12, backgroundColor: Brand.surfacePrimary },
  removeText: { color: Brand.error, fontWeight: '600', paddingVertical: Spacing.one },
  error: { color: Brand.error, lineHeight: 20 },
  submit: {
    backgroundColor: DriverColors.actionPrimary, minHeight: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginTop: Spacing.one,
  },
  disabled: { opacity: 0.65 },
  submitText: { color: DriverColors.actionPrimaryText, fontWeight: '700', fontSize: 15 },
  sectionTitle: { color: Brand.text, fontSize: 17, fontWeight: '700', marginTop: Spacing.four },
  application: { backgroundColor: Brand.surfacePrimary, borderWidth: 1, borderColor: Brand.divider, borderRadius: 12, padding: Spacing.two, gap: Spacing.one },
  applicationTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  applicationTitle: { color: Brand.text, fontWeight: '700' },
  status: { color: '#F0C878', fontSize: 11, fontWeight: '800' },
  approved: { color: '#9FE2C0' },
  rejected: { color: Brand.error },
  reviewNote: { color: Brand.text, lineHeight: 19 },
});
