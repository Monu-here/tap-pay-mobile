import { AppText } from '@/components/typography/app-text';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { Monochrome, Spacing } from '@/constants/theme';
import { getWalletTransaction } from '@/features/passenger/services/passengerApi';

export default function TransactionDetailScreen() {
  const insets = useSafeAreaInsets();
  const { reference } = useLocalSearchParams<{ reference: string }>();

  const [loading, setLoading] = useState(true);
  const [txn, setTxn] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reference) return;
    (async () => {
      setLoading(true);
      try {
        const res = await getWalletTransaction(reference);
        if (res.ok && res.data) {
          setTxn(res.data.transaction);
        } else {
          setError(res.message || 'Transaction not found.');
        }
      } catch {
        setError('Connection error fetching transaction.');
      } finally {
        setLoading(false);
      }
    })();
  }, [reference]);

  const isCredit = txn?.direction === 'credit';
  const amountMinor = txn?.amount_minor ?? txn?.amount?.amount_minor ?? 0;
  const amountFormatted = txn?.amount?.formatted ?? `Rs. ${(amountMinor / 100).toFixed(2)}`;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <SymbolView
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            size={18}
            tintColor={Monochrome.textPrimary}
          />
        </Pressable>
        <AppText style={styles.headerTitle}>Transaction Detail</AppText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Monochrome.textPrimary} />
            <AppText style={styles.loadingText}>Loading ledger transaction...</AppText>
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <AppText style={styles.errorText}>{error}</AppText>
          </View>
        ) : txn ? (
          <View style={styles.receiptCard}>
            <View style={styles.cardHeader}>
              <View style={styles.statusIconBox}>
                <SymbolView
                  name={{
                    ios: isCredit ? 'arrow.down.left' : 'arrow.up.right',
                    android: isCredit ? 'arrow_downward' : 'arrow_upward',
                    web: isCredit ? 'arrow_downward' : 'arrow_upward',
                  }}
                  size={26}
                  tintColor={Monochrome.textPrimary}
                />
              </View>
              <AppText style={styles.transactionTitle}>{txn.description || txn.type}</AppText>
              <AppText style={styles.amountValue}>
                {isCredit ? '+' : '-'}{amountFormatted}
              </AppText>
              <View style={styles.statusPill}>
                <AppText style={styles.statusPillText}>{txn.status?.toUpperCase() || 'SUCCESSFUL'}</AppText>
              </View>
            </View>

            <View style={styles.detailsGroup}>
              <View style={styles.detailRow}>
                <AppText style={styles.rowLabel}>Reference</AppText>
                <AppText style={[styles.rowValue, styles.mono]}>{txn.reference || reference}</AppText>
              </View>

              <View style={styles.detailRow}>
                <AppText style={styles.rowLabel}>Type</AppText>
                <AppText style={styles.rowValue}>{txn.type_label || txn.type}</AppText>
              </View>

              <View style={styles.detailRow}>
                <AppText style={styles.rowLabel}>Direction</AppText>
                <AppText style={styles.rowValue}>{txn.direction_label || txn.direction}</AppText>
              </View>

              <View style={styles.detailRow}>
                <AppText style={styles.rowLabel}>Currency</AppText>
                <AppText style={styles.rowValue}>{txn.currency || 'NPR'}</AppText>
              </View>

              {txn.balance_before && (
                <View style={styles.detailRow}>
                  <AppText style={styles.rowLabel}>Balance Before</AppText>
                  <AppText style={styles.rowValue}>{txn.balance_before.formatted || `Rs. ${(txn.balance_before.amount_minor / 100).toFixed(2)}`}</AppText>
                </View>
              )}

              {txn.balance_after && (
                <View style={styles.detailRow}>
                  <AppText style={styles.rowLabel}>Balance After</AppText>
                  <AppText style={styles.rowValue}>{txn.balance_after.formatted || `Rs. ${(txn.balance_after.amount_minor / 100).toFixed(2)}`}</AppText>
                </View>
              )}

              {txn.card && (
                <View style={styles.detailRow}>
                  <AppText style={styles.rowLabel}>Transit Card</AppText>
                  <AppText style={styles.rowValue}>{txn.card.masked_code || txn.card.card_uid}</AppText>
                </View>
              )}

              <View style={styles.detailRow}>
                <AppText style={styles.rowLabel}>Timestamp</AppText>
                <AppText style={styles.rowValue}>
                  {txn.created_at ? new Date(txn.created_at).toLocaleString() : 'Not available'}
                </AppText>
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Monochrome.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Monochrome.background,
    borderBottomWidth: 1,
    borderBottomColor: Monochrome.border,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  loadingBox: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: 14,
    color: Monochrome.textSecondary,
  },
  errorBox: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
    borderRadius: 16,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  errorText: {
    color: Monochrome.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  receiptCard: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Monochrome.border,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: Spacing.lg,
    alignItems: 'center',
    gap: 8,
    backgroundColor: Monochrome.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: Monochrome.border,
  },
  statusIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  transactionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Monochrome.textSecondary,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: '800',
    color: Monochrome.textPrimary,
    letterSpacing: -0.5,
    marginVertical: 4,
  },
  statusPill: {
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Monochrome.textPrimary,
    letterSpacing: 0.5,
  },
  detailsGroup: {
    padding: Spacing.lg,
    gap: 14,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontSize: 13,
    color: Monochrome.textMuted,
    fontWeight: '500',
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Monochrome.textPrimary,
    textAlign: 'right',
  },
  mono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
  },
});
