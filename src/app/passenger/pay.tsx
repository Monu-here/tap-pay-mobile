import { AppText, AppTextInput } from '@/components/typography/app-text';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { Monochrome, Spacing } from '@/constants/theme';
import {
  getMpinStatus,
  payTransitFare,
  quoteTransitFare,
  type TransitFareQuote,
  type TransitFareTicket,
} from '@/features/passenger/services/passengerApi';
import { isConfirmedTransitFare } from '@/features/passenger/services/transitFeedback';
import { createIdempotencyKey } from '@/features/auth/services/apiClient';

export default function PassengerPayScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [torchOn, setTorchOn] = useState(false);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [quote, setQuote] = useState<TransitFareQuote | null>(null);
  const [ticket, setTicket] = useState<TransitFareTicket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [mpinConfigured, setMpinConfigured] = useState<boolean | null>(null);
  const [mpinStatusError, setMpinStatusError] = useState<string | null>(null);
  const [mpinModalVisible, setMpinModalVisible] = useState(false);
  const [mpinInput, setMpinInput] = useState('');
  const [mpinError, setMpinError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  const lastScannedTimeRef = useRef<number>(0);
  const isScanningRef = useRef<boolean>(false);
  const feedbackNavigationHandledRef = useRef(false);

  const openFeedback = useCallback(() => {
    if (!ticket || feedbackNavigationHandledRef.current) return;
    feedbackNavigationHandledRef.current = true;
    router.replace({
      pathname: '/passenger/feedback/[travelUid]',
      params: {
        travelUid: ticket.travel_uid,
        busNumber: ticket.bus_number,
        routeName: ticket.route_name,
        fare: ticket.fare_formatted,
        ticketNumber: ticket.ticket_number,
      },
    } as never);
  }, [ticket]);

  useEffect(() => {
    if (!ticket) return;
    const timeout = setTimeout(openFeedback, 2500);
    return () => clearTimeout(timeout);
  }, [ticket, openFeedback]);

  const insufficientBalance =
    quote !== null && quote.wallet.balance_minor < quote.fare.amount_minor;

  const handleScan = useCallback(
    async (payload: string) => {
      const now = Date.now();
      // Prevent duplicate rapid scans
      if (now - lastScannedTimeRef.current < 2500) return;
      if (isScanningRef.current || loading || quote || ticket) return;

      lastScannedTimeRef.current = now;
      isScanningRef.current = true;
      setLoading(true);
      setError(null);
      setQrPayload(payload);

      try {
        const result = await quoteTransitFare(payload);
        if (result.ok && result.data) {
          setQuote(result.data);
          setIdempotencyKey(createIdempotencyKey());
          const mpinStatus = await getMpinStatus();
          if (mpinStatus.ok) {
            setMpinConfigured(mpinStatus.data.configured);
            setMpinStatusError(null);
          } else {
            setMpinConfigured(null);
            setMpinStatusError(mpinStatus.message || 'Could not check your MPIN status.');
          }
        } else {
          setError(
            result.message ||
              'Invalid or unrecognized Tap & Pay transit QR. Please make sure you are scanning an authorized driver QR code.',
          );
          setQrPayload(null);
        }
      } catch {
        setError('Network error while verifying trip QR. Please check your connection and retry.');
        setQrPayload(null);
      } finally {
        setLoading(false);
        isScanningRef.current = false;
      }
    },
    [loading, quote, ticket],
  );

  const confirmPayment = async () => {
    if (!qrPayload || !idempotencyKey || paying) return;
    const status = await getMpinStatus();
    if (!status.ok) {
      setMpinStatusError(status.message || 'Could not check your MPIN status.');
      return;
    }
    setMpinConfigured(status.data.configured);
    setMpinStatusError(null);
    if (!status.data.configured) {
      router.push('/security/mpin' as never);
      return;
    }
    setMpinInput('');
    setMpinError(null);
    setMpinModalVisible(true);
  };

  const submitPayment = async () => {
    if (!qrPayload || !idempotencyKey || paying) return;
    if (!/^\d{4}$/.test(mpinInput)) {
      setMpinError('Enter your four-digit MPIN to authorize this fare.');
      return;
    }
    setPaying(true);
    setMpinError(null);

    try {
      if (!quote?.driver.id) {
        setMpinError('The verified driver details are missing. Scan the driver QR again.');
        return;
      }
      const result = await payTransitFare(qrPayload, mpinInput, quote.driver.id, idempotencyKey);
      if (result.ok && isConfirmedTransitFare(result.data?.ticket)) {
        setTicket(result.data.ticket);
        setMpinModalVisible(false);
        setMpinInput('');
      } else {
        setMpinError(result.message || 'Payment could not be confirmed. Check your transaction history before retrying.');
        setMpinInput('');
      }
    } catch {
      setMpinError('Connection dropped during confirmation. Re-enter your MPIN to safely check or retry this same payment.');
      setMpinInput('');
    } finally {
      setPaying(false);
    }
  };

  const reset = () => {
    feedbackNavigationHandledRef.current = false;
    lastScannedTimeRef.current = 0;
    isScanningRef.current = false;
    setQrPayload(null);
    setQuote(null);
    setTicket(null);
    setError(null);
    setIdempotencyKey(null);
    setMpinConfigured(null);
    setMpinStatusError(null);
    setMpinInput('');
    setMpinError(null);
    setMpinModalVisible(false);
  };

  const handleOpenSettings = () => {
    Linking.openSettings().catch(() => {
      Alert.alert('Unable to open settings', 'Open your device settings and allow camera access for Tap & Pay.');
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="dark" />

      {/* Navigation Header */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={8}
        >
          <SymbolView
            name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
            size={20}
            tintColor={Monochrome.textPrimary}
          />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <AppText style={styles.title}>Scan Driver QR to Pay</AppText>
          <AppText style={styles.subtitle}>Hold camera up to the driver&apos;s QR code</AppText>
        </View>

        {/* Torch Toggle Button */}
        {!ticket && !quote && permission?.granted ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setTorchOn((prev) => !prev)}
            style={[styles.torchButton, torchOn && styles.torchButtonActive]}
            hitSlop={8}
          >
            <SymbolView
              name={{
                ios: torchOn ? 'bolt.fill' : 'bolt.slash.fill',
                android: torchOn ? 'flash_on' : 'flash_off',
                web: torchOn ? 'flash_on' : 'flash_off',
              }}
              size={18}
              tintColor={Monochrome.textPrimary}
            />
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Scanner View */}
        {!ticket && !quote && (
          <View style={styles.scannerWrapper}>
            {!permission?.granted ? (
              <View style={styles.centerCard}>
                <View style={styles.permIconBox}>
                  <SymbolView
                    name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }}
                    size={32}
                    tintColor={Monochrome.textPrimary}
                  />
                </View>
                <AppText style={styles.cardTitle}>Camera Permission Required</AppText>
                <AppText style={styles.bodyText}>
                  Tap &amp; Pay needs camera access to scan driver payment QR codes on public buses.
                </AppText>
                <Pressable onPress={requestPermission} style={styles.primaryButton}>
                  <AppText style={styles.primaryText}>Grant Camera Access</AppText>
                </Pressable>
                <Pressable onPress={handleOpenSettings} style={styles.secondaryButton}>
                  <AppText style={styles.secondaryText}>Open App Settings</AppText>
                </Pressable>
              </View>
            ) : (
              <View style={styles.cameraBox}>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  enableTorch={torchOn}
                  onBarcodeScanned={loading ? undefined : ({ data }) => void handleScan(data)}
                />

                {/* Mask & Reticle Viewfinder Frame */}
                <View style={styles.viewfinderOverlay}>
                  <View style={styles.maskTop} />
                  <View style={styles.maskMiddleRow}>
                    <View style={styles.maskSide} />
                    <View style={styles.reticleFrame}>
                      {/* 4 Corner Markers */}
                      <View style={[styles.corner, styles.cornerTL]} />
                      <View style={[styles.corner, styles.cornerTR]} />
                      <View style={[styles.corner, styles.cornerBL]} />
                      <View style={[styles.corner, styles.cornerBR]} />

                      {loading ? (
                        <View style={styles.loadingContainer}>
                          <ActivityIndicator size="small" color={Monochrome.textPrimary} />
                          <AppText style={styles.loadingReticleText}>Verifying Fare Quote...</AppText>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.maskSide} />
                  </View>
                  <View style={styles.maskBottom}>
                    <AppText style={styles.cameraInstruction}>
                      Scan the driver&apos;s Tap &amp; Pay QR code
                    </AppText>
                    <AppText style={styles.cameraSubInstruction}>
                      Position the code inside the square frame
                    </AppText>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {!ticket && !quote && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show my transit QR pass"
            onPress={() => router.push('/passenger/qr' as never)}
            style={styles.myQrButton}
          >
            <View style={styles.myQrIconBox}>
              <SymbolView
                name={{ ios: 'qrcode', android: 'qr_code', web: 'qr_code' }}
                size={22}
                tintColor={Monochrome.textPrimary}
              />
            </View>
            <View style={styles.myQrCopy}>
              <AppText style={styles.myQrTitle}>Show My QR Pass</AppText>
              <AppText style={styles.myQrSubtitle}>Present your transit pass to the driver</AppText>
            </View>
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              size={18}
              tintColor={Monochrome.textSecondary}
            />
          </Pressable>
        )}

        {/* Fare Quote & Confirmation Card */}
        {quote && !ticket && (
          <View style={styles.quoteCard}>
            <View style={styles.quoteBadgeRow}>
              <View style={styles.verifiedBadge}>
                <SymbolView
                  name={{ ios: 'checkmark.shield.fill', android: 'verified', web: 'verified' }}
                  size={12}
                  tintColor={Monochrome.textPrimary}
                />
                <AppText style={styles.verifiedBadgeText}>VERIFIED TRIP QUOTE</AppText>
              </View>
              <AppText style={styles.refText}>Trip: {quote.trip_reference}</AppText>
            </View>

            <AppText style={styles.quoteRouteName}>{quote.route.name}</AppText>
            <AppText style={styles.quoteCompanyBus}>
              {quote.company.name ? `${quote.company.name} • ` : ''}Bus {quote.bus.bus_number}
            </AppText>
            <View style={styles.recipientCard}>
              {quote.driver.photo_url ? (
                <Image source={{ uri: quote.driver.photo_url }} style={styles.driverPhoto} />
              ) : (
                <View style={styles.driverPhotoFallback}>
                  <SymbolView name={{ ios: 'person.fill', android: 'person', web: 'person' }} size={20} tintColor={Monochrome.textPrimary} />
                </View>
              )}
              <View style={styles.recipientCopy}>
                <AppText style={styles.recipientLabel}>VERIFIED DRIVER</AppText>
                <AppText style={styles.recipientName}>{quote.driver.name || 'Driver identity unavailable'}</AppText>
                <AppText style={styles.recipientDetail}>
                  Fare for this trip is paid through Tap &amp; Pay; this is not a personal money transfer.
                </AppText>
              </View>
              {quote.driver.verified ? (
                <SymbolView name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }} size={18} tintColor={Monochrome.actionPrimary} />
              ) : null}
            </View>

            {quote.fare.boarding_stop_name ? (
              <View style={styles.stopRow}>
                <SymbolView
                  name={{ ios: 'mappin.circle.fill', android: 'place', web: 'place' }}
                  size={14}
                  tintColor={Monochrome.textSecondary}
                />
                <AppText style={styles.stopText}>Boarding: {quote.fare.boarding_stop_name}</AppText>
              </View>
            ) : null}

            <View style={styles.divider} />

            <View style={styles.amountBreakdown}>
              <View style={styles.amountRow}>
                <AppText style={styles.amountLabel}>Trip Fare</AppText>
                <AppText style={styles.fareAmount}>
                  NPR {quote.fare.amount_formatted || `Rs. ${(quote.fare.amount_minor / 100).toFixed(2)}`}
                </AppText>
              </View>

              <View style={styles.amountRow}>
                <AppText style={styles.amountLabel}>Wallet Balance</AppText>
                <AppText style={styles.balanceAmount}>
                  NPR {quote.wallet.balance_formatted || `Rs. ${(quote.wallet.balance_minor / 100).toFixed(2)}`}
                </AppText>
              </View>
            </View>

            {insufficientBalance ? (
              <View style={styles.warningBox}>
                <SymbolView
                  name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
                  size={16}
                  tintColor={Monochrome.textPrimary}
                />
                <AppText style={styles.warningText}>
                  Insufficient funds in your Tap &amp; Pay wallet to cover this bus fare. Please add money before proceeding.
                </AppText>
              </View>
            ) : (
              <AppText style={styles.securityNotice}>
                Fare is set by the server’s active fare rules. Review the verified driver and trip, then authorize with your MPIN. No extra fee is currently added.
              </AppText>
            )}

            <Pressable
              disabled={paying || insufficientBalance || !quote.driver.verified}
              onPress={() => void confirmPayment()}
              style={[
                styles.primaryButton,
                (paying || insufficientBalance || !quote.driver.verified) && styles.disabledButton,
              ]}
            >
              <AppText style={styles.primaryText}>
                {insufficientBalance
                  ? 'Insufficient Balance'
                  : !quote.driver.verified
                    ? 'Driver could not be verified'
                    : mpinConfigured === null
                      ? 'Check payment security'
                      : mpinConfigured
                        ? 'Review & Enter MPIN'
                        : 'Set Up MPIN to Pay'}
              </AppText>
            </Pressable>
            {mpinStatusError ? (
              <View style={styles.errorCard}>
                <AppText style={styles.errorText}>{mpinStatusError}</AppText>
                <Pressable onPress={() => void confirmPayment()} style={styles.errorRetryButton}>
                  <AppText style={styles.errorRetryText}>Retry security check</AppText>
                </Pressable>
              </View>
            ) : null}

            {insufficientBalance ? (
              <Pressable
                onPress={() => router.push('/(tabs)/wallet' as never)}
                style={styles.addMoneyButton}
              >
                <AppText style={styles.addMoneyText}>Add Money to Wallet</AppText>
              </Pressable>
            ) : null}

            <Pressable disabled={paying} onPress={reset} style={styles.secondaryButton}>
              <AppText style={styles.secondaryText}>Cancel</AppText>
            </Pressable>
          </View>
        )}

        {/* Digital Ticket / Receipt */}
        {ticket && (
          <View style={styles.ticketCard}>
            <View style={styles.successHeader}>
              <View style={styles.successIconCircle}>
                <SymbolView
                  name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                  size={20}
                  tintColor={Monochrome.actionPrimaryText}
                />
              </View>
              <AppText style={styles.successTitle}>Fare Payment Confirmed</AppText>
              <AppText style={styles.successSubtitle}>Digital transit ticket issued</AppText>
            </View>

            <View style={styles.ticketBody}>
              <View style={styles.ticketRow}>
                <AppText style={styles.ticketLabel}>Ticket Number</AppText>
                <AppText style={styles.ticketValEmphasized}>{ticket.ticket_number}</AppText>
              </View>

              <View style={styles.ticketRow}>
                <AppText style={styles.ticketLabel}>Route &amp; Bus</AppText>
                <AppText style={styles.ticketVal}>{ticket.route_name} • Bus {ticket.bus_number}</AppText>
              </View>
              {ticket.driver_name ? (
                <View style={styles.ticketRow}>
                  <AppText style={styles.ticketLabel}>Verified driver</AppText>
                  <AppText style={styles.ticketVal}>{ticket.driver_name}</AppText>
                </View>
              ) : null}

              <View style={styles.ticketRow}>
                <AppText style={styles.ticketLabel}>Amount Paid</AppText>
                <AppText style={styles.ticketValFare}>
                  NPR {ticket.fare_formatted || `Rs. ${(ticket.fare_minor / 100).toFixed(2)}`}
                </AppText>
              </View>

              <View style={styles.ticketRow}>
                <AppText style={styles.ticketLabel}>Remaining Balance</AppText>
                <AppText style={styles.ticketValBalance}>
                  NPR {ticket.balance_remaining_formatted || `Rs. ${(ticket.balance_remaining_minor / 100).toFixed(2)}`}
                </AppText>
              </View>

              <View style={styles.ticketRow}>
                <AppText style={styles.ticketLabel}>Reference</AppText>
                <AppText style={styles.ticketValSmall}>{ticket.transaction_reference}</AppText>
              </View>

              <View style={styles.ticketRow}>
                <AppText style={styles.ticketLabel}>Issued At</AppText>
                <AppText style={styles.ticketValSmall}>
                  {ticket.issued_at ? new Date(ticket.issued_at).toLocaleString() : 'Just now'}
                </AppText>
              </View>
            </View>

            <Pressable
              onPress={openFeedback}
              style={styles.primaryButton}
            >
              <AppText style={styles.primaryText}>Rate Your Ride</AppText>
            </Pressable>

            <Pressable
              onPress={() => {
                feedbackNavigationHandledRef.current = true;
                router.replace('/travel' as never);
              }}
              style={styles.secondaryButton}
            >
              <AppText style={styles.secondaryText}>View Travel History</AppText>
            </Pressable>

            <Pressable onPress={reset} style={styles.secondaryButton}>
              <AppText style={styles.secondaryText}>Scan Another QR</AppText>
            </Pressable>
          </View>
        )}

        {/* Error Notification Card */}
        {error ? (
          <View style={styles.errorCard}>
            <View style={styles.errorHeader}>
              <SymbolView
                name={{ ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' }}
                size={18}
                tintColor={Monochrome.textPrimary}
              />
              <AppText style={styles.errorTitle}>Scan / Payment Error</AppText>
            </View>
            <AppText style={styles.errorText}>{error}</AppText>
            <Pressable
              onPress={quote ? () => void confirmPayment() : reset}
              style={styles.errorRetryButton}
            >
              <AppText style={styles.errorRetryText}>
                {quote ? 'Retry Payment Safely' : 'Try Scanning Again'}
              </AppText>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
      <Modal
        visible={mpinModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!paying) {
            setMpinModalVisible(false);
            setMpinInput('');
            setMpinError(null);
          }
        }}
      >
        <View style={styles.mpinOverlay}>
          <View style={[styles.mpinSheet, { paddingBottom: insets.bottom + Spacing.lg }]}>
            <View style={styles.mpinHandle} />
            <View style={styles.mpinHeader}>
              <View style={styles.mpinLockIcon}>
                <SymbolView name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }} size={20} tintColor={Monochrome.textPrimary} />
              </View>
              <AppText style={styles.mpinTitle}>Authorize fare payment</AppText>
              <AppText style={styles.mpinDescription}>
                Pay NPR {((quote?.fare.amount_minor ?? 0) / 100).toFixed(2)} from your Tap &amp; Pay wallet
              </AppText>
            </View>
            <AppText style={styles.mpinLabel}>Enter four-digit MPIN</AppText>
            <AppTextInput
              accessibilityLabel="Four-digit MPIN"
              style={styles.mpinInput}
              value={mpinInput}
              onChangeText={(value) => {
                setMpinInput(value.replace(/\D/g, '').slice(0, 4));
                setMpinError(null);
              }}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              autoFocus
              autoComplete="off"
              autoCorrect={false}
              editable={!paying}
            />
            {mpinError ? <AppText accessibilityRole="alert" style={styles.mpinError}>{mpinError}</AppText> : null}
            <Pressable
              accessibilityRole="button"
              disabled={paying || mpinInput.length !== 4}
              onPress={() => void submitPayment()}
              style={[styles.primaryButton, (paying || mpinInput.length !== 4) && styles.disabledButton]}
            >
              {paying
                ? <ActivityIndicator color={Monochrome.actionPrimaryText} />
                : <AppText style={styles.primaryText}>Authorize NPR {((quote?.fare.amount_minor ?? 0) / 100).toFixed(2)}</AppText>}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={paying}
              onPress={() => {
                setMpinModalVisible(false);
                setMpinInput('');
                setMpinError(null);
              }}
              style={styles.secondaryButton}
            >
              <AppText style={styles.secondaryText}>Cancel — no payment will be made</AppText>
            </Pressable>
            <Pressable onPress={() => {
              setMpinModalVisible(false);
              setMpinInput('');
              router.push('/security/mpin' as never);
            }}>
              <AppText style={styles.forgotMpin}>Forgot MPIN?</AppText>
            </Pressable>
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
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    color: Monochrome.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    color: Monochrome.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  torchButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  torchButtonActive: {
    backgroundColor: Monochrome.surfaceElevated,
    borderColor: Monochrome.textPrimary,
  },
  headerSpacer: {
    width: 38,
  },
  scrollBody: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  scannerWrapper: {
    marginVertical: Spacing.two,
  },
  myQrButton: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginTop: Spacing.two,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Monochrome.border,
    backgroundColor: Monochrome.surfacePrimary,
  },
  myQrIconBox: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: Monochrome.surfaceSecondary,
  },
  myQrCopy: {
    flex: 1,
  },
  myQrTitle: {
    color: Monochrome.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  myQrSubtitle: {
    marginTop: 2,
    color: Monochrome.textSecondary,
    fontSize: 12,
  },
  cameraBox: {
    height: 420,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: Monochrome.surfacePrimary,
    borderWidth: 1,
    borderColor: Monochrome.border,
    position: 'relative',
  },
  viewfinderOverlay: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'column',
  },
  maskTop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  maskMiddleRow: {
    flexDirection: 'row',
    height: 240,
  },
  maskSide: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  reticleFrame: {
    width: 240,
    height: 240,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: Monochrome.textPrimary,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  loadingContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  loadingReticleText: {
    color: Monochrome.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  maskBottom: {
    flex: 1.2,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  cameraInstruction: {
    color: Monochrome.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  cameraSubInstruction: {
    color: Monochrome.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  centerCard: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  permIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    color: Monochrome.textPrimary,
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },
  bodyText: {
    color: Monochrome.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  quoteCard: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 22,
    padding: 20,
    marginTop: Spacing.two,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  quoteBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Monochrome.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  verifiedBadgeText: {
    color: Monochrome.textPrimary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  refText: {
    color: Monochrome.textMuted,
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  quoteRouteName: {
    color: Monochrome.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  quoteCompanyBus: {
    color: Monochrome.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    padding: 12,
    borderRadius: 16,
    backgroundColor: Monochrome.surfacePrimary,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  driverPhoto: { width: 48, height: 48, borderRadius: 24 },
  driverPhotoFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Monochrome.surfaceElevated,
  },
  recipientCopy: { flex: 1, gap: 2 },
  recipientLabel: { color: Monochrome.actionPrimary, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  recipientName: { color: Monochrome.textPrimary, fontSize: 15, fontWeight: '700' },
  recipientDetail: { color: Monochrome.textSecondary, fontSize: 11, lineHeight: 15 },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  stopText: {
    color: Monochrome.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: Monochrome.surfaceElevated,
    marginVertical: 14,
  },
  amountBreakdown: {
    gap: 10,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  amountLabel: {
    color: Monochrome.textSecondary,
    fontSize: 13,
  },
  fareAmount: {
    color: Monochrome.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  balanceAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: Monochrome.textSecondary,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Monochrome.surfaceElevated,
    padding: 12,
    borderRadius: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  warningText: {
    flex: 1,
    color: Monochrome.textPrimary,
    fontSize: 13,
    lineHeight: 18,
  },
  securityNotice: {
    color: Monochrome.textMuted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 12,
  },
  primaryButton: {
    height: 48,
    backgroundColor: Monochrome.actionPrimary,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    paddingHorizontal: 16,
  },
  primaryText: {
    color: Monochrome.actionPrimaryText,
    fontSize: 15,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },
  addMoneyButton: {
    height: 44,
    backgroundColor: Monochrome.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Monochrome.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  addMoneyText: {
    color: Monochrome.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  secondaryText: {
    color: Monochrome.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  ticketCard: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 22,
    padding: 22,
    marginTop: Spacing.two,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  successHeader: {
    alignItems: 'center',
    marginBottom: 18,
  },
  successIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Monochrome.actionPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  successTitle: {
    color: Monochrome.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  successSubtitle: {
    color: Monochrome.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  ticketBody: {
    backgroundColor: Monochrome.surfacePrimary,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  ticketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketLabel: {
    color: Monochrome.textMuted,
    fontSize: 12,
  },
  ticketVal: {
    color: Monochrome.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  ticketValEmphasized: {
    color: Monochrome.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  ticketValFare: {
    color: Monochrome.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  ticketValBalance: {
    color: Monochrome.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  ticketValSmall: {
    color: Monochrome.textMuted,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  errorCard: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  errorTitle: {
    color: Monochrome.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    color: Monochrome.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  errorRetryButton: {
    backgroundColor: Monochrome.surfaceElevated,
    borderRadius: 10,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  errorRetryText: {
    color: Monochrome.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  mpinOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 30, 35, 0.48)',
  },
  mpinSheet: {
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: Monochrome.background,
  },
  mpinHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    backgroundColor: Monochrome.border,
    marginBottom: 20,
  },
  mpinHeader: { alignItems: 'center', marginBottom: 22 },
  mpinLockIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: Monochrome.surfaceElevated,
    marginBottom: 12,
  },
  mpinTitle: { color: Monochrome.textPrimary, fontSize: 19, fontWeight: '800' },
  mpinDescription: { color: Monochrome.textSecondary, fontSize: 13, marginTop: 5 },
  mpinLabel: { color: Monochrome.textPrimary, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  mpinInput: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Monochrome.border,
    backgroundColor: Monochrome.surfacePrimary,
    color: Monochrome.textPrimary,
    textAlign: 'center',
    fontSize: 22,
    letterSpacing: 12,
  },
  mpinError: { color: '#B42318', fontSize: 13, marginTop: 8 },
  forgotMpin: {
    color: Monochrome.actionPrimary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 10,
  },
});
