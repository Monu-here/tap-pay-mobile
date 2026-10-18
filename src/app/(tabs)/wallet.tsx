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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { PrimaryButton } from '@/components/ui/primary-button';
import { Brand, Spacing } from '@/constants/theme';
import {
  getDashboard,
  getPayment,
  getPaymentGateways,
  getWalletTransactions,
  simulatePayment,
  topUp,
  verifyPayment,
  type PaymentGateway,
  type WalletSummary,
  type WalletTransaction,
} from '@/features/passenger/services/passengerApi';
import {
  isFailedPaymentStatus,
  isSuccessfulPaymentStatus,
} from '@/features/passenger/services/paymentStatus';
import { createIdempotencyKey } from '@/features/auth/services/apiClient';

type PendingPayment = { reference: string; amount: number };

export default function WalletScreen() {
  const insets = useSafeAreaInsets();

  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'credit' | 'debit'>('all');

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
      const [dashRes, txnsRes, gwRes] = await Promise.all([
        getDashboard(),
        getWalletTransactions(1),
        getPaymentGateways(),
      ]);

      if (dashRes.ok && dashRes.data) {
        setWallet(dashRes.data.wallet);
      }
      if (txnsRes.ok && txnsRes.data) {
        setTransactions(txnsRes.data.transactions || []);
      }
      if (gwRes.ok && gwRes.data) {
        setGateways(gwRes.data.gateways || []);
        setSelectedGateway((current) =>
          gwRes.data.gateways.some((gateway) => gateway.slug === current)
            ? current
            : (gwRes.data.gateways[0]?.slug ?? ''),
        );
      }
      const failures = [dashRes, txnsRes, gwRes].filter((result) => !result.ok);
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
    const num = parseFloat(amountInput);
    if (isNaN(num) || num <= 0) {
      setErrorMessage('Please enter a valid amount.');
      return;
    }
    if (!selectedGateway) {
      setErrorMessage('No supported payment gateway is currently available. Please try again later.');
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);

    try {
      const amountMinor = Math.round(num * 100);
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
      const pending = { reference: payment.reference, amount: num };
      setPendingPayment(pending);
      setTopUpSuccess(null);

      // A dummy payment can be simulated, but its status is still confirmed by
      // the payment endpoints before the UI reports a wallet credit.
      if (selectedGateway === 'dummy') {
        const token = topUpRes.data.checkout?.extra?.token;
        const simRes = await simulatePayment(payment.reference, token);
        if (!simRes.ok) {
          setErrorMessage(simRes.message || 'Payment simulation failed.');
          return;
        }
        await checkPaymentStatus(pending);
      } else {
        const redirectUrl = topUpRes.data.checkout?.checkout?.url;
        if (!redirectUrl) {
          setErrorMessage('Checkout was created without a payment URL. Verify the payment status to continue.');
          setPaymentStatusMessage(null);
          return;
        }
        try {
          await Linking.openURL(redirectUrl);
        } catch {
          setErrorMessage('Could not open the payment checkout. You can still check the payment status.');
        }
        setPaymentStatusMessage(
          `Checkout started with ${selectedGateway.toUpperCase()}. Complete payment, then return here to verify it.`,
        );
        void checkPaymentStatus(pending);
      }
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Wallet &amp; Payments</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => loadWalletData(true)}
          style={styles.refreshIcon}
        >
          <SymbolView
            name={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }}
            size={20}
            tintColor={Brand.text}
          />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadWalletData(true)} tintColor={Brand.teal.primary} />
        }
      >
        {loadError ? (
          <View style={styles.loadErrorBox}>
            <Text style={styles.errorBanner}>{loadError}</Text>
            <Pressable onPress={() => loadWalletData(true)} accessibilityRole="button">
              <Text style={styles.loadRetryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceCardTop}>
            <View style={styles.balanceTag}>
              <SymbolView
                name={{ ios: 'checkmark.shield.fill', android: 'verified', web: 'verified' }}
                size={16}
                tintColor="#4ADE80"
              />
              <Text style={styles.balanceTagText}>LEDGER VERIFIED BALANCE</Text>
            </View>
            <Text style={styles.currencyCode}>{wallet?.currency || 'NPR'}</Text>
          </View>

          <Text style={styles.balanceDisplay}>
            {wallet?.balance_formatted || 'Rs. 0.00'}
          </Text>

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
                size={20}
                tintColor={Brand.teal.text}
              />
              <Text style={styles.actionTopUpText}>Add Money</Text>
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
                size={20}
                tintColor={Brand.white}
              />
              <Text style={styles.actionWithdrawText}>Transfer</Text>
            </Pressable>
          </View>
        </View>

        {/* Ledger Transactions Section */}
        <View style={styles.ledgerHeader}>
          <Text style={styles.sectionHeading}>Transaction History</Text>
          <View style={styles.filterPills}>
            <Pressable
              onPress={() => setFilter('all')}
              style={[styles.filterPill, filter === 'all' && styles.filterPillActive]}
            >
              <Text style={[styles.filterPillText, filter === 'all' && styles.filterPillTextActive]}>All</Text>
            </Pressable>
            <Pressable
              onPress={() => setFilter('credit')}
              style={[styles.filterPill, filter === 'credit' && styles.filterPillActive]}
            >
              <Text style={[styles.filterPillText, filter === 'credit' && styles.filterPillTextActive]}>Credits</Text>
            </Pressable>
            <Pressable
              onPress={() => setFilter('debit')}
              style={[styles.filterPill, filter === 'debit' && styles.filterPillActive]}
            >
              <Text style={[styles.filterPillText, filter === 'debit' && styles.filterPillTextActive]}>Debits</Text>
            </Pressable>
          </View>
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={Brand.teal.primary} />
            <Text style={styles.loadingText}>Fetching statement rows...</Text>
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
                  <View style={[styles.txnIconWrap, isCredit ? styles.txnCreditBg : styles.txnDebitBg]}>
                    <SymbolView
                      name={{
                        ios: isCredit ? 'arrow.down.left' : 'arrow.up.right',
                        android: isCredit ? 'arrow_downward' : 'arrow_upward',
                        web: isCredit ? 'arrow_downward' : 'arrow_upward',
                      }}
                      size={18}
                      tintColor={isCredit ? '#16A34A' : '#DC2626'}
                    />
                  </View>

                  <View style={styles.txnCenter}>
                    <Text style={styles.txnTitle} numberOfLines={1}>
                      {item.description || item.type}
                    </Text>
                    <Text style={styles.txnRef}>{item.reference}</Text>
                    <Text style={styles.txnDate}>{new Date(item.created_at).toLocaleString()}</Text>
                  </View>

                  <View style={styles.txnRight}>
                    <Text style={[styles.txnAmount, isCredit ? styles.txnCreditText : styles.txnDebitText]}>
                      {isCredit ? '+' : '-'}Rs. {(item.amount_minor / 100).toFixed(2)}
                    </Text>
                    <View style={styles.txnStatusBadge}>
                      <Text style={styles.txnStatusText}>{item.status}</Text>
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
              tintColor={Brand.textSecondary}
            />
            <Text style={styles.emptyTitle}>No Transactions Found</Text>
            <Text style={styles.emptySubtitle}>Your top-ups and tap payments will appear here.</Text>
          </View>
        )}
      </ScrollView>

      {/* Top Up / Add Money Modal */}
      <Modal visible={topUpModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Money to Wallet</Text>
              <Pressable onPress={() => setTopUpModalVisible(false)} hitSlop={8}>
                <SymbolView
                  name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                  size={24}
                  tintColor={Brand.textSecondary}
                />
              </Pressable>
            </View>

            {topUpSuccess ? (
              <View style={styles.modalSuccessBox}>
                <SymbolView
                  name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                  size={48}
                  tintColor={Brand.teal.primary}
                />
                <Text style={styles.modalSuccessText}>{topUpSuccess}</Text>
                <PrimaryButton
                  title="Done"
                  onPress={() => {
                    setTopUpSuccess(null);
                    setPendingPayment(null);
                    setTopUpModalVisible(false);
                  }}
                  style={styles.modalDoneButton}
                />
              </View>
            ) : pendingPayment ? (
              <View style={styles.paymentPendingBox}>
                <ActivityIndicator color={Brand.teal.primary} animating={isProcessing} />
                <Text style={styles.paymentPendingText}>
                  {paymentStatusMessage || 'Payment has not yet been confirmed.'}
                </Text>
                <Text style={styles.paymentReference}>Reference: {pendingPayment.reference}</Text>
                {errorMessage && <Text style={styles.errorBanner}>{errorMessage}</Text>}
                <PrimaryButton
                  title={isProcessing ? 'Checking Payment...' : 'Check Payment Status'}
                  onPress={() => void checkPaymentStatus(pendingPayment)}
                  disabled={isProcessing}
                  style={styles.modalDoneButton}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={isProcessing}
                  onPress={() => {
                    setPendingPayment(null);
                    setPaymentStatusMessage(null);
                    setErrorMessage(null);
                    setTopUpModalVisible(false);
                  }}
                >
                  <Text style={styles.closePendingText}>Close</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.modalForm}>
                <Text style={styles.inputLabel}>Enter Amount (NPR)</Text>
                <View style={styles.amountInputWrap}>
                  <Text style={styles.currencyPrefix}>Rs.</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={amountInput}
                    onChangeText={(val) => {
                      setAmountInput(val);
                      setErrorMessage(null);
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                {/* Preset Chips */}
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
                      <Text style={[
                        styles.presetChipText,
                        amountInput === amt.toString() && styles.presetChipTextActive,
                      ]}>
                        Rs. {amt}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Payment Gateway Selector */}
                <Text style={[styles.inputLabel, { marginTop: Spacing.three }]}>Select Payment Gateway</Text>
                <View style={styles.gatewaysList}>
                  {gateways.length > 0 ? (
                    <>
                    {gateways.map((gw) => (
                      <Pressable
                        key={gw.slug}
                        onPress={() => setSelectedGateway(gw.slug)}
                        style={[
                          styles.gatewayItem,
                          selectedGateway === gw.slug && styles.gatewayItemActive,
                        ]}
                      >
                        <View style={styles.gatewayInfo}>
                          <Text style={styles.gatewayName}>{gw.name}</Text>
                          {gw.slug === 'dummy' && (
                            <Text style={styles.gatewayBadge}>Instant Simulator</Text>
                          )}
                        </View>
                        <SymbolView
                          name={{
                            ios: selectedGateway === gw.slug ? 'checkmark.circle.fill' : 'circle',
                            android: selectedGateway === gw.slug ? 'check_circle' : 'radio_button_unchecked',
                            web: selectedGateway === gw.slug ? 'check_circle' : 'radio_button_unchecked',
                          }}
                          size={20}
                          tintColor={selectedGateway === gw.slug ? Brand.teal.primary : Brand.textSecondary}
                        />
                      </Pressable>
                    ))}
                    <Text style={styles.gatewayNotice}>
                      Only Tap &amp; Pay checkout sessions verified by the server can load your wallet.
                      Scanning a merchant eSewa QR does not fund this wallet.
                    </Text>
                    </>
                  ) : (
                    <Text style={styles.errorBanner}>
                      No supported payment gateway is configured on the server.
                    </Text>
                  )}
                </View>

                {errorMessage && (
                  <Text style={styles.errorBanner}>{errorMessage}</Text>
                )}

                <PrimaryButton
                  title={isProcessing ? 'Processing Payment...' : `Pay Rs. ${amountInput || '0'}`}
                  onPress={handleTopUpSubmit}
                  disabled={isProcessing || !amountInput || !selectedGateway}
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
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Brand.text,
  },
  refreshIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.four,
  },
  balanceCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
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
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  currencyCode: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
  balanceDisplay: {
    fontSize: 36,
    fontWeight: '800',
    color: Brand.white,
    letterSpacing: -0.5,
  },
  balanceActionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  actionTopUp: {
    flex: 1,
    backgroundColor: Brand.teal.soft,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  actionTopUpText: {
    color: Brand.teal.text,
    fontSize: 14,
    fontWeight: '700',
  },
  actionWithdraw: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  actionWithdrawText: {
    color: Brand.white,
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
    fontSize: 18,
    fontWeight: '700',
    color: Brand.text,
  },
  filterPills: {
    flexDirection: 'row',
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: Brand.teal.primary,
  },
  filterPillText: {
    fontSize: 12,
    color: Brand.textSecondary,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: Brand.white,
  },
  loadingContainer: {
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.two,
  },
  loadingText: {
    fontSize: 13,
    color: Brand.textSecondary,
  },
  transactionList: {
    backgroundColor: Brand.white,
    borderRadius: 16,
    paddingHorizontal: Spacing.four,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  txnIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txnCreditBg: {
    backgroundColor: '#DCFCE7',
  },
  txnDebitBg: {
    backgroundColor: '#FEE2E2',
  },
  txnCenter: {
    flex: 1,
  },
  txnTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.text,
  },
  txnRef: {
    fontSize: 12,
    color: Brand.textSecondary,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  txnDate: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  txnRight: {
    alignItems: 'flex-end',
  },
  txnAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  txnCreditText: {
    color: '#16A34A',
  },
  txnDebitText: {
    color: '#DC2626',
  },
  txnStatusBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  txnStatusText: {
    fontSize: 11,
    color: Brand.textSecondary,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  emptyContainer: {
    backgroundColor: Brand.white,
    borderRadius: 16,
    padding: Spacing.six,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: Spacing.two,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Brand.textSecondary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Brand.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
    color: Brand.text,
  },
  modalForm: {
    gap: Spacing.two,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.textSecondary,
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.inputBackground,
    borderRadius: 14,
    paddingHorizontal: Spacing.four,
    height: 56,
    gap: Spacing.two,
  },
  currencyPrefix: {
    fontSize: 20,
    fontWeight: '700',
    color: Brand.text,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: Brand.text,
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
    backgroundColor: Brand.inputBackground,
  },
  presetChipActive: {
    backgroundColor: Brand.teal.soft,
  },
  presetChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.textSecondary,
  },
  presetChipTextActive: {
    color: Brand.teal.text,
  },
  gatewaysList: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  gatewayNotice: {
    fontSize: 12,
    lineHeight: 17,
    color: Brand.textSecondary,
    marginTop: Spacing.one,
  },
  gatewayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: Brand.white,
  },
  gatewayItemActive: {
    borderColor: Brand.teal.primary,
    backgroundColor: '#F0FDFA',
  },
  gatewayInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  gatewayName: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.text,
  },
  gatewayBadge: {
    fontSize: 11,
    color: Brand.teal.text,
    backgroundColor: Brand.teal.soft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    fontWeight: '600',
  },
  errorBanner: {
    color: Brand.error,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  loadErrorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  loadRetryText: {
    color: Brand.teal.text,
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
    color: Brand.teal.text,
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
    color: Brand.text,
    textAlign: 'center',
    lineHeight: 22,
  },
  paymentReference: {
    fontSize: 12,
    color: Brand.textSecondary,
  },
  closePendingText: {
    paddingVertical: Spacing.two,
    color: Brand.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
