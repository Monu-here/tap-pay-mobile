import {AppText, AppTextInput } from '@/components/typography/app-text';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { Monochrome, Spacing } from '@/constants/theme';
import {
  getPlatformSupportTicket,
  getPlatformSupportTickets,
  replyPlatformSupportTicket,
  updatePlatformSupportTicketStatus,
  type PlatformSupportTicket,
} from '@/features/admin/services/adminApi';

const STATUSES: PlatformSupportTicket['status'][] = ['open', 'in_progress', 'resolved', 'closed'];

export default function PlatformSupportScreen() {
  const insets = useSafeAreaInsets();
  const [tickets, setTickets] = useState<PlatformSupportTicket[]>([]);
  const [selected, setSelected] = useState<PlatformSupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [saving, setSaving] = useState(false);

  const loadQueue = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await getPlatformSupportTickets();
      if (!result.ok || !result.data) {
        setError(result.message || 'Could not load the platform support queue.');
        return;
      }
      setTickets(result.data.tickets);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Network error loading the support queue.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadQueue();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadQueue]);

  const openTicket = async (ticket: PlatformSupportTicket) => {
    setError(null);
    const result = await getPlatformSupportTicket(ticket.reference);
    if (!result.ok || !result.data) {
      setError(result.message || 'Could not load the selected request.');
      return;
    }
    setSelected(result.data.ticket);
  };

  const sendReply = async () => {
    if (!selected || reply.trim().length < 2) return;
    setSaving(true);
    setError(null);
    try {
      const result = await replyPlatformSupportTicket(selected.reference, reply.trim());
      if (!result.ok || !result.data) {
        setError(result.message || 'Reply was not sent.');
        return;
      }
      setSelected(result.data.ticket);
      setReply('');
      await loadQueue(true);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Network error sending reply.');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (status: PlatformSupportTicket['status']) => {
    if (!selected || status === selected.status) return;
    setSaving(true);
    setError(null);
    try {
      const result = await updatePlatformSupportTicketStatus(selected.reference, status);
      if (!result.ok || !result.data) {
        setError(result.message || 'Status was not updated.');
        return;
      }
      setSelected(result.data.ticket);
      await loadQueue(true);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Network error updating status.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/portal/admin' as any)} style={styles.backButton}>
          <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={18} tintColor={Monochrome.textPrimary} />
        </Pressable>
        <AppText style={styles.title}>{selected ? 'Support case' : 'Support queue'}</AppText>
        {selected ? (
          <Pressable onPress={() => setSelected(null)} style={styles.backToQueue}><AppText style={styles.backToQueueText}>Queue</AppText></Pressable>
        ) : <View style={styles.headerSpacer} />}
      </View>

      {selected ? (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 30 }]} keyboardShouldPersistTaps="handled">
            <View style={styles.caseCard}>
              <AppText style={styles.subject}>{selected.subject}</AppText>
              <AppText style={styles.meta}>#{selected.reference} · {selected.category.replaceAll('_', ' ')}</AppText>
              <AppText style={styles.meta}>{selected.requester?.name ?? `User #${selected.requester?.id ?? 'unavailable'}`} · {selected.requester?.email ?? ''}</AppText>
              {selected.transaction_reference ? <AppText style={styles.meta}>Payment reference: {selected.transaction_reference}</AppText> : null}
              <AppText style={styles.fieldLabel}>Case status</AppText>
              <View style={styles.statusChoices}>
                {STATUSES.map((status) => (
                  <Pressable key={status} disabled={saving} onPress={() => void changeStatus(status)} style={[styles.statusChoice, selected.status === status && styles.statusChoiceSelected]}>
                    <AppText style={[styles.statusChoiceText, selected.status === status && styles.statusChoiceTextSelected]}>{status.replaceAll('_', ' ')}</AppText>
                  </Pressable>
                ))}
              </View>
            </View>
            {(selected.messages ?? []).map((message) => (
              <View key={message.id} style={[styles.messageCard, message.is_staff && styles.staffMessage]}>
                <AppText style={styles.messageAuthor}>{message.is_staff ? message.author_name || 'Platform Support' : message.author_name || 'Passenger'}</AppText>
                <AppText style={styles.messageBody}>{message.body}</AppText>
                <AppText style={styles.meta}>{message.created_at ? new Date(message.created_at).toLocaleString() : ''}</AppText>
              </View>
            ))}
            {error ? <AppText accessibilityRole="alert" style={styles.errorText}>{error}</AppText> : null}
            <AppTextInput accessibilityLabel="Reply to support request" style={styles.replyInput} value={reply} onChangeText={setReply} placeholder="Reply to the passenger" placeholderTextColor={Monochrome.textMuted} multiline maxLength={2000} />
            <Pressable disabled={saving || !reply.trim()} onPress={() => void sendReply()} style={[styles.submitButton, (saving || !reply.trim()) && styles.disabled]}>
              {saving ? <ActivityIndicator color={Monochrome.actionPrimaryText} /> : <AppText style={styles.submitText}>Send reply</AppText>}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 30 }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadQueue(true)} tintColor={Monochrome.textPrimary} />}>
          {loading ? <ActivityIndicator color={Monochrome.textPrimary} style={styles.loading} /> : null}
          {error ? (
            <View style={styles.errorCard}>
              <AppText style={styles.errorText}>{error}</AppText>
              <Pressable onPress={() => void loadQueue(true)}><AppText style={styles.retryText}>Retry</AppText></Pressable>
            </View>
          ) : null}
          {!loading && !error && tickets.length === 0 ? (
            <View style={styles.emptyCard}><AppText style={styles.subject}>No support cases</AppText><AppText style={styles.meta}>New requests will appear here.</AppText></View>
          ) : null}
          {tickets.map((ticket) => (
            <Pressable key={ticket.reference} onPress={() => void openTicket(ticket)} style={styles.ticketRow}>
              <View style={styles.flex}>
                <AppText style={styles.subject}>{ticket.subject}</AppText>
                <AppText style={styles.meta}>{ticket.requester?.name ?? 'Passenger'} · {ticket.category.replaceAll('_', ' ')}</AppText>
                <AppText style={styles.meta}>#{ticket.reference}</AppText>
              </View>
              <View style={styles.statusTag}><AppText style={styles.statusTagText}>{ticket.status.replaceAll('_', ' ')}</AppText></View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Monochrome.background },
  flex: { flex: 1 },
  header: { minHeight: 58, paddingHorizontal: Spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: Monochrome.border },
  backButton: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', backgroundColor: Monochrome.surfaceSecondary, borderWidth: 1, borderColor: Monochrome.border },
  title: { color: Monochrome.textPrimary, fontSize: 18, fontWeight: '800' },
  headerSpacer: { width: 48 },
  backToQueue: { padding: 10 },
  backToQueueText: { color: Monochrome.textSecondary, fontWeight: '700' },
  content: { padding: Spacing.lg, gap: Spacing.md },
  loading: { padding: Spacing.xl },
  ticketRow: { padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderRadius: 14, borderWidth: 1, borderColor: Monochrome.border, backgroundColor: Monochrome.surfaceSecondary },
  caseCard: { padding: Spacing.md, gap: Spacing.sm, borderRadius: 16, borderWidth: 1, borderColor: Monochrome.border, backgroundColor: Monochrome.surfaceSecondary },
  subject: { color: Monochrome.textPrimary, fontSize: 15, fontWeight: '700' },
  meta: { color: Monochrome.textMuted, fontSize: 12 },
  statusTag: { paddingVertical: 6, paddingHorizontal: 9, borderRadius: 999, backgroundColor: Monochrome.surfaceElevated },
  statusTagText: { color: Monochrome.textSecondary, fontSize: 11, textTransform: 'capitalize' },
  statusChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusChoice: { paddingHorizontal: 9, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Monochrome.border, backgroundColor: Monochrome.surfacePrimary },
  statusChoiceSelected: { backgroundColor: Monochrome.actionPrimary },
  statusChoiceText: { color: Monochrome.textSecondary, fontSize: 11, textTransform: 'capitalize' },
  statusChoiceTextSelected: { color: Monochrome.actionPrimaryText, fontWeight: '700' },
  fieldLabel: { color: Monochrome.textSecondary, fontSize: 12, fontWeight: '700', marginTop: Spacing.sm },
  messageCard: { padding: Spacing.md, gap: Spacing.sm, borderRadius: 14, borderWidth: 1, borderColor: Monochrome.border, backgroundColor: Monochrome.surfaceSecondary },
  staffMessage: { backgroundColor: Monochrome.surfaceElevated },
  messageAuthor: { color: Monochrome.textPrimary, fontWeight: '700' },
  messageBody: { color: Monochrome.textSecondary, fontSize: 14, lineHeight: 20 },
  replyInput: { minHeight: 96, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Monochrome.border, backgroundColor: Monochrome.surfacePrimary, color: Monochrome.textPrimary, textAlignVertical: 'top' },
  submitButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: Monochrome.actionPrimary },
  disabled: { opacity: 0.55 },
  submitText: { color: Monochrome.actionPrimaryText, fontWeight: '700' },
  errorCard: { padding: Spacing.md, gap: Spacing.sm, backgroundColor: Monochrome.surfaceSecondary, borderRadius: 14, borderWidth: 1, borderColor: Monochrome.border },
  errorText: { color: Monochrome.textPrimary, fontSize: 13 },
  retryText: { color: Monochrome.textPrimary, fontWeight: '700' },
  emptyCard: { padding: Spacing.lg, gap: Spacing.sm, backgroundColor: Monochrome.surfaceSecondary, borderRadius: 14, borderWidth: 1, borderColor: Monochrome.border },
});
