import { AppText, AppTextInput } from '@/components/typography/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Monochrome, Spacing } from '@/constants/theme';
import { createIdempotencyKey } from '@/features/auth/services/apiClient';
import {
  getPayment,
  getPaymentGateways,
  topUp,
  verifyPayment,
  type PaymentGateway,
  type WalletSummary,
} from '@/features/passenger/services/passengerApi';
import {
  isFailedPaymentStatus,
  isSuccessfulPaymentStatus,
} from '@/features/passenger/services/paymentStatus';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type PendingPayment = { reference: string; amount: number };

type AddMoneyModalProps = {
  visible: boolean;
  wallet: WalletSummary | null;
  onClose: () => void;
  onPaymentVerified?: () => Promise<void>;
};

const PRESET_AMOUNTS = [100, 200, 500, 1000, 2000];

function parseAmountMinor(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;

  const [whole, fraction = ''] = normalized.split('.');
  const amountMinor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(amountMinor) && amountMinor > 0 ? amountMinor : null;
}

export function AddMoneyModal({
  visible,
  wallet,
  onClose,
  onPaymentVerified,
}: AddMoneyModalProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [amountInput, setAmountInput] = useState('500');
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [selectedGateway, setSelectedGateway] = useState('');
  const [gatewayLoading, setGatewayLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [topUpSuccess, setTopUpSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paymentStatusMessage, setPaymentStatusMessage] = useState<string | null>(null);
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const paymentCheckInProgress = useRef(false);
  const topUpInProgress = useRef(false);
  const topUpRequest = useRef<{ fingerprint: string; key: string } | null>(null);
  const previousAppState = useRef(AppState.currentState);
  const gatewaysLoaded = useRef(false);

  useEffect(() => {
    if (!visible || gatewaysLoaded.current) return undefined;

    let active = true;

    void getPaymentGateways()
      .then((result) => {
        if (!active) return;
        if (!result.ok || !result.data) {
          setErrorMessage(result.message || 'Unable to load payment gateways.');
          setGateways([]);
          setSelectedGateway('');
          return;
        }

        const availableGateways = result.data.gateways || [];
        gatewaysLoaded.current = true;
        setGateways(availableGateways);
        setSelectedGateway((current) =>
          availableGateways.some((gateway) => gateway.slug === current)
            ? current
            : (availableGateways[0]?.slug ?? ''),
        );
      })
      .catch((error: unknown) => {
        if (!active) return;
        setGateways([]);
        setSelectedGateway('');
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load payment gateways.');
      })
      .finally(() => {
        if (active) setGatewayLoading(false);
      });

    return () => {
      active = false;
    };
  }, [visible]);

  const handleClose = () => {
    setErrorMessage(null);
    setTopUpSuccess(null);
    onClose();
  };

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
          await onPaymentVerified?.();
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
  }, [onPaymentVerified]);

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
    if (topUpInProgress.current || isProcessing) return;
    topUpInProgress.current = true;

    const amountMinor = parseAmountMinor(amountInput);
    if (amountMinor === null) {
      setErrorMessage('Enter a valid amount with no more than two decimal places.');
      topUpInProgress.current = false;
      return;
    }
    const gateway = gateways.find((item) => item.slug === selectedGateway);
    if (!gateway || gateway.slug !== 'esewa') {
      setErrorMessage('eSewa wallet top-up is not currently available. Please try again later.');
      topUpInProgress.current = false;
      return;
    }
    if ((gateway.min_amount_minor !== undefined && amountMinor < gateway.min_amount_minor)
      || (gateway.max_amount_minor !== undefined && amountMinor > gateway.max_amount_minor)) {
      setErrorMessage('The entered amount is outside the eSewa top-up limits.');
      topUpInProgress.current = false;
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
      topUpInProgress.current = false;
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close add money modal"
        >
          <View style={styles.modalBackdrop} />
        </Pressable>

        <View
          style={[
            styles.modalContent,
            {
              maxHeight: windowHeight * 0.9,
              paddingBottom: insets.bottom + 20,
            },
          ]}
        >
          <View style={styles.modalHeader}>
            <AppText style={styles.modalTitle}>Add Money to Wallet</AppText>
            <Pressable onPress={handleClose} hitSlop={8}>
              <SymbolView
                name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                size={22}
                tintColor={Monochrome.textMuted}
              />
            </Pressable>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
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
                    handleClose();
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
                    keyboardType="decimal-pad"
                    autoFocus
                    value={amountInput}
                    onChangeText={setAmountInput}
                    placeholder="0"
                    placeholderTextColor={Monochrome.textMuted}
                  />
                </View>

                <View style={styles.presetsRow}>
                  {PRESET_AMOUNTS.map((amount) => (
                    <Pressable
                      key={amount}
                      onPress={() => setAmountInput(amount.toString())}
                      style={[
                        styles.presetChip,
                        amountInput === amount.toString() && styles.presetChipActive,
                      ]}
                    >
                      <AppText
                        style={[
                          styles.presetChipText,
                          amountInput === amount.toString() && styles.presetChipTextActive,
                        ]}
                      >
                        +Rs. {amount}
                      </AppText>
                    </Pressable>
                  ))}
                </View>

                <AppText style={[styles.inputLabel, { marginTop: Spacing.three }]}>
                  Select Payment Gateway
                </AppText>
                <View style={styles.gatewaysList}>
                  {gatewayLoading ? (
                    <ActivityIndicator size="small" color={Monochrome.textPrimary} />
                  ) : gateways.length > 0 ? (
                    gateways.map((gateway) => (
                      <Pressable
                        key={gateway.slug}
                        onPress={() => setSelectedGateway(gateway.slug)}
                        style={[
                          styles.gatewayItem,
                          selectedGateway === gateway.slug && styles.gatewayItemActive,
                        ]}
                      >
                        <View style={styles.gatewayInfo}>
                          <AppText style={styles.gatewayName}>{gateway.name}</AppText>
                          {gateway.currency ? (
                            <AppText style={styles.gatewayBadge}>{gateway.currency}</AppText>
                          ) : null}
                        </View>
                        <SymbolView
                          name={{
                            ios: selectedGateway === gateway.slug ? 'checkmark.circle.fill' : 'circle',
                            android: selectedGateway === gateway.slug ? 'check_circle' : 'radio_button_unchecked',
                            web: selectedGateway === gateway.slug ? 'check_circle' : 'radio_button_unchecked',
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

                {/* <View style={styles.paymentSummary}>
                  <AppText style={styles.summaryTitle}>Payment summary</AppText>
                  <AppText style={styles.summaryRow}>
                    Amount to add: Rs. {((parseAmountMinor(amountInput) ?? 0) / 100).toFixed(2)}
                  </AppText>
                  <AppText style={styles.summaryRow}>
                    Payment method: {gateways.find((gateway) => gateway.slug === selectedGateway)?.name ?? 'eSewa unavailable'}
                  </AppText>
                  <AppText style={styles.summaryRow}>
                    Current wallet balance: {wallet?.balance_formatted ?? 'Unavailable'}
                  </AppText>
                  <AppText style={styles.summaryRow}>
                    Projected balance after verified payment: Rs. {(((wallet?.balance_minor ?? 0) + (parseAmountMinor(amountInput) ?? 0)) / 100).toFixed(2)}
                  </AppText>
                  <AppText style={styles.summaryNote}>
                    Your wallet is credited only after the server verifies eSewa payment.
                  </AppText>
                </View> */}

                {errorMessage ? <AppText style={styles.errorBanner}>{errorMessage}</AppText> : null}
              </View>
            )}
          </ScrollView>

          {!pendingPayment && !topUpSuccess ? (
            <PrimaryButton
              title={isProcessing ? 'Processing...' : 'Confirm and Continue to eSewa'}
              onPress={handleTopUpSubmit}
              disabled={isProcessing || gatewayLoading || gateways.length === 0}
              style={styles.modalSubmitButton}
            />
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  modalContent: {
    flexShrink: 1,
    backgroundColor: Monochrome.surfacePrimary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: Monochrome.border,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  modalScroll: {
    flexShrink: 1,
  },
  modalScrollContent: {
    paddingBottom: Spacing.one,
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
