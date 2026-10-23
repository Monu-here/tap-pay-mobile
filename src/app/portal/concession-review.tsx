import {AppText, AppTextInput } from '@/components/typography/app-text';
import { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand, Spacing } from '@/constants/theme';
import { getSession } from '@/features/auth/session';
import {
  getPlatformConcessionApplications,
  reviewPlatformConcessionApplication,
  type PlatformConcessionApplication,
} from '@/features/admin/services/adminApi';
import { API_BASE_URL } from '@/config/api';

type Status = PlatformConcessionApplication['status'];

export default function ConcessionReviewScreen() {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<Status>('pending');
  const [applications, setApplications] = useState<PlatformConcessionApplication[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getPlatformConcessionApplications(status);
      if (!result.ok || !result.data) {
        setError(result.message || 'Unable to load concession applications.');
      } else {
        setApplications(result.data);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load applications.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void load());
    return () => cancelAnimationFrame(frame);
  }, [load]);

  const decide = async (
    application: PlatformConcessionApplication,
    decision: 'approved' | 'rejected',
  ) => {
    const reviewNote = notes[application.id]?.trim() ?? '';
    if (decision === 'rejected' && !reviewNote) {
      setError('A review note explaining the rejection is required.');
      return;
    }
    setBusyId(application.id);
    setError(null);
    try {
      const result = await reviewPlatformConcessionApplication(
        application.id,
        decision,
        reviewNote || undefined,
      );
      if (!result.ok || !result.data) {
        setError(result.message || 'The application could not be reviewed.');
        return;
      }
      setApplications((current) => current.filter((item) => item.id !== application.id));
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Unable to review the application.');
    } finally {
      setBusyId(null);
    }
  };

  const token = getSession().token;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <AppText style={styles.backText}>‹  Back</AppText>
        </Pressable>
        <AppText style={styles.title}>Concession review</AppText>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.filters}>
        {(['pending', 'approved', 'rejected'] as const).map((item) => (
          <Pressable
            key={item}
            accessibilityRole="button"
            accessibilityState={{ selected: status === item }}
            onPress={() => setStatus(item)}
            style={[styles.filter, status === item && styles.filterActive]}
          >
            <AppText style={[styles.filterText, status === item && styles.filterTextActive]}>
              {item.charAt(0).toUpperCase() + item.slice(1)}
            </AppText>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
        {loading ? <ActivityIndicator color={Brand.teal.primary} /> : applications.length === 0 ? (
          <AppText style={styles.empty}>No {status} applications.</AppText>
        ) : applications.map((application) => (
          <View key={application.id} style={styles.card}>
            <AppText style={styles.cardTitle}>
              {application.category === 'student' ? 'Student concession' : 'Senior citizen concession'}
            </AppText>
            <AppText style={styles.info}>{application.user?.name_en || application.user?.name || 'Passenger'}</AppText>
            <AppText style={styles.info}>{application.user?.email ?? ''}</AppText>
            <AppText style={styles.info}>
              {application.category === 'student'
                ? `${application.details.college_name ?? ''} · ID ${application.details.college_id_number ?? ''}`
                : `Card ${application.details.senior_citizen_card_number ?? ''}`}
            </AppText>
            {application.details.college_address ? (
              <AppText style={styles.info}>{application.details.college_address}</AppText>
            ) : null}
            {application.document && application.user ? (
              <Image
                accessibilityLabel="Private supporting identity document"
                source={{
                  uri: `${API_BASE_URL}/platform/users/${application.user.id}/documents/${application.document.id}`,
                  headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                }}
                resizeMode="contain"
                style={styles.document}
              />
            ) : (
              <AppText style={styles.error}>Supporting document is unavailable.</AppText>
            )}
            <AppText style={styles.info}>
              Submitted {new Date(application.submitted_at).toLocaleString()}
            </AppText>
            {application.status === 'pending' ? (
              <>
                <AppTextInput
                  accessibilityLabel={`Review note for application ${application.id}`}
                  value={notes[application.id] ?? ''}
                  onChangeText={(value) => setNotes((current) => ({ ...current, [application.id]: value }))}
                  placeholder="Rejection reason (required to reject)"
                  multiline
                  style={styles.note}
                />
                {busyId === application.id ? (
                  <ActivityIndicator color={Brand.teal.primary} />
                ) : (
                  <View style={styles.actions}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void decide(application, 'approved')}
                      style={[styles.action, styles.approve]}
                    >
                      <AppText style={styles.actionText}>Approve</AppText>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void decide(application, 'rejected')}
                      style={[styles.action, styles.reject]}
                    >
                      <AppText style={styles.actionText}>Reject</AppText>
                    </Pressable>
                  </View>
                )}
              </>
            ) : application.review_note ? (
              <AppText style={styles.info}>Review note: {application.review_note}</AppText>
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
  filters: { flexDirection: 'row', gap: Spacing.one, paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  filter: { borderRadius: 18, borderWidth: 1, borderColor: Brand.divider, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  filterActive: { borderColor: Brand.teal.primary, backgroundColor: '#EAF7F6' },
  filterText: { color: Brand.textSecondary, fontWeight: '600' },
  filterTextActive: { color: Brand.teal.primary },
  content: { padding: Spacing.three, gap: Spacing.two },
  card: { backgroundColor: '#fff', borderRadius: 14, borderColor: Brand.divider, borderWidth: 1, padding: Spacing.two, gap: Spacing.one },
  cardTitle: { color: Brand.text, fontSize: 16, fontWeight: '700' },
  info: { color: Brand.textSecondary, lineHeight: 19 },
  document: { width: '100%', height: 240, backgroundColor: '#F3F4F6', borderRadius: 10 },
  note: { minHeight: 70, borderWidth: 1, borderColor: Brand.divider, borderRadius: 10, padding: Spacing.two, color: Brand.text, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { flex: 1, borderRadius: 10, padding: Spacing.two, alignItems: 'center' },
  approve: { backgroundColor: Brand.teal.primary },
  reject: { backgroundColor: Brand.error },
  actionText: { color: '#fff', fontWeight: '700' },
  empty: { color: Brand.textSecondary, textAlign: 'center', padding: Spacing.four },
  error: { color: Brand.error, lineHeight: 20 },
});
