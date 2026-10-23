import {AppText, AppTextInput } from '@/components/typography/app-text';
import { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import {
  getCompanyRoutes,
  getCompanyServiceNotices,
  publishCompanyServiceNotice,
  resolveCompanyServiceNotice,
  type CompanyRoute,
  type CompanyServiceNotice,
} from '@/features/admin/services/adminApi';

const SEVERITIES: CompanyServiceNotice['severity'][] = [
  'information',
  'delay',
  'disruption',
  'closure',
];

export default function CompanyNoticesScreen() {
  const insets = useSafeAreaInsets();
  const [notices, setNotices] = useState<CompanyServiceNotice[]>([]);
  const [routes, setRoutes] = useState<CompanyRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<CompanyServiceNotice['severity']>('information');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyNoticeId, setBusyNoticeId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [noticeResult, routeResult] = await Promise.all([
        getCompanyServiceNotices(),
        getCompanyRoutes(),
      ]);
      if (!noticeResult.ok || !noticeResult.data) {
        setError(noticeResult.message || 'Unable to load company service notices.');
        return;
      }
      if (!routeResult.ok || !routeResult.data) {
        setError(routeResult.message || 'Unable to load company routes.');
        return;
      }
      setNotices(noticeResult.data.notices);
      setRoutes(routeResult.data.routes);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Network error loading service notices.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void load());
    return () => cancelAnimationFrame(frame);
  }, [load]);

  const publish = async () => {
    if (!title.trim() || !message.trim()) {
      setError('Enter both a title and a message before publishing.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await publishCompanyServiceNotice({
        ...(selectedRouteId !== null ? { route_id: selectedRouteId } : {}),
        title: title.trim(),
        message: message.trim(),
        severity,
        starts_at: new Date().toISOString(),
      });
      if (!result.ok || !result.data) {
        setError(result.message || 'The service notice was not published.');
        return;
      }
      setNotices((current) => [result.data.notice, ...current]);
      setTitle('');
      setMessage('');
      setSeverity('information');
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'Network error publishing the notice.');
    } finally {
      setSaving(false);
    }
  };

  const resolve = async (notice: CompanyServiceNotice) => {
    setBusyNoticeId(notice.id);
    setError(null);
    try {
      const result = await resolveCompanyServiceNotice(notice.id);
      if (!result.ok || !result.data) {
        setError(result.message || 'The service notice could not be resolved.');
        return;
      }
      setNotices((current) => current.map((item) => item.id === notice.id ? result.data.notice : item));
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : 'Network error resolving the notice.');
    } finally {
      setBusyNoticeId(null);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.canGoBack() ? router.back() : router.replace('/portal/company')}
          style={styles.backButton}
        >
          <AppText style={styles.backText}>‹ Company</AppText>
        </Pressable>
        <AppText style={styles.title}>Service notices</AppText>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.card}>
          <AppText style={styles.sectionTitle}>Publish an update</AppText>
          <AppText style={styles.helper}>Notices are visible to passengers while active and are recorded with your company account.</AppText>
          <AppTextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Notice title"
            placeholderTextColor="#90949B"
            maxLength={120}
            style={styles.input}
            accessibilityLabel="Notice title"
          />
          <AppTextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Explain the delay, disruption, or service change"
            placeholderTextColor="#90949B"
            multiline
            maxLength={5000}
            textAlignVertical="top"
            style={[styles.input, styles.messageInput]}
            accessibilityLabel="Notice message"
          />
          <AppText style={styles.label}>Route scope</AppText>
          <View style={styles.options}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setSelectedRouteId(null)}
              style={[styles.option, selectedRouteId === null && styles.optionActive]}
            >
              <AppText style={[styles.optionText, selectedRouteId === null && styles.optionTextActive]}>All routes</AppText>
            </Pressable>
            {routes.map((route) => (
              <Pressable
                key={route.id}
                accessibilityRole="button"
                onPress={() => setSelectedRouteId(route.id)}
                style={[styles.option, selectedRouteId === route.id && styles.optionActive]}
              >
                <AppText style={[styles.optionText, selectedRouteId === route.id && styles.optionTextActive]}>{route.name}</AppText>
              </Pressable>
            ))}
          </View>
          <AppText style={styles.label}>Severity</AppText>
          <View style={styles.options}>
            {SEVERITIES.map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                onPress={() => setSeverity(value)}
                style={[styles.option, severity === value && styles.optionActive]}
              >
                <AppText style={[styles.optionText, severity === value && styles.optionTextActive]}>
                  {value.replaceAll('_', ' ')}
                </AppText>
              </Pressable>
            ))}
          </View>
          {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => void publish()} style={styles.primaryButton}>
            {saving
              ? <ActivityIndicator color="#FFFFFF" />
              : <AppText style={styles.primaryButtonText}>Publish passenger notice</AppText>}
          </Pressable>
        </View>

        <View style={styles.listHeader}>
          <AppText style={styles.sectionTitle}>Company notice history</AppText>
          <Pressable accessibilityRole="button" onPress={() => void load()}>
            <AppText style={styles.refreshText}>Refresh</AppText>
          </Pressable>
        </View>
        {loading ? (
          <ActivityIndicator color={Brand.white} style={styles.loader} />
        ) : notices.length === 0 ? (
          <AppText style={styles.empty}>No service notices have been published.</AppText>
        ) : notices.map((notice) => (
          <View key={notice.id} style={styles.noticeCard}>
            <View style={styles.noticeHeading}>
              <AppText style={styles.noticeTitle}>{notice.title}</AppText>
              <AppText style={styles.status}>{notice.status.toUpperCase()}</AppText>
            </View>
            <AppText style={styles.noticeMeta}>
              {notice.severity.toUpperCase()} · {notice.route?.name ?? 'All routes'} · {new Date(notice.starts_at).toLocaleString()}
            </AppText>
            <AppText style={styles.noticeMessage}>{notice.message}</AppText>
            {notice.status === 'published' ? (
              <Pressable
                accessibilityRole="button"
                disabled={busyNoticeId === notice.id}
                onPress={() => void resolve(notice)}
                style={styles.resolveButton}
              >
                <AppText style={styles.resolveText}>{busyNoticeId === notice.id ? 'Updating…' : 'Resolve notice'}</AppText>
              </Pressable>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111318' },
  header: { paddingHorizontal: 18, paddingVertical: 14, gap: 8 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { color: '#D1D4D8', fontSize: 14, fontWeight: '600' },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  content: { paddingHorizontal: 16, gap: 14 },
  card: { padding: 16, borderRadius: 14, backgroundColor: '#1B1E24', gap: 12 },
  sectionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  helper: { color: '#A8ADB5', fontSize: 12, lineHeight: 18 },
  input: { color: '#FFFFFF', borderColor: '#3A3E46', borderWidth: 1, borderRadius: 9, padding: 11, fontSize: 14 },
  messageInput: { minHeight: 92 },
  label: { color: '#C7CBD1', fontSize: 12, fontWeight: '700' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  option: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#41454D' },
  optionActive: { borderColor: '#FFFFFF', backgroundColor: '#343841' },
  optionText: { color: '#BFC3C9', fontSize: 11, textTransform: 'capitalize' },
  optionTextActive: { color: '#FFFFFF', fontWeight: '700' },
  primaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#30343C' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  error: { color: '#FFB3B3', fontSize: 12 },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  refreshText: { color: '#D1D4D8', fontSize: 12, fontWeight: '700' },
  loader: { padding: 18 },
  empty: { color: '#A8ADB5', fontSize: 13, paddingVertical: 12 },
  noticeCard: { padding: 14, borderRadius: 12, backgroundColor: '#1B1E24', gap: 8 },
  noticeHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  noticeTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', flex: 1 },
  status: { color: '#BFC3C9', fontSize: 10, fontWeight: '700' },
  noticeMeta: { color: '#A8ADB5', fontSize: 10 },
  noticeMessage: { color: '#E0E2E5', fontSize: 13, lineHeight: 19 },
  resolveButton: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 7, borderWidth: 1, borderColor: '#41454D' },
  resolveText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
});
