import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { Brand, Spacing } from '@/constants/theme';
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
            size={22}
            tintColor={Brand.text}
          />
        </Pressable>
        <Text style={styles.headerTitle}>Transaction Detail</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Brand.teal.primary} />
            <Text style={styles.loadingText}>Loading ledger transaction...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : txn ? (
          <View style={styles.receiptCard}>
            <View style={styles.cardHeader}>
              <View style={[styles.statusIconBox, isCredit ? styles.bgCredit : styles.bgDebit]}>
                <SymbolView
                  name={{
                    ios: isCredit ? 'arrow.down.left' : 'arrow.up.right',
                    android: isCredit ? 'arrow_downward' : 'arrow_upward',
                    web: isCredit ? 'arrow_downward' : 'arrow_upward',
                  }}
                  size={30}
                  tintColor={isCredit ? '#16A34A' : '#DC2626'}
                />
              </View>
              <Text style={styles.transactionTitle}>{txn.description || txn.type}</Text>
              <Text style={[styles.amountValue, isCredit ? styles.textCredit : styles.textDebit]}>
                {isCredit ? '+' : '-'}{amountFormatted}
              </Text>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>{txn.status?.toUpperCase() || 'SUCCESSFUL'}</Text>
              </View>
            </View>

            <View style={styles.detailsGroup}>
              <View style={styles.detailRow}>
                <Text style={styles.rowLabel}>Reference</Text>
                <Text style={[styles.rowValue, styles.mono]}>{txn.reference || reference}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.rowLabel}>Type</Text>
                <Text style={styles.rowValue}>{txn.type_label || txn.type}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.rowLabel}>Direction</Text>
                <Text style={styles.rowValue}>{txn.direction_label || txn.direction}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.rowLabel}>Currency</Text>
                <Text style={styles.rowValue}>{txn.currency || 'NPR'}</Text>
              </View>

              {txn.balance_before && (
                <View style={styles.detailRow}>
                  <Text style={styles.rowLabel}>Balance Before</Text>
                  <Text style={styles.rowValue}>{txn.balance_before.formatted || `Rs. ${(txn.balance_before.amount_minor / 100).toFixed(2)}`}</Text>
                </View>
              )}

              {txn.balance_after && (
                <View style={styles.detailRow}>
                  <Text style={styles.rowLabel}>Balance After</Text>
                  <Text style={styles.rowValue}>{txn.balance_after.formatted || `Rs. ${(txn.balance_after.amount_minor / 100).toFixed(2)}`}</Text>
                </View>
              )}

              {txn.card && (
                <View style={styles.detailRow}>
                  <Text style={styles.rowLabel}>Transit Card</Text>
                  <Text style={styles.rowValue}>{txn.card.masked_code || txn.card.card_uid}</Text>
                </View>
              )}

              <View style={styles.detailRow}>
                <Text style={styles.rowLabel}>Timestamp</Text>
                <Text style={styles.rowValue}>{new Date(txn.created_at || Date.now()).toLocaleString()}</Text>
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
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    backgroundColor: Brand.white,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    padding: Spacing.one,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Brand.text,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  loadingBox: {
    padding: Spacing.six,
    alignItems: 'center',
    gap: Spacing.two,
  },
  loadingText: {
    fontSize: 14,
    color: Brand.textSecondary,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 14,
    padding: Spacing.four,
    alignItems: 'center',
  },
  errorText: {
    color: Brand.error,
    fontSize: 14,
    fontWeight: '600',
  },
  receiptCard: {
    backgroundColor: Brand.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  cardHeader: {
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: '#FAF5FF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  statusIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  bgCredit: {
    backgroundColor: '#DCFCE7',
  },
  bgDebit: {
    backgroundColor: '#FEE2E2',
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.text,
  },
  amountValue: {
    fontSize: 34,
    fontWeight: '800',
    marginVertical: 4,
  },
  textCredit: {
    color: '#16A34A',
  },
  textDebit: {
    color: '#DC2626',
  },
  statusPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  detailsGroup: {
    padding: Spacing.five,
    gap: Spacing.three,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontSize: 13,
    color: Brand.textSecondary,
    fontWeight: '500',
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.text,
    textAlign: 'right',
  },
  mono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
  },
});
