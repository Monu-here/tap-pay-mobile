import { AppText, AppTextInput } from '@/components/typography/app-text';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  Share,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { Monochrome, Spacing } from '@/constants/theme';
import { AddMoneyModal } from '@/features/passenger/components/AddMoneyModal';
import {
  getDashboard,
  getWalletTransactions,
  getWalletStatementSummary,
  type WalletSummary,
  type WalletTransaction,
  type WalletStatementSummary,
} from '@/features/passenger/services/passengerApi';

export default function WalletScreen() {
  const insets = useSafeAreaInsets();

  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [statementSummary, setStatementSummary] = useState<WalletStatementSummary | null>(null);
  const [transactionCursor, setTransactionCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [transactionType, setTransactionType] = useState<'all' | 'load' | 'fare'>('all');
  const [transactionStatus, setTransactionStatus] = useState<'all' | 'pending' | 'successful' | 'failed' | 'reversed'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statementLoading, setStatementLoading] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [addMoneyVisible, setAddMoneyVisible] = useState(false);

  const loadWalletData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    try {
      const [dashRes, txnsRes, summaryRes] = await Promise.all([
        getDashboard(),
        getWalletTransactions({ perPage: 100 }),
        getWalletStatementSummary(),
      ]);

      if (dashRes.ok && dashRes.data) {
        setWallet(dashRes.data.wallet);
      }
      if (txnsRes.ok && txnsRes.data) {
        setTransactions(txnsRes.data.transactions || []);
        setTransactionCursor(typeof txnsRes.meta?.next_cursor === 'string' ? txnsRes.meta.next_cursor : null);
      }
      if (summaryRes.ok && summaryRes.data) setStatementSummary(summaryRes.data);
      const failures = [dashRes, txnsRes, summaryRes].filter((result) => !result.ok);
      if (failures.length > 0) {
        setLoadError(failures[0].message || 'Some wallet data could not be loaded.');
      } else {
        setLoadError(null);
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load wallet data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  const refreshAfterPayment = useCallback(() => loadWalletData(true), [loadWalletData]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadWalletData();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadWalletData]);

  const filteredTransactions = transactions.filter((t) => {
    if (filter === 'credit') return t.direction === 'credit';
    if (filter === 'debit') return t.direction === 'debit';
    return true;
  });

  const applyStatementFilters = async () => {
    const from = dateFrom.trim();
    const to = dateTo.trim();
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if ((from && !datePattern.test(from)) || (to && !datePattern.test(to))) {
      setLoadError('Use YYYY-MM-DD format for statement dates.');
      return;
    }
    if (from && to && from > to) {
      setLoadError('The statement start date must be before the end date.');
      return;
    }

    setStatementLoading(true);
    setLoadError(null);
    try {
      const filters = {
        ...(transactionType !== 'all' ? { type: transactionType } : {}),
        ...(filter !== 'all' ? { direction: filter } : {}),
        ...(transactionStatus !== 'all' ? { status: transactionStatus } : {}),
        ...(from ? { date_from: from } : {}),
        ...(to ? { date_to: to } : {}),
        perPage: 100,
      } as const;
      const [rows, summary] = await Promise.all([
        getWalletTransactions(filters),
        getWalletStatementSummary(filters),
      ]);
      if (!rows.ok || !rows.data) {
        setLoadError(rows.message || 'Could not load the filtered statement.');
        return;
      }
      if (!summary.ok || !summary.data) {
        setLoadError(summary.message || 'Could not calculate statement totals.');
        return;
      }
      setTransactions(rows.data.transactions);
      setTransactionCursor(typeof rows.meta?.next_cursor === 'string' ? rows.meta.next_cursor : null);
      setStatementSummary(summary.data);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Network error loading statement.');
    } finally {
      setStatementLoading(false);
    }
  };

  const loadMoreTransactions = async () => {
    if (!transactionCursor || statementLoading) return;
    setStatementLoading(true);
    try {
      const result = await getWalletTransactions({
        cursor: transactionCursor,
        perPage: 100,
        ...(transactionType !== 'all' ? { type: transactionType } : {}),
        ...(filter !== 'all' ? { direction: filter } : {}),
        ...(transactionStatus !== 'all' ? { status: transactionStatus } : {}),
        ...(dateFrom.trim() ? { date_from: dateFrom.trim() } : {}),
        ...(dateTo.trim() ? { date_to: dateTo.trim() } : {}),
      });
      if (!result.ok || !result.data) {
        setLoadError(result.message || 'Could not load more statement entries.');
        return;
      }
      setTransactions((current) => [...current, ...result.data.transactions]);
      setTransactionCursor(typeof result.meta?.next_cursor === 'string' ? result.meta.next_cursor : null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Network error loading more entries.');
    } finally {
      setStatementLoading(false);
    }
  };

  const shareStatementCsv = async () => {
    if (transactions.length === 0) {
      Alert.alert('No statement entries', 'There are no ledger entries to share.');
      return;
    }
    const csvCell = (value: string | number | null | undefined) =>
      `"${String(value ?? '').replaceAll('"', '""')}"`;
    const lines = [
      ['Reference', 'Date', 'Type', 'Direction', 'Amount (minor)', 'Status', 'Description'].map(csvCell).join(','),
      ...filteredTransactions.map((row) => [
        row.reference,
        row.created_at,
        row.type,
        row.direction,
        row.amount_minor,
        row.status,
        row.description,
      ].map(csvCell).join(',')),
    ];
    try {
      await Share.share({
        title: 'Tap & Pay wallet statement (loaded entries)',
        message: lines.join('\n'),
      });
    } catch (error) {
      Alert.alert('Could not share statement', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <AppText style={styles.headerTitle}>Statements</AppText>
       
        <Pressable
          accessibilityRole="button"
          onPress={() => loadWalletData(true)}
          style={styles.refreshIcon}
        >
          <SymbolView
            name={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }}
            size={18}
            tintColor={Monochrome.textPrimary}
          />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadWalletData(true)}
            tintColor={Monochrome.textPrimary}
          />
        }
      >
        {loadError ? (
          <View style={styles.loadErrorBox}>
            <AppText style={styles.errorBanner}>{loadError}</AppText>
            <Pressable onPress={() => loadWalletData(true)} accessibilityRole="button">
              <AppText style={styles.loadRetryText}>Retry</AppText>
            </Pressable>
          </View>
        ) : null}


        {/* Ledger Transactions Section */}
        <View style={styles.ledgerHeader}>
          <AppText style={styles.sectionHeading}>Transaction History</AppText>
          <View style={styles.filterPills}>
            <Pressable
              onPress={() => setFilter('all')}
              style={[styles.filterPill, filter === 'all' && styles.filterPillActive]}
            >
              <AppText style={[styles.filterPillText, filter === 'all' && styles.filterPillTextActive]}>All</AppText>
            </Pressable>
            <Pressable
              onPress={() => setFilter('credit')}
              style={[styles.filterPill, filter === 'credit' && styles.filterPillActive]}
            >
              <AppText style={[styles.filterPillText, filter === 'credit' && styles.filterPillTextActive]}>Credits</AppText>
            </Pressable>
            <Pressable
              onPress={() => setFilter('debit')}
              style={[styles.filterPill, filter === 'debit' && styles.filterPillActive]}
            >
              <AppText style={[styles.filterPillText, filter === 'debit' && styles.filterPillTextActive]}>Debits</AppText>
            </Pressable>
          </View>
        </View>

        {statementSummary ? (
          <View style={styles.statementSummaryCard}>
            <AppText style={styles.statementSummaryTitle}>Ledger totals</AppText>
            <View style={styles.statementSummaryRow}>
              <AppText style={styles.statementSummaryText}>Credits: {statementSummary.total_credits.formatted}</AppText>
              <AppText style={styles.statementSummaryText}>Debits: {statementSummary.total_debits.formatted}</AppText>
            </View>
            <View style={styles.statementSummaryRow}>
              <AppText style={styles.statementSummaryText}>Opening: {statementSummary.opening_balance.formatted}</AppText>
              <AppText style={styles.statementSummaryText}>Closing: {statementSummary.closing_balance.formatted}</AppText>
            </View>
          </View>
        ) : null}

        <View style={styles.statementFilters}>
          <AppText style={styles.statementFilterLabel}>Transaction type</AppText>
          <View style={styles.filterPills}>
            {([
              ['all', 'All'],
              ['load', 'Top-ups'],
              ['fare', 'Transport'],
            ] as const).map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => setTransactionType(value)}
                style={[styles.filterPill, transactionType === value && styles.filterPillActive]}
              >
                <AppText style={[styles.filterPillText, transactionType === value && styles.filterPillTextActive]}>{label}</AppText>
              </Pressable>
            ))}
          </View>
          <AppText style={styles.statementFilterLabel}>Status</AppText>
          <View style={styles.filterPills}>
            {(['all', 'successful', 'pending', 'failed', 'reversed'] as const).map((value) => (
              <Pressable
                key={value}
                onPress={() => setTransactionStatus(value)}
                style={[styles.filterPill, transactionStatus === value && styles.filterPillActive]}
              >
                <AppText style={[styles.filterPillText, transactionStatus === value && styles.filterPillTextActive]}>
                  {value === 'all' ? 'All' : value}
                </AppText>
              </Pressable>
            ))}
          </View>
          <View style={styles.statementDateRow}>
            <AppTextInput
              value={dateFrom}
              onChangeText={setDateFrom}
              placeholder="From YYYY-MM-DD"
              placeholderTextColor={Monochrome.textMuted}
              style={styles.statementDateInput}
              accessibilityLabel="Statement start date"
            />
            <AppTextInput
              value={dateTo}
              onChangeText={setDateTo}
              placeholder="To YYYY-MM-DD"
              placeholderTextColor={Monochrome.textMuted}
              style={styles.statementDateInput}
              accessibilityLabel="Statement end date"
            />
          </View>
          <View style={styles.statementActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => void applyStatementFilters()}
              disabled={statementLoading}
              style={styles.statementActionButton}
            >
              {statementLoading
                ? <ActivityIndicator size="small" color={Monochrome.textPrimary} />
                : <AppText style={styles.statementActionText}>Apply filters</AppText>}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void shareStatementCsv()}
              style={styles.statementActionButton}
            >
              <AppText style={styles.statementActionText}>Share loaded CSV</AppText>
            </Pressable>
          </View>
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={Monochrome.textPrimary} />
            <AppText style={styles.loadingText}>Fetching statement rows...</AppText>
          </View>
        ) : filteredTransactions.length > 0 ? (
          <View style={styles.transactionList}>
            {filteredTransactions.map((item, idx) => {
              const isCredit = item.direction === 'credit';
              return (
                <Pressable
                  key={item.reference || item.id}
                  onPress={() => router.push(`/wallet/transaction/${item.reference}` as any)}
                  style={[styles.txnRow, idx > 0 && styles.rowDivider]}
                >
                  <View style={styles.txnIconWrap}>
                    <SymbolView
                      name={{
                        ios: isCredit ? 'arrow.down.left' : 'arrow.up.right',
                        android: isCredit ? 'arrow_downward' : 'arrow_upward',
                        web: isCredit ? 'arrow_downward' : 'arrow_upward',
                      }}
                      size={16}
                      tintColor={Monochrome.textPrimary}
                    />
                  </View>

                  <View style={styles.txnCenter}>
                    <AppText style={styles.txnTitle} numberOfLines={1}>
                      {item.description || item.type}
                    </AppText>
                    <AppText style={styles.txnRef}>{item.reference}</AppText>
                    <AppText style={styles.txnDate}>{new Date(item.created_at).toLocaleString()}</AppText>
                  </View>

                  <View style={styles.txnRight}>
                    <AppText style={styles.txnAmount}>
                      {isCredit ? '+' : '-'}Rs. {(item.amount_minor / 100).toFixed(2)}
                    </AppText>
                    <View style={styles.txnStatusBadge}>
                      <AppText style={styles.txnStatusText}>{item.status}</AppText>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <SymbolView
              name={{ ios: 'doc.plaintext', android: 'receipt_long', web: 'receipt_long' }}
              size={36}
              tintColor={Monochrome.textMuted}
            />
            <AppText style={styles.emptyTitle}>No Transactions Found</AppText>
            <AppText style={styles.emptySubtitle}>Your top-ups and tap payments will appear here.</AppText>
          </View>
        )}
        {transactionCursor ? (
          <Pressable
            accessibilityRole="button"
            disabled={statementLoading}
            onPress={() => void loadMoreTransactions()}
            style={styles.loadMoreStatementButton}
          >
            {statementLoading
              ? <ActivityIndicator size="small" color={Monochrome.textPrimary} />
              : <AppText style={styles.statementActionText}>Load more statement entries</AppText>}
          </Pressable>
        ) : null}
      </ScrollView>

      <AddMoneyModal
        visible={addMoneyVisible}
        wallet={wallet}
        onClose={() => setAddMoneyVisible(false)}
        onPaymentVerified={refreshAfterPayment}
      />
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
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    backgroundColor: Monochrome.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: Monochrome.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Monochrome.textPrimary,
  },
  refreshIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  travelHistoryButton: {
    minWidth: 56,
    height: 36,
    paddingHorizontal: Spacing.two,
    borderRadius: 18,
    backgroundColor: Monochrome.actionSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  travelHistoryLink: {
    color: Monochrome.actionSecondaryText,
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.four,
  },
  balanceCard: {
    backgroundColor: Monochrome.surfacePrimary,
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.three,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  balanceCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  balanceTagText: {
    color: Monochrome.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  currencyCode: {
    color: Monochrome.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  balanceDisplay: {
    fontSize: 34,
    fontWeight: '800',
    color: Monochrome.textPrimary,
    letterSpacing: -0.5,
  },
  balanceActionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  actionTopUp: {
    flex: 1,
    backgroundColor: Monochrome.actionPrimary,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  actionTopUpText: {
    color: Monochrome.actionPrimaryText,
    fontSize: 14,
    fontWeight: '700',
  },
  actionWithdraw: {
    flex: 1,
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  actionWithdrawText: {
    color: Monochrome.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  ledgerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  statementSummaryCard: {
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Monochrome.border,
    backgroundColor: Monochrome.surfaceSecondary,
    gap: 6,
  },
  statementSummaryTitle: {
    color: Monochrome.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  statementSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 6,
  },
  statementSummaryText: {
    color: Monochrome.textSecondary,
    fontSize: 11,
  },
  statementFilters: {
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Monochrome.border,
    backgroundColor: Monochrome.surfaceSecondary,
    gap: Spacing.two,
  },
  statementFilterLabel: {
    color: Monochrome.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  statementDateRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  statementDateInput: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: Spacing.two,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Monochrome.border,
    color: Monochrome.textPrimary,
    fontSize: 11,
  },
  statementActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  statementActionButton: {
    minHeight: 40,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: 8,
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  statementActionText: {
    color: Monochrome.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  loadMoreStatementButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Monochrome.border,
    backgroundColor: Monochrome.surfaceSecondary,
  },
  filterPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  filterPillActive: {
    backgroundColor: Monochrome.surfaceElevated,
    borderColor: Monochrome.textPrimary,
  },
  filterPillText: {
    fontSize: 12,
    color: Monochrome.textMuted,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: Monochrome.textPrimary,
  },
  loadingContainer: {
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.two,
  },
  loadingText: {
    fontSize: 13,
    color: Monochrome.textSecondary,
  },
  transactionList: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 16,
    paddingHorizontal: Spacing.four,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: Monochrome.surfaceElevated,
  },
  txnIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txnCenter: {
    flex: 1,
  },
  txnTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Monochrome.textPrimary,
  },
  txnRef: {
    fontSize: 11,
    color: Monochrome.textMuted,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  txnDate: {
    fontSize: 11,
    color: Monochrome.textMuted,
    marginTop: 2,
  },
  txnRight: {
    alignItems: 'flex-end',
  },
  txnAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  txnStatusBadge: {
    backgroundColor: Monochrome.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  txnStatusText: {
    fontSize: 10,
    color: Monochrome.textSecondary,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  emptyContainer: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 16,
    padding: Spacing.six,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Monochrome.border,
    gap: Spacing.two,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Monochrome.textMuted,
    textAlign: 'center',
  },
  loadErrorBox: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.one,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  errorBanner: {
    color: Monochrome.textPrimary,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  loadRetryText: {
    color: Monochrome.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
});
