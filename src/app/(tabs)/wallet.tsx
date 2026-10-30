import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { AppText } from '@/components/typography/app-text';
import { Palette, Spacing } from '@/constants/theme';
import { FontFamilies } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { AddMoneyModal } from '@/features/passenger/components/AddMoneyModal';
import {
  getDashboard,
  getWalletTransactions,
  getWalletStatementSummary,
  type WalletSummary,
  type WalletTransaction,
  type WalletStatementSummary,
} from '@/features/passenger/services/passengerApi';

type ActivityFilter = 'all' | 'fare' | 'load';

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [statementSummary, setStatementSummary] = useState<WalletStatementSummary | null>(null);
  const [transactionCursor, setTransactionCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [rangeFilter, setRangeFilter] = useState<'all' | '30days'>('all');
  const [statementLoading, setStatementLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addMoneyVisible, setAddMoneyVisible] = useState(false);

  const loadWalletData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [dashRes, txnsRes, summaryRes] = await Promise.all([
        getDashboard(),
        getWalletTransactions({ perPage: 60 }),
        getWalletStatementSummary(),
      ]);

      if (dashRes.ok && dashRes.data) {
        setWallet(dashRes.data.wallet);
      }
      if (txnsRes.ok && txnsRes.data) {
        setTransactions(txnsRes.data.transactions || []);
        setTransactionCursor(typeof txnsRes.meta?.next_cursor === 'string' ? txnsRes.meta.next_cursor : null);
      }
      if (summaryRes.ok && summaryRes.data) {
        setStatementSummary(summaryRes.data);
      }

      const failures = [dashRes, txnsRes, summaryRes].filter((r) => !r.ok);
      if (failures.length > 0) {
        setLoadError(failures[0].message || 'Some wallet data could not be loaded.');
      } else {
        setLoadError(null);
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load statement.');
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

  // Client-side filtering for fast, responsive UI
  const filteredTransactions = transactions.filter((t) => {
    if (filter === 'fare') {
      return t.direction === 'debit' || t.type?.toLowerCase().includes('fare');
    }
    if (filter === 'load') {
      return t.direction === 'credit' || t.type?.toLowerCase().includes('load');
    }
    return true;
  });

  const handleApplyRange = async (range: 'all' | '30days') => {
    setRangeFilter(range);
    setStatementLoading(true);
    setLoadError(null);

    let dateFrom: string | undefined;
    if (range === '30days') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      dateFrom = d.toISOString().split('T')[0];
    }

    try {
      const filters = {
        ...(dateFrom ? { date_from: dateFrom } : {}),
        perPage: 60,
      };

      const [rows, summary] = await Promise.all([
        getWalletTransactions(filters),
        getWalletStatementSummary(filters),
      ]);

      if (rows.ok && rows.data) {
        setTransactions(rows.data.transactions || []);
        setTransactionCursor(typeof rows.meta?.next_cursor === 'string' ? rows.meta.next_cursor : null);
      }
      if (summary.ok && summary.data) {
        setStatementSummary(summary.data);
      }
    } catch {
      setLoadError('Failed to filter statement range.');
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
        perPage: 40,
        ...(rangeFilter === '30days'
          ? {
              date_from: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
            }
          : {}),
      });

      if (result.ok && result.data) {
        setTransactions((prev) => [...prev, ...result.data.transactions]);
        setTransactionCursor(typeof result.meta?.next_cursor === 'string' ? result.meta.next_cursor : null);
      }
    } catch {
      // Ignored
    } finally {
      setStatementLoading(false);
    }
  };

  const shareStatement = async () => {
    if (transactions.length === 0) {
      Alert.alert('No Statement Entries', 'There are no ledger entries to export.');
      return;
    }

    const lines = [
      'eYatra Wallet Statement Summary',
      `Available Balance: ${wallet?.balance_formatted || 'Rs. 0.00'}`,
      `Total Top-ups (Credits): ${statementSummary?.total_credits?.formatted || 'Rs. 0.00'}`,
      `Total Fares (Debits): ${statementSummary?.total_debits?.formatted || 'Rs. 0.00'}`,
      '----------------------------------------',
      ...filteredTransactions.map((tx) => {
        const sign = tx.direction === 'credit' ? '+' : '-';
        const formattedAmount = (tx.amount_minor / 100).toFixed(2);
        const dateStr = new Date(tx.created_at).toLocaleDateString();
        return `${dateStr} | ${tx.description || tx.type} | ${sign}Rs. ${formattedAmount} [${tx.status}]`;
      }),
    ];

    try {
      await Share.share({
        title: 'eYatra Wallet Statement',
        message: lines.join('\n'),
      });
    } catch {
      // User cancelled or share failed
    }
  };

  const availableBalance = wallet?.balance_formatted || 'Rs. 0.00';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />

      {/* Branded Header */}
      <LinearGradient
        colors={['#003049', '#001824']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.headerRow}>
          <View>
            <AppText style={styles.headerSubtitle}>eYatra Wallet</AppText>
            <AppText style={styles.headerTitle}>Account Statement</AppText>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share Statement"
              onPress={shareStatement}
              style={({ pressed }) => [
                styles.headerIconBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
              hitSlop={8}
            >
              <SymbolView
                name={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }}
                size={18}
                tintColor={Palette.warmCream}
              />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh Statement"
              onPress={() => void loadWalletData(true)}
              style={({ pressed }) => [
                styles.headerIconBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
              hitSlop={8}
            >
              <SymbolView
                name={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }}
                size={18}
                tintColor={Palette.warmCream}
              />
            </Pressable>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadWalletData(true)}
            tintColor={Palette.crimsonRed}
          />
        }
      >
        {/* Error notification if any */}
        {loadError && (
          <View
            style={[
              styles.errorCard,
              {
                backgroundColor: theme.isDark ? '#3D0D11' : '#FDF0D5',
                borderColor: Palette.crimsonRed,
              },
            ]}
          >
            <SymbolView
              name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
              size={18}
              tintColor={Palette.crimsonRed}
            />
            <AppText style={[styles.errorText, { color: theme.text }]}>{loadError}</AppText>
            <Pressable onPress={() => void loadWalletData(true)}>
              <AppText style={styles.errorRetry}>Retry</AppText>
            </Pressable>
          </View>
        )}

        {/* Hero Balance Card */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: theme.isDark ? '#002235' : Palette.white,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.heroTop}>
            <View>
              <AppText style={[styles.heroLabel, { color: theme.textSecondary }]}>
                Available Balance
              </AppText>
              <AppText style={[styles.heroBalance, { color: theme.text }]}>
                {availableBalance}
              </AppText>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add Money"
              onPress={() => setAddMoneyVisible(true)}
              style={({ pressed }) => [
                styles.topUpButton,
                { transform: [{ scale: pressed ? 0.96 : 1 }] },
              ]}
            >
              <LinearGradient
                colors={[Palette.crimsonRed, Palette.deepMaroon]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.topUpGradient}
              >
                <SymbolView
                  name={{ ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' }}
                  size={16}
                  tintColor={Palette.white}
                />
                <AppText style={styles.topUpText}>Top Up</AppText>
              </LinearGradient>
            </Pressable>
          </View>

          {/* Quick 2-Column Summary Stats */}
          <View
            style={[
              styles.statsGrid,
              {
                backgroundColor: theme.isDark ? '#001A29' : '#FAF4EB',
                borderColor: theme.isDark ? '#154766' : '#E5D5BA',
              },
            ]}
          >
            <View style={styles.statColumn}>
              <View style={styles.statIconRow}>
                <View style={[styles.statDot, { backgroundColor: '#1B8A5A' }]} />
                <AppText style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Total Inflow
                </AppText>
              </View>
              <AppText style={[styles.statValue, { color: '#1B8A5A' }]}>
                {statementSummary?.total_credits?.formatted || 'Rs. 0.00'}
              </AppText>
            </View>

            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />

            <View style={styles.statColumn}>
              <View style={styles.statIconRow}>
                <View style={[styles.statDot, { backgroundColor: Palette.crimsonRed }]} />
                <AppText style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Total Fares
                </AppText>
              </View>
              <AppText style={[styles.statValue, { color: Palette.crimsonRed }]}>
                {statementSummary?.total_debits?.formatted || 'Rs. 0.00'}
              </AppText>
            </View>
          </View>
        </View>

        {/* Clean Filter Segment Bar */}
        <View style={styles.filterSection}>
          <View
            style={[
              styles.segmentContainer,
              {
                backgroundColor: theme.isDark ? '#002235' : '#FAF4EB',
                borderColor: theme.border,
              },
            ]}
          >
            {(
              [
                ['all', 'All Activity'],
                ['fare', 'Bus Fares'],
                ['load', 'Top-ups'],
              ] as const
            ).map(([key, label]) => {
              const active = filter === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setFilter(key)}
                  style={[
                    styles.segmentButton,
                    active && [
                      styles.segmentActive,
                      {
                        backgroundColor: theme.isDark ? '#0A3F5E' : Palette.white,
                        borderColor: active ? Palette.crimsonRed : 'transparent',
                      },
                    ],
                  ]}
                >
                  <AppText
                    style={[
                      styles.segmentText,
                      {
                        color: active
                          ? Palette.crimsonRed
                          : theme.isDark
                          ? Palette.slateBlue
                          : '#5E7487',
                        fontFamily: active ? FontFamilies.bold : FontFamilies.medium,
                      },
                    ]}
                  >
                    {label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          {/* Quick Date Range Chips */}
          <View style={styles.rangeRow}>
            <AppText style={[styles.rangeLabel, { color: theme.textSecondary }]}>
              Period:
            </AppText>

            <Pressable
              onPress={() => void handleApplyRange('all')}
              style={[
                styles.rangeChip,
                {
                  backgroundColor:
                    rangeFilter === 'all'
                      ? Palette.prussianNavy
                      : theme.isDark
                      ? '#002235'
                      : '#FFFFFF',
                  borderColor: rangeFilter === 'all' ? Palette.prussianNavy : theme.border,
                },
              ]}
            >
              <AppText
                style={[
                  styles.rangeChipText,
                  {
                    color: rangeFilter === 'all' ? Palette.warmCream : theme.textSecondary,
                  },
                ]}
              >
                All Time
              </AppText>
            </Pressable>

            <Pressable
              onPress={() => void handleApplyRange('30days')}
              style={[
                styles.rangeChip,
                {
                  backgroundColor:
                    rangeFilter === '30days'
                      ? Palette.prussianNavy
                      : theme.isDark
                      ? '#002235'
                      : '#FFFFFF',
                  borderColor: rangeFilter === '30days' ? Palette.prussianNavy : theme.border,
                },
              ]}
            >
              <AppText
                style={[
                  styles.rangeChipText,
                  {
                    color:
                      rangeFilter === '30days' ? Palette.warmCream : theme.textSecondary,
                  },
                ]}
              >
                Last 30 Days
              </AppText>
            </Pressable>
          </View>
        </View>

        {/* Transactions List */}
        <View style={styles.sectionHeaderRow}>
          <AppText style={[styles.sectionTitle, { color: theme.text }]}>
            Transactions ({filteredTransactions.length})
          </AppText>

          {statementLoading && (
            <ActivityIndicator size="small" color={Palette.crimsonRed} />
          )}
        </View>

        {loading && !refreshing ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={Palette.crimsonRed} />
            <AppText style={[styles.centerMutedText, { color: theme.textSecondary }]}>
              Loading statement entries...
            </AppText>
          </View>
        ) : filteredTransactions.length > 0 ? (
          <View style={styles.listCard}>
            {filteredTransactions.map((tx, idx) => {
              const isCredit = tx.direction === 'credit';
              const sign = isCredit ? '+' : '-';
              const amountFormatted = (tx.amount_minor / 100).toFixed(2);
              const isLast = idx === filteredTransactions.length - 1;

              // Format date nicely
              let dateDisplay = tx.created_at;
              try {
                const dateObj = new Date(tx.created_at);
                dateDisplay = dateObj.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
              } catch {
                // keep original string
              }

              return (
                <Pressable
                  key={tx.reference || tx.id}
                  onPress={() => router.push(`/wallet/transaction/${tx.reference}` as any)}
                  style={({ pressed }) => [
                    styles.txRow,
                    !isLast && [styles.txDivider, { borderBottomColor: theme.borderLight }],
                    {
                      backgroundColor: pressed
                        ? theme.isDark
                          ? '#002B42'
                          : '#FBF5EB'
                        : theme.isDark
                        ? '#002235'
                        : Palette.white,
                    },
                  ]}
                >
                  {/* Direction / Category Icon */}
                  <View
                    style={[
                      styles.txIconBox,
                      {
                        backgroundColor: isCredit
                          ? 'rgba(27, 138, 90, 0.12)'
                          : 'rgba(193, 18, 31, 0.1)',
                      },
                    ]}
                  >
                    <SymbolView
                      name={
                        isCredit
                          ? { ios: 'arrow.down.left', android: 'arrow_downward', web: 'arrow_downward' }
                          : { ios: 'bus.fill', android: 'directions_bus', web: 'directions_bus' }
                      }
                      size={18}
                      tintColor={isCredit ? '#1B8A5A' : Palette.crimsonRed}
                    />
                  </View>

                  {/* Transaction Details */}
                  <View style={styles.txInfo}>
                    <AppText
                      style={[styles.txTitle, { color: theme.text }]}
                      numberOfLines={1}
                    >
                      {tx.description || (isCredit ? 'Wallet Top-up' : 'Public Bus Fare')}
                    </AppText>

                    <View style={styles.txMetaRow}>
                      <AppText style={[styles.txDate, { color: theme.textMuted }]}>
                        {dateDisplay}
                      </AppText>
                      <AppText style={[styles.txDot, { color: theme.border }]}>•</AppText>
                      <AppText style={[styles.txRef, { color: theme.textMuted }]}>
                        {tx.reference.slice(-8)}
                      </AppText>
                    </View>
                  </View>

                  {/* Amount & Status Badge */}
                  <View style={styles.txRight}>
                    <AppText
                      style={[
                        styles.txAmount,
                        { color: isCredit ? '#1B8A5A' : Palette.crimsonRed },
                      ]}
                    >
                      {sign}Rs. {amountFormatted}
                    </AppText>

                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor:
                            tx.status === 'successful' || tx.status === 'completed'
                              ? 'rgba(27, 138, 90, 0.1)'
                              : tx.status === 'pending'
                              ? 'rgba(194, 120, 3, 0.12)'
                              : 'rgba(193, 18, 31, 0.1)',
                        },
                      ]}
                    >
                      <AppText
                        style={[
                          styles.statusText,
                          {
                            color:
                              tx.status === 'successful' || tx.status === 'completed'
                                ? '#1B8A5A'
                                : tx.status === 'pending'
                                ? '#C27803'
                                : Palette.crimsonRed,
                          },
                        ]}
                      >
                        {tx.status}
                      </AppText>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: theme.isDark ? '#002235' : Palette.white,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.emptyIconCircle}>
              <SymbolView
                name={{ ios: 'doc.text.magnifyingglass', android: 'receipt', web: 'receipt' }}
                size={32}
                tintColor={Palette.slateBlue}
              />
            </View>
            <AppText style={[styles.emptyTitle, { color: theme.text }]}>
              No Transactions Found
            </AppText>
            <AppText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              {filter === 'all'
                ? 'You have not made any wallet top-ups or bus rides yet.'
                : `No ${filter === 'fare' ? 'bus fare' : 'top-up'} transactions in this period.`}
            </AppText>
            <Pressable
              onPress={() => setAddMoneyVisible(true)}
              style={styles.emptyButton}
            >
              <AppText style={styles.emptyButtonText}>Add Money to Wallet</AppText>
            </Pressable>
          </View>
        )}

        {/* Load More Button */}
        {transactionCursor && !loading && (
          <Pressable
            accessibilityRole="button"
            onPress={loadMoreTransactions}
            disabled={statementLoading}
            style={[
              styles.loadMoreBtn,
              {
                backgroundColor: theme.isDark ? '#002235' : Palette.white,
                borderColor: theme.border,
              },
            ]}
          >
            {statementLoading ? (
              <ActivityIndicator size="small" color={Palette.crimsonRed} />
            ) : (
              <AppText style={[styles.loadMoreText, { color: theme.text }]}>
                Load Previous Entries
              </AppText>
            )}
          </Pressable>
        )}
      </ScrollView>

      {/* Add Money Modal */}
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
  },
  headerGradient: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSubtitle: {
    color: Palette.slateBlue,
    fontFamily: FontFamilies.medium,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: Palette.warmCream,
    fontFamily: FontFamilies.extraBold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: Spacing.four,
    gap: 16,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  errorText: {
    flex: 1,
    fontFamily: FontFamilies.medium,
    fontSize: 13,
  },
  errorRetry: {
    fontFamily: FontFamilies.bold,
    fontSize: 13,
    color: Palette.crimsonRed,
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 16,
    shadowColor: Palette.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLabel: {
    fontFamily: FontFamilies.medium,
    fontSize: 13,
    marginBottom: 2,
  },
  heroBalance: {
    fontFamily: FontFamilies.extraBold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  topUpButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: Palette.crimsonRed,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  topUpGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  topUpText: {
    fontFamily: FontFamilies.bold,
    fontSize: 14,
    color: Palette.white,
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  statColumn: {
    flex: 1,
    gap: 4,
  },
  statIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statLabel: {
    fontFamily: FontFamilies.medium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statValue: {
    fontFamily: FontFamilies.extraBold,
    fontSize: 15,
  },
  statDivider: {
    width: 1,
    height: 30,
    marginHorizontal: 12,
  },
  filterSection: {
    gap: 10,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 3,
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 11,
  },
  segmentActive: {
    borderWidth: 1,
    shadowColor: Palette.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
  },
  rangeLabel: {
    fontFamily: FontFamilies.medium,
    fontSize: 12,
  },
  rangeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  rangeChipText: {
    fontFamily: FontFamilies.semiBold,
    fontSize: 11,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: {
    fontFamily: FontFamilies.bold,
    fontSize: 17,
  },
  listCard: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: Palette.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  txDivider: {
    borderBottomWidth: 1,
  },
  txIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txInfo: {
    flex: 1,
    gap: 3,
  },
  txTitle: {
    fontFamily: FontFamilies.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  txMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  txDate: {
    fontFamily: FontFamilies.regular,
    fontSize: 11,
  },
  txDot: {
    fontSize: 10,
  },
  txRef: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
  },
  txRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  txAmount: {
    fontFamily: FontFamilies.extraBold,
    fontSize: 15,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontFamily: FontFamilies.bold,
    fontSize: 10,
    textTransform: 'capitalize',
  },
  centerBox: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  centerMutedText: {
    fontFamily: FontFamilies.medium,
    fontSize: 14,
  },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    gap: 10,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(102, 155, 188, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: FontFamilies.bold,
    fontSize: 16,
  },
  emptySubtitle: {
    fontFamily: FontFamilies.regular,
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 18,
  },
  emptyButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Palette.crimsonRed,
  },
  emptyButtonText: {
    fontFamily: FontFamilies.bold,
    fontSize: 13,
    color: Palette.white,
  },
  loadMoreBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: {
    fontFamily: FontFamilies.semiBold,
    fontSize: 13,
  },
});
