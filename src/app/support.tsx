import {AppText, AppTextInput } from '@/components/typography/app-text';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
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
  createSupportTicket,
  getSupportTicket,
  getSupportTickets,
  replyToSupportTicket,
  type SupportTicket,
} from '@/features/passenger/services/passengerApi';

const CATEGORIES: { id: SupportTicket['category']; label: string }[] = [
  { id: 'payment_dispute', label: 'Payment dispute' },
  { id: 'wallet', label: 'Wallet' },
  { id: 'card', label: 'Transit card' },
  { id: 'journey', label: 'Journey' },
  { id: 'account', label: 'Account' },
  { id: 'other', label: 'Other' },
];

function statusLabel(status: SupportTicket['status']): string {
  return status.replaceAll('_', ' ');
}

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [category, setCategory] = useState<SupportTicket['category']>('other');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [transactionReference, setTransactionReference] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);

  const loadTickets = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);
    try {
      const result = await getSupportTickets();
      if (!result.ok || !result.data) {
        setLoadError(result.message || 'Could not load your support requests.');
        return;
      }
      setTickets(result.data.tickets);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Network error loading support requests.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadTickets();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadTickets]);

  const openTicket = async (ticket: SupportTicket) => {
    setLoadError(null);
    const result = await getSupportTicket(ticket.reference);
    if (!result.ok || !result.data) {
      setLoadError(result.message || 'Could not load this support request.');
      return;
    }
    setSelected(result.data.ticket);
  };

  const submitTicket = async () => {
    setFormError(null);
    if (subject.trim().length < 5 || message.trim().length < 10) {
      setFormError('Add a subject and at least 10 characters describing the issue.');
      return;
    }
    if (category === 'payment_dispute' && transactionReference.trim().length !== 26) {
      setFormError('Enter the 26-character Tap & Pay transaction reference for the payment.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createSupportTicket({
        category,
        subject: subject.trim(),
        message: message.trim(),
        ...(category === 'payment_dispute' ? { transaction_reference: transactionReference.trim() } : {}),
      });
      if (!result.ok || !result.data) {
        setFormError(result.message || 'Could not submit your request.');
        return;
      }
      setCreateVisible(false);
      setSubject('');
      setMessage('');
      setTransactionReference('');
      await loadTickets(true);
      setSelected(result.data.ticket);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Network error submitting your request.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitReply = async () => {
    if (!selected || reply.trim().length < 2) {
      Alert.alert('Reply required', 'Enter a message before sending your reply.');
      return;
    }
    setReplying(true);
    try {
      const result = await replyToSupportTicket(selected.reference, reply.trim());
      if (!result.ok || !result.data) {
        Alert.alert('Reply not sent', result.message || 'Please try again.');
        return;
      }
      setSelected(result.data.ticket);
      setReply('');
      await loadTickets(true);
    } catch (error) {
      Alert.alert('Reply not sent', error instanceof Error ? error.message : 'Network error.');
    } finally {
      setReplying(false);
    }
  };

  const closeCreate = () => {
    if (submitting) return;
    if (subject || message || transactionReference) {
      Alert.alert('Discard this request?', 'Your unsent support request will be discarded.', [
        { text: 'Continue editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setSubject('');
            setMessage('');
            setTransactionReference('');
            setFormError(null);
            setCreateVisible(false);
          },
        },
      ]);
      return;
    }
    setCreateVisible(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        {selected ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back to support requests" onPress={() => setSelected(null)} style={styles.iconButton}>
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={18} tintColor={Monochrome.textPrimary} />
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/home')} style={styles.iconButton}>
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={18} tintColor={Monochrome.textPrimary} />
          </Pressable>
        )}
        <AppText style={styles.headerTitle}>{selected ? 'Support request' : 'Help & support'}</AppText>
        {!selected ? (
          <Pressable accessibilityRole="button" onPress={() => { setFormError(null); setCreateVisible(true); }} style={styles.newButton}>
            <AppText style={styles.newButtonText}>New</AppText>
          </Pressable>
        ) : <View style={styles.headerRightPlaceholder} />}
      </View>

      {selected ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]} keyboardShouldPersistTaps="handled">
          <View style={styles.ticketHeaderCard}>
            <AppText style={styles.ticketSubject}>{selected.subject}</AppText>
            <AppText style={styles.ticketMeta}>#{selected.reference} · {statusLabel(selected.status)}</AppText>
            <AppText style={styles.ticketMeta}>{CATEGORIES.find((item) => item.id === selected.category)?.label ?? selected.category}</AppText>
            {selected.transaction_reference ? <AppText style={styles.ticketMeta}>Payment reference: {selected.transaction_reference}</AppText> : null}
          </View>
          {(selected.messages ?? []).map((item) => (
            <View key={item.id} style={[styles.messageCard, item.is_staff && styles.staffMessage]}>
              <AppText style={styles.messageAuthor}>{item.is_staff ? 'Tap & Pay Support' : 'You'}</AppText>
              <AppText style={styles.messageBody}>{item.body}</AppText>
              <AppText style={styles.ticketMeta}>{item.created_at ? new Date(item.created_at).toLocaleString() : 'Time unavailable'}</AppText>
            </View>
          ))}
          {selected.status === 'closed' ? (
            <AppText style={styles.helperText}>This request is closed. Create a new request if you need more help.</AppText>
          ) : (
            <View style={styles.replyBox}>
              <AppTextInput
                accessibilityLabel="Support reply"
                style={styles.input}
                value={reply}
                onChangeText={setReply}
                placeholder="Write a reply"
                placeholderTextColor={Monochrome.textMuted}
                multiline
                maxLength={2000}
              />
              <Pressable accessibilityRole="button" disabled={replying || !reply.trim()} onPress={() => void submitReply()} style={[styles.submitButton, (replying || !reply.trim()) && styles.disabledButton]}>
                {replying ? <ActivityIndicator color={Monochrome.actionPrimaryText} /> : <AppText style={styles.submitText}>Send reply</AppText>}
              </Pressable>
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadTickets(true)} tintColor={Monochrome.textPrimary} />}
        >
          <AppText style={styles.intro}>Track payment disputes and other questions directly with Tap & Pay Support.</AppText>
          {loading ? <ActivityIndicator color={Monochrome.textPrimary} style={styles.loading} /> : null}
          {loadError ? (
            <View style={styles.errorCard}>
              <AppText style={styles.errorText}>{loadError}</AppText>
              <Pressable onPress={() => void loadTickets(true)}><AppText style={styles.retryText}>Retry</AppText></Pressable>
            </View>
          ) : null}
          {!loading && !loadError && tickets.length === 0 ? (
            <View style={styles.emptyCard}>
              <AppText style={styles.emptyTitle}>No support requests yet</AppText>
              <AppText style={styles.helperText}>Your requests and staff replies will appear here.</AppText>
            </View>
          ) : null}
          {tickets.map((ticket) => (
            <Pressable key={ticket.reference} accessibilityRole="button" onPress={() => void openTicket(ticket)} style={styles.ticketRow}>
              <View style={styles.ticketRowMain}>
                <AppText style={styles.ticketSubject}>{ticket.subject}</AppText>
                <AppText style={styles.ticketMeta}>{CATEGORIES.find((item) => item.id === ticket.category)?.label ?? ticket.category} · #{ticket.reference}</AppText>
                {ticket.transaction_reference ? <AppText style={styles.ticketMeta}>Payment {ticket.transaction_reference}</AppText> : null}
              </View>
              <View style={styles.statusPill}><AppText style={styles.statusText}>{statusLabel(ticket.status)}</AppText></View>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Modal visible={createVisible} transparent animationType="slide" onRequestClose={closeCreate}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + Spacing.md }]}>
            <View style={styles.modalHeader}>
              <View>
                <AppText style={styles.modalTitle}>New support request</AppText>
                <AppText style={styles.helperText}>Our team can review the request and reply here.</AppText>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close support form" onPress={closeCreate} style={styles.iconButton}>
                <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={18} tintColor={Monochrome.textPrimary} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formContent}>
              <AppText style={styles.fieldLabel}>Issue category</AppText>
              <View style={styles.categoryWrap}>
                {CATEGORIES.map((item) => (
                  <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: category === item.id }} onPress={() => setCategory(item.id)} style={[styles.categoryChip, category === item.id && styles.categoryChipSelected]}>
                    <AppText style={[styles.categoryText, category === item.id && styles.categoryTextSelected]}>{item.label}</AppText>
                  </Pressable>
                ))}
              </View>
              {category === 'payment_dispute' ? (
                <>
                  <AppText style={styles.fieldLabel}>Tap & Pay transaction reference</AppText>
                  <AppTextInput accessibilityLabel="Transaction reference" style={styles.input} value={transactionReference} onChangeText={setTransactionReference} placeholder="26-character wallet reference" placeholderTextColor={Monochrome.textMuted} autoCapitalize="characters" maxLength={26} />
                </>
              ) : null}
              <AppText style={styles.fieldLabel}>Subject</AppText>
              <AppTextInput accessibilityLabel="Support request subject" style={styles.input} value={subject} onChangeText={setSubject} placeholder="Briefly describe the issue" placeholderTextColor={Monochrome.textMuted} maxLength={120} />
              <AppText style={styles.fieldLabel}>Details</AppText>
              <AppTextInput accessibilityLabel="Support request details" style={[styles.input, styles.messageInput]} value={message} onChangeText={setMessage} placeholder="Include dates and relevant details. Do not include passwords or OTPs." placeholderTextColor={Monochrome.textMuted} multiline maxLength={2000} textAlignVertical="top" />
              {formError ? <AppText accessibilityRole="alert" style={styles.errorText}>{formError}</AppText> : null}
              <Pressable accessibilityRole="button" disabled={submitting} onPress={() => void submitTicket()} style={[styles.submitButton, submitting && styles.disabledButton]}>
                {submitting ? <ActivityIndicator color={Monochrome.actionPrimaryText} /> : <AppText style={styles.submitText}>Submit request</AppText>}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Monochrome.background },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Monochrome.border },
  iconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: Monochrome.surfaceSecondary, borderWidth: 1, borderColor: Monochrome.border },
  headerTitle: { color: Monochrome.textPrimary, fontSize: 18, fontWeight: '700' },
  headerRightPlaceholder: { width: 54 },
  newButton: { minWidth: 54, paddingVertical: 9, paddingHorizontal: 12, alignItems: 'center', borderRadius: 10, backgroundColor: Monochrome.actionPrimary },
  newButtonText: { color: Monochrome.actionPrimaryText, fontWeight: '700' },
  content: { padding: Spacing.lg, gap: Spacing.md },
  intro: { color: Monochrome.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: Spacing.sm },
  loading: { padding: Spacing.xl },
  ticketRow: { padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderColor: Monochrome.border, borderRadius: 16, backgroundColor: Monochrome.surfaceSecondary },
  ticketRowMain: { flex: 1, gap: 5 },
  ticketSubject: { color: Monochrome.textPrimary, fontSize: 15, fontWeight: '700' },
  ticketMeta: { color: Monochrome.textMuted, fontSize: 12 },
  statusPill: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, backgroundColor: Monochrome.surfaceElevated },
  statusText: { color: Monochrome.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  emptyCard: { padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm, borderRadius: 16, borderWidth: 1, borderColor: Monochrome.border, backgroundColor: Monochrome.surfaceSecondary },
  emptyTitle: { color: Monochrome.textPrimary, fontSize: 16, fontWeight: '700' },
  helperText: { color: Monochrome.textMuted, fontSize: 12, lineHeight: 18 },
  errorCard: { padding: Spacing.md, gap: Spacing.sm, borderRadius: 12, borderWidth: 1, borderColor: Monochrome.border, backgroundColor: Monochrome.surfaceSecondary },
  errorText: { color: Monochrome.textPrimary, fontSize: 13 },
  retryText: { color: Monochrome.textPrimary, fontWeight: '700' },
  ticketHeaderCard: { padding: Spacing.md, gap: Spacing.sm, borderRadius: 16, borderWidth: 1, borderColor: Monochrome.border, backgroundColor: Monochrome.surfaceSecondary },
  messageCard: { padding: Spacing.md, gap: Spacing.sm, borderRadius: 14, borderWidth: 1, borderColor: Monochrome.border, backgroundColor: Monochrome.surfaceSecondary },
  staffMessage: { backgroundColor: Monochrome.surfaceElevated },
  messageAuthor: { color: Monochrome.textPrimary, fontWeight: '700', fontSize: 13 },
  messageBody: { color: Monochrome.textSecondary, fontSize: 14, lineHeight: 21 },
  replyBox: { gap: Spacing.sm, paddingTop: Spacing.sm },
  input: { minHeight: 48, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Monochrome.border, backgroundColor: Monochrome.surfacePrimary, color: Monochrome.textPrimary, fontSize: 14 },
  messageInput: { minHeight: 110 },
  submitButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: Monochrome.actionPrimary, paddingHorizontal: Spacing.md },
  disabledButton: { opacity: 0.55 },
  submitText: { color: Monochrome.actionPrimaryText, fontWeight: '700', fontSize: 14 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' },
  modalCard: { maxHeight: '92%', paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: Monochrome.background, borderWidth: 1, borderColor: Monochrome.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.md, paddingBottom: Spacing.md },
  modalTitle: { color: Monochrome.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  formContent: { gap: Spacing.sm, paddingBottom: Spacing.lg },
  fieldLabel: { color: Monochrome.textSecondary, fontWeight: '700', fontSize: 13, marginTop: Spacing.sm },
  categoryWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: Monochrome.border, backgroundColor: Monochrome.surfaceSecondary },
  categoryChipSelected: { backgroundColor: Monochrome.actionPrimary, borderColor: Monochrome.actionPrimary },
  categoryText: { color: Monochrome.textSecondary, fontSize: 12, fontWeight: '600' },
  categoryTextSelected: { color: Monochrome.actionPrimaryText },
});
