import {AppText, AppTextInput } from '@/components/typography/app-text';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand, Spacing } from '@/constants/theme';
import {
  getConcessionApplications,
  submitConcessionApplication,
  type ConcessionApplication,
  type ConcessionSubmission,
} from '@/features/passenger/services/passengerApi';

type Category = ConcessionSubmission['category'];

export default function ConcessionScreen() {
  const insets = useSafeAreaInsets();
  const [applications, setApplications] = useState<ConcessionApplication[]>([]);
  const [category, setCategory] = useState<Category>('student');
  const [studentId, setStudentId] = useState('');
  const [collegeName, setCollegeName] = useState('');
  const [collegeAddress, setCollegeAddress] = useState('');
  const [expiry, setExpiry] = useState('');
  const [seniorCard, setSeniorCard] = useState('');
  const [document, setDocument] = useState<{ uri: string; fileName?: string; mimeType?: string } | null>(null);
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

  const chooseDocument = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('Allow photo library access to select your supporting document.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
        exif: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.uri) {
        setError('No document image was selected.');
        return;
      }
      setDocument({
        uri: asset.uri,
        fileName: asset.fileName ?? undefined,
        mimeType: asset.mimeType ?? undefined,
      });
      setError(null);
    } catch (pickerError) {
      setError(pickerError instanceof Error ? pickerError.message : 'Unable to select an image.');
    }
  };

  const submit = async () => {
    if (!document) {
      setError('Select a clear photo of your supporting document.');
      return;
    }
    if (category === 'student' && (!studentId.trim() || !collegeName.trim())) {
      setError('Enter your student ID number and college name.');
      return;
    }
    if (category === 'senior_citizen' && !seniorCard.trim()) {
      setError('Enter your senior citizen card number.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const submission: ConcessionSubmission = {
        category,
        document,
        ...(category === 'student'
          ? {
              student_id_number: studentId.trim(),
              college_name: collegeName.trim(),
              ...(collegeAddress.trim() ? { college_address: collegeAddress.trim() } : {}),
              ...(expiry.trim() ? { student_id_expiry_date: expiry.trim() } : {}),
            }
          : { senior_card_number: seniorCard.trim() }),
      };
      const result = await submitConcessionApplication(submission);
      if (!result.ok || !result.data) {
        setError(result.message || 'Your application could not be submitted.');
        return;
      }
      setApplications((current) => [result.data.application, ...current]);
      setDocument(null);
      Alert.alert('Application submitted', 'Your concession request is awaiting document review.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit your application.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <AppText style={styles.backText}>‹  Back</AppText>
        </Pressable>
        <AppText style={styles.title}>Fare concession</AppText>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <AppText style={styles.intro}>
          Submit your student or senior citizen card for review. Any fare concession is applied only
          after the transport operator verifies your information.
        </AppText>

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
          </>
        ) : (
          <AppTextInput
            accessibilityLabel="Senior citizen card number"
            value={seniorCard}
            onChangeText={setSeniorCard}
            placeholder="Senior citizen card number"
            style={styles.input}
          />
        )}

        <AppText style={styles.label}>Supporting card photo</AppText>
        <AppText style={styles.hint}>A clear JPG or PNG image, up to 2 MB.</AppText>
        {document ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri: document.uri }} style={styles.preview} />
            <Pressable accessibilityRole="button" onPress={() => setDocument(null)}>
              <AppText style={styles.removeText}>Remove photo</AppText>
            </Pressable>
          </View>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => void chooseDocument()} style={styles.pick}>
            <AppText style={styles.pickText}>Choose card photo</AppText>
          </Pressable>
        )}

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.background },
  header: {
    minHeight: 54, paddingHorizontal: Spacing.three, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  back: { minWidth: 70, paddingVertical: Spacing.two },
  backText: { color: Brand.teal.primary, fontSize: 16, fontWeight: '600' },
  title: { color: Brand.text, fontSize: 18, fontWeight: '700' },
  headerSpacer: { width: 70 },
  content: { padding: Spacing.three, gap: Spacing.two },
  intro: { color: Brand.textSecondary, lineHeight: 21, marginBottom: Spacing.two },
  label: { color: Brand.text, fontSize: 14, fontWeight: '700', marginTop: Spacing.one },
  categoryRow: { flexDirection: 'row', gap: Spacing.two },
  category: {
    flex: 1, borderWidth: 1, borderColor: Brand.divider, borderRadius: 12,
    padding: Spacing.two, alignItems: 'center', backgroundColor: '#fff',
  },
  categorySelected: { borderColor: Brand.teal.primary, backgroundColor: '#EAF7F6' },
  categoryText: { color: Brand.textSecondary, fontWeight: '600' },
  categoryTextSelected: { color: Brand.teal.primary },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: Brand.divider,
    borderRadius: 12, paddingHorizontal: Spacing.two, paddingVertical: 13,
    color: Brand.text,
  },
  hint: { color: Brand.textSecondary, fontSize: 13, lineHeight: 19 },
  pick: {
    borderStyle: 'dashed', borderWidth: 1, borderColor: Brand.teal.primary,
    borderRadius: 12, minHeight: 58, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff',
  },
  pickText: { color: Brand.teal.primary, fontWeight: '700' },
  previewWrap: { gap: Spacing.one },
  preview: { height: 180, borderRadius: 12, backgroundColor: '#fff' },
  removeText: { color: Brand.error, fontWeight: '600', paddingVertical: Spacing.one },
  error: { color: Brand.error, lineHeight: 20 },
  submit: {
    backgroundColor: Brand.teal.primary, minHeight: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginTop: Spacing.one,
  },
  disabled: { opacity: 0.65 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  sectionTitle: { color: Brand.text, fontSize: 17, fontWeight: '700', marginTop: Spacing.four },
  application: { backgroundColor: '#fff', borderWidth: 1, borderColor: Brand.divider, borderRadius: 12, padding: Spacing.two, gap: Spacing.one },
  applicationTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  applicationTitle: { color: Brand.text, fontWeight: '700' },
  status: { color: '#9A6700', fontSize: 11, fontWeight: '800' },
  approved: { color: '#16803C' },
  rejected: { color: Brand.error },
  reviewNote: { color: Brand.text, lineHeight: 19 },
});
