import {AppText, AppTextInput } from '@/components/typography/app-text';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
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

import { PrimaryButton } from '@/components/ui/primary-button';
import { Monochrome, Spacing } from '@/constants/theme';
import {
  getDashboard,
  getPayment,
  getPaymentGateways,
  getWalletTransactions,
  getWalletStatementSummary,
  topUp,
  verifyPayment,
  type PaymentGateway,
  type WalletSummary,
  type WalletTransaction,
  type WalletStatementSummary,
} from '@/features/passenger/services/passengerApi';
import {
  isFailedPaymentStatus,
  isSuccessfulPaymentStatus,
} from '@/features/passenger/services/paymentStatus';
import { createIdempotencyKey } from '@/features/auth/services/apiClient';

type PendingPayment = { reference: string; amount: number };

function parseAmountMinor(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;

  const [whole, fraction = ''] = normalized.split('.');
  const amountMinor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(amountMinor) && amountMinor > 0 ? amountMinor : null;
}

export default function WalletScreen() {
  const insets = useSafeAreaInsets();

  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [statementSummary, setStatementSummary] = useState<WalletStatementSummary | null>(null);
  const [transactionCursor, setTransactionCursor] = useState<string | null>(null);
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [transactionType, setTransactionType] = useState<'all' | 'load' | 'fare'>('all');
  const [transactionStatus, setTransactionStatus] = useState<'all' | 'pending' | 'successful' | 'failed' | 'reversed'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statementLoading, setStatementLoading] = useState(false);

  // Top Up Modal State
  const [topUpModalVisible, setTopUpModalVisible] = useState(false);
  const [amountInput, setAmountInput] = useState('500');
  const [selectedGateway, setSelectedGateway] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [topUpSuccess, setTopUpSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paymentStatusMessage, setPaymentStatusMessage] = useState<string | null>(null);
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const paymentCheckInProgress = useRef(false);
  const topUpRequest = useRef<{ fingerprint: string; key: string } | null>(null);
  const previousAppState = useRef(AppState.currentState);

  const PRESET_AMOUNTS = [100, 200, 500, 1000, 2000];

  const loadWalletData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    try {
      const [dashRes, txnsRes, gwRes, summaryRes] = await Promise.all([
        getDashboard(),
        getWalletTransactions({ perPage: 100 }),
        getPaymentGateways(),
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
      if (gwRes.ok && gwRes.data) {
        setGateways(gwRes.data.gateways || []);
        setSelectedGateway((current) =>
          gwRes.data.gateways.some((gateway) => gateway.slug === current)
            ? current
            : (gwRes.data.gateways[0]?.slug ?? ''),
        );
      }
      const failures = [dashRes, txnsRes, gwRes, summaryRes].filter((result) => !result.ok);
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

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadWalletData();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadWalletData]);

  const checkPaymentStatus = useCallback(async (payment: PendingPayment) => {
    if (paymentCheckInProgress.current) return;
    paymentCheckInProgress.current = true;
    setIsProcessing(true);
    setErrorMessage(null);
    setPaymentStatusMessage('Verifying payment with the server...');

    try {
      const verification = await verifyPayment(payment.reference);
      if (!verification.ok || !verification.data?.payment) {
        setPaymentStatusMessage(null);
        setErrorMessage(verification.message || 'Unable to verify this payment.');
        return;
      }

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const paymentResult = await getPayment(payment.reference);
        if (!paymentResult.ok || !paymentResult.data?.payment) {
          setPaymentStatusMessage(null);
          setErrorMessage(paymentResult.message || 'Unable to retrieve payment status.');
          return;
        }

        const status = paymentResult.data.payment.status;
        if (isSuccessfulPaymentStatus(status)) {
          setPendingPayment(null);
          setPaymentStatusMessage(null);
          setTopUpSuccess(`Rs. ${payment.amount.toFixed(2)} has been credited to your wallet.`);
          await loadWalletData(true);
          return;
        }
        if (isFailedPaymentStatus(status)) {
          setPaymentStatusMessage(null);
          setErrorMessage(`Payment ${status.toLowerCase()}. Reference: ${payment.reference}`);
          return;
        }

        if (attempt < 4) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }

      setPaymentStatusMessage(
        `Payment is still pending. Reference: ${payment.reference}. Check again after completing checkout.`,
      );
    } catch {
      setPaymentStatusMessage(null);
      setErrorMessage('Unable to verify payment status. Please try again.');
    } finally {
      paymentCheckInProgress.current = false;
      setIsProcessing(false);
    }
  }, [loadWalletData]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const returnedToApp =
        /inactive|background/.test(previousAppState.current) && nextState === 'active';
      previousAppState.current = nextState;
      if (returnedToApp && pendingPayment) {
        void checkPaymentStatus(pendingPayment);
      }
    });
    return () => subscription.remove();
  }, [checkPaymentStatus, pendingPayment]);

  const handleTopUpSubmit = async () => {
    const amountMinor = parseAmountMinor(amountInput);
    if (amountMinor === null) {
      setErrorMessage('Enter a valid amount with no more than two decimal places.');
      return;
    }
    const gateway = gateways.find((item) => item.slug === selectedGateway);
    if (!gateway || gateway.slug !== 'esewa') {
      setErrorMessage('eSewa wallet top-up is not currently available. Please try again later.');
      return;
    }
    if ((gateway.min_amount_minor !== undefined && amountMinor < gateway.min_amount_minor)
      || (gateway.max_amount_minor !== undefined && amountMinor > gateway.max_amount_minor)) {
      setErrorMessage('The entered amount is outside the eSewa top-up limits.');
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);

    try {
      const fingerprint = `${amountMinor}:${selectedGateway}`;
      if (!topUpRequest.current || topUpRequest.current.fingerprint !== fingerprint) {
        topUpRequest.current = { fingerprint, key: createIdempotencyKey() };
      }
      const topUpRes = await topUp(amountMinor, selectedGateway, topUpRequest.current.key);

      if (!topUpRes.ok || !topUpRes.data) {
        if (topUpRes.status >= 400 && topUpRes.status < 500 && topUpRes.status !== 429) {
          topUpRequest.current = null;
        }
        setErrorMessage(topUpRes.message || 'Unable to initiate top up.');
        setIsProcessing(false);
        return;
      }

      topUpRequest.current = null;
      const payment = topUpRes.data.payment;
      const pending = { reference: payment.reference, amount: amountMinor / 100 };
      setPendingPayment(pending);
      setTopUpSuccess(null);

      const redirectUrl = topUpRes.data.checkout?.checkout?.url;
      if (!redirectUrl) {
        setErrorMessage('eSewa checkout was created without a payment URL. Verify the payment status to continue.');
        setPaymentStatusMessage(null);
        return;
      }
      try {
        await Linking.openURL(redirectUrl);
      } catch {
        setErrorMessage('Could not open the eSewa checkout. You can retry checkout or check the payment status.');
      }
      setPaymentStatusMessage('Complete payment in eSewa, then return here to verify it.');
    } catch {
      setErrorMessage('Network error while processing payment.');
    } finally {
      setIsProcessing(false);
    }
  };

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
        <AppText style={styles.headerTitle}>Wallet &amp; Payments</AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open travel history"
          onPress={() => router.push('/travel' as any)}
          style={styles.travelHistoryButton}
        >
          <AppText style={styles.travelHistoryLink}>Travel</AppText>
        </Pressable>
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

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceCardTop}>
            <View style={styles.balanceTag}>
              <SymbolView
                name={{ ios: 'checkmark.shield.fill', android: 'verified', web: 'verified' }}
                size={14}
                tintColor={Monochrome.textPrimary}
              />
              <AppText style={styles.balanceTagText}>VERIFIED WALLET BALANCE</AppText>
            </View>
            <AppText style={styles.currencyCode}>{wallet?.currency || 'NPR'}</AppText>
          </View>

          <AppText style={styles.balanceDisplay}>
            {wallet?.balance_formatted || 'Rs. 0.00'}
          </AppText>

          <View style={styles.balanceActionRow}>
            <Pressable
              onPress={() => {
                setErrorMessage(null);
                setTopUpSuccess(null);
                setTopUpModalVisible(true);
              }}
              style={styles.actionTopUp}
            >
              <SymbolView
                name={{ ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' }}
                size={18}
                tintColor={Monochrome.actionPrimaryText}
              />
              <AppText style={styles.actionTopUpText}>Add Money</AppText>
            </Pressable>

            <Pressable
              onPress={() => {
                Alert.alert(
                  'Withdrawal & Transfer',
                  'Wallet funds are reserved for transit fares and authorized merchant payments.',
                );
              }}
              style={styles.actionWithdraw}
            >
              <SymbolView
                name={{ ios: 'arrow.up.right.circle', android: 'north_east', web: 'north_east' }}
                size={18}
                tintColor={Monochrome.textPrimary}
              />
              <AppText style={styles.actionWithdrawText}>Transfer</AppText>
            </Pressable>
          </View>
        </View>

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

      {/* Top Up / Add Money Modal */}
      <Modal visible={topUpModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <AppText style={styles.modalTitle}>Add Money to Wallet</AppText>
              <Pressable onPress={() => setTopUpModalVisible(false)} hitSlop={8}>
                <SymbolView
                  name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                  size={22}
                  tintColor={Monochrome.textMuted}
                />
              </Pressable>
            </View>

            {pendingPayment ? (
              <View style={styles.paymentPendingBox}>
                <ActivityIndicator size="large" color={Monochrome.textPrimary} />
                <AppText style={styles.paymentPendingText}>
                  {paymentStatusMessage || 'Awaiting payment confirmation...'}
                </AppText>
                <AppText style={styles.paymentReference}>Reference: {pendingPayment.reference}</AppText>
                <PrimaryButton
                  title={isProcessing ? 'Verifying...' : 'Check Payment Status'}
                  onPress={() => void checkPaymentStatus(pendingPayment)}
                  disabled={isProcessing}
                  style={styles.modalDoneButton}
                />
                <Pressable
                  onPress={() => {
                    setPendingPayment(null);
                    setPaymentStatusMessage(null);
                  }}
                  accessibilityRole="button"
                >
                  <AppText style={styles.closePendingText}>Cancel Check</AppText>
                </Pressable>
              </View>
            ) : topUpSuccess ? (
              <View style={styles.modalSuccessBox}>
                <SymbolView
                  name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                  size={52}
                  tintColor={Monochrome.textPrimary}
                />
                <AppText style={styles.modalSuccessText}>{topUpSuccess}</AppText>
                <PrimaryButton
                  title="Done"
                  onPress={() => {
                    setTopUpSuccess(null);
                    setTopUpModalVisible(false);
                  }}
                  style={styles.modalDoneButton}
                />
              </View>
            ) : (
              <View style={styles.modalForm}>
                <AppText style={styles.inputLabel}>Enter Amount (NPR)</AppText>
                <View style={styles.amountInputWrap}>
                  <AppText style={styles.currencyPrefix}>Rs.</AppText>
                  <AppTextInput
                    style={styles.amountInput}
                    keyboardType="numeric"
                    value={amountInput}
                    onChangeText={setAmountInput}
                    placeholder="0"
                    placeholderTextColor={Monochrome.textMuted}
                  />
                </View>

                {/* Amount Quick Presets */}
                <View style={styles.presetsRow}>
                  {PRESET_AMOUNTS.map((amt) => (
                    <Pressable
                      key={amt}
                      onPress={() => setAmountInput(amt.toString())}
                      style={[
                        styles.presetChip,
                        amountInput === amt.toString() && styles.presetChipActive,
                      ]}
                    >
                      <AppText
                        style={[
                          styles.presetChipText,
                          amountInput === amt.toString() && styles.presetChipTextActive,
                        ]}
                      >
                        +Rs. {amt}
                      </AppText>
                    </Pressable>
                  ))}
                </View>

                {/* Gateway Selector */}
                <AppText style={[styles.inputLabel, { marginTop: Spacing.three }]}>
                  Select Payment Gateway
                </AppText>
                <View style={styles.gatewaysList}>
                  {gateways.length > 0 ? (
                    gateways.map((gw) => (
                      <Pressable
                        key={gw.slug}
                        onPress={() => setSelectedGateway(gw.slug)}
                        style={[
                          styles.gatewayItem,
                          selectedGateway === gw.slug && styles.gatewayItemActive,
                        ]}
                      >
                        <View style={styles.gatewayInfo}>
                          <AppText style={styles.gatewayName}>{gw.name}</AppText>
                          {gw.currency ? (
                            <AppText style={styles.gatewayBadge}>{gw.currency}</AppText>
                          ) : null}
                        </View>
                        <SymbolView
                          name={{
                            ios: selectedGateway === gw.slug ? 'checkmark.circle.fill' : 'circle',
                            android: selectedGateway === gw.slug ? 'check_circle' : 'radio_button_unchecked',
                            web: selectedGateway === gw.slug ? 'check_circle' : 'radio_button_unchecked',
                          }}
                          size={18}
                          tintColor={Monochrome.textPrimary}
                        />
                      </Pressable>
                    ))
                  ) : (
                    <AppText style={styles.gatewayNotice}>
                      No online payment gateways are currently configured on this server.
                    </AppText>
                  )}
                </View>

                <View style={styles.paymentSummary}>
                  <AppText style={styles.summaryTitle}>Payment summary</AppText>
                  <AppText style={styles.summaryRow}>Amount to add: Rs. {((parseAmountMinor(amountInput) ?? 0) / 100).toFixed(2)}</AppText>
                  <AppText style={styles.summaryRow}>Payment method: {gateways.find((gateway) => gateway.slug === selectedGateway)?.name ?? 'eSewa unavailable'}</AppText>
                  <AppText style={styles.summaryRow}>Current wallet balance: {wallet?.balance_formatted ?? 'Unavailable'}</AppText>
                  <AppText style={styles.summaryRow}>
                    Projected balance after verified payment: Rs. {(((wallet?.balance_minor ?? 0) + (parseAmountMinor(amountInput) ?? 0)) / 100).toFixed(2)}
                  </AppText>
                  <AppText style={styles.summaryNote}>Your wallet is credited only after the server verifies eSewa payment.</AppText>
                </View>

                {errorMessage && <AppText style={styles.errorBanner}>{errorMessage}</AppText>}

                <PrimaryButton
                  title={isProcessing ? 'Processing...' : 'Confirm and Continue to eSewa'}
                  onPress={handleTopUpSubmit}
                  disabled={isProcessing || gateways.length === 0}
                  style={styles.modalSubmitButton}
                />
              </View>
            )}
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Monochrome.surfacePrimary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: Monochrome.border,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  modalForm: {
    gap: Spacing.two,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Monochrome.textSecondary,
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 14,
    paddingHorizontal: Spacing.four,
    height: 56,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  presetChipActive: {
    backgroundColor: Monochrome.surfaceElevated,
    borderColor: Monochrome.textPrimary,
  },
  presetChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Monochrome.textMuted,
  },
  presetChipTextActive: {
    color: Monochrome.textPrimary,
  },
  gatewaysList: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  paymentSummary: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderColor: Monochrome.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  summaryTitle: {
    color: Monochrome.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  summaryRow: {
    color: Monochrome.textSecondary,
    fontSize: 13,
  },
  summaryNote: {
    color: Monochrome.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  gatewayNotice: {
    fontSize: 12,
    lineHeight: 17,
    color: Monochrome.textMuted,
    marginTop: Spacing.one,
  },
  gatewayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Monochrome.border,
    backgroundColor: Monochrome.surfaceSecondary,
  },
  gatewayItemActive: {
    borderColor: Monochrome.textPrimary,
    backgroundColor: Monochrome.surfaceElevated,
  },
  gatewayInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  gatewayName: {
    fontSize: 14,
    fontWeight: '600',
    color: Monochrome.textPrimary,
  },
  gatewayBadge: {
    fontSize: 11,
    color: Monochrome.textSecondary,
    backgroundColor: Monochrome.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    fontWeight: '600',
  },
  errorBanner: {
    color: Monochrome.textPrimary,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  loadErrorBox: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.one,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  loadRetryText: {
    color: Monochrome.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  modalSubmitButton: {
    marginTop: Spacing.four,
  },
  modalSuccessBox: {
    paddingVertical: Spacing.five,
    alignItems: 'center',
    gap: Spacing.three,
  },
  modalSuccessText: {
    fontSize: 16,
    fontWeight: '600',
    color: Monochrome.textPrimary,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalDoneButton: {
    width: '100%',
    marginTop: Spacing.three,
  },
  paymentPendingBox: {
    paddingVertical: Spacing.five,
    alignItems: 'center',
    gap: Spacing.three,
  },
  paymentPendingText: {
    fontSize: 15,
    fontWeight: '600',
    color: Monochrome.textPrimary,
    textAlign: 'center',
    lineHeight: 22,
  },
  paymentReference: {
    fontSize: 12,
    color: Monochrome.textMuted,
  },
  closePendingText: {
    paddingVertical: Spacing.two,
    color: Monochrome.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
});
