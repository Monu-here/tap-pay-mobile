import { AppText, AppTextInput } from '@/components/typography/app-text';
import { AppBackButton } from '@/components/ui/app-back-button';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { LinearGradient } from 'expo-linear-gradient';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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
  const theme = useTheme();
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
    <View style={[styles.container, { backgroundColor: theme.background, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />

      {/* Gradient Header */}
      <LinearGradient
        colors={['#003049', '#001824']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <AppBackButton />
        <View style={styles.headerTitleWrap}>
          <AppText style={styles.title}>Scan & Pay</AppText>
          <AppText style={styles.subtitle}>Hold camera to the driver&apos;s QR code</AppText>
        </View>

        {/* Torch Toggle */}
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
              tintColor={torchOn ? '#FDB94D' : '#FDF0D5'}
            />
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        {/* Scanner View */}
        {!ticket && !quote && (
          <View style={styles.scannerWrapper}>
            {!permission?.granted ? (
              <View style={[styles.centerCard, { backgroundColor: theme.surfacePrimary, borderColor: theme.border }]}>
                <View style={[styles.permIconBox, { backgroundColor: '#003049' }]}>
                  <SymbolView
                    name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }}
                    size={32}
                    tintColor="#FDF0D5"
                  />
                </View>
                <AppText style={[styles.cardTitle, { color: theme.text }]}>Camera Permission Required</AppText>
                <AppText style={[styles.bodyText, { color: theme.textSecondary }]}>
                  Scan &amp; Pay needs camera access to scan driver payment QR codes on public buses.
                </AppText>
                <Pressable onPress={requestPermission} style={styles.primaryButton}>
                  <AppText style={styles.primaryText}>Grant Camera Access</AppText>
                </Pressable>
                <Pressable onPress={handleOpenSettings} style={[styles.secondaryButton, { borderColor: theme.border }]}>
                  <AppText style={[styles.secondaryText, { color: theme.textSecondary }]}>Open App Settings</AppText>
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
                      {/* 4 Corner Markers — Crimson Red */}
                      <View style={[styles.corner, styles.cornerTL]} />
                      <View style={[styles.corner, styles.cornerTR]} />
                      <View style={[styles.corner, styles.cornerBL]} />
                      <View style={[styles.corner, styles.cornerBR]} />

                      {loading ? (
                        <View style={styles.loadingContainer}>
                          <ActivityIndicator size="small" color="#FDF0D5" />
                          <AppText style={styles.loadingReticleText}>Verifying fare…</AppText>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.maskSide} />
                  </View>
                  <View style={styles.maskBottom}>
                    <AppText style={styles.cameraInstruction}>
                      Scan the driver&apos;s QR code
                    </AppText>
                    <AppText style={styles.cameraSubInstruction}>
                      Position the code inside the frame
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
            style={[styles.myQrButton, { backgroundColor: theme.surfacePrimary, borderColor: theme.border }]}
          >
            <View style={[styles.myQrIconBox, { backgroundColor: '#003049' }]}>
              <SymbolView
                name={{ ios: 'qrcode', android: 'qr_code', web: 'qr_code' }}
                size={22}
                tintColor="#FDF0D5"
              />
            </View>
            <View style={styles.myQrCopy}>
              <AppText style={[styles.myQrTitle, { color: theme.text }]}>Show My QR Pass</AppText>
              <AppText style={[styles.myQrSubtitle, { color: theme.textSecondary }]}>Present your transit pass to the driver</AppText>
            </View>
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              size={18}
              tintColor={theme.textMuted}
            />
          </Pressable>
        )}

        {!ticket && !quote ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/passenger/journey' as never)}
            style={styles.secondaryButton}
          >
            <AppText style={styles.secondaryText}>Start a journey and pay at your exit</AppText>
          </Pressable>
        ) : null}

        {/* Fare Quote & Confirmation Card */}
        {quote && !ticket && (
          <View style={[styles.quoteCard, { backgroundColor: theme.surfacePrimary, borderColor: theme.border }]}>
            <View style={styles.quoteBadgeRow}>
              <View style={[styles.verifiedBadge, { backgroundColor: 'rgba(27,138,90,0.12)' }]}>
                <SymbolView
                  name={{ ios: 'checkmark.shield.fill', android: 'verified', web: 'verified' }}
                  size={12}
                  tintColor="#1B8A5A"
                />
                <AppText style={[styles.verifiedBadgeText, { color: '#1B8A5A' }]}>VERIFIED TRIP QUOTE</AppText>
              </View>
              <AppText style={[styles.refText, { color: theme.textMuted }]}>Ref: {quote.trip_reference}</AppText>
            </View>

            <AppText style={[styles.quoteRouteName, { color: theme.text }]}>{quote.route.name}</AppText>
            <AppText style={[styles.quoteCompanyBus, { color: theme.textSecondary }]}>
              {quote.company.name ? `${quote.company.name} • ` : ''}Bus {quote.bus.bus_number}
            </AppText>
            <View style={[styles.recipientCard, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
              {quote.driver.photo_url ? (
                <Image source={{ uri: quote.driver.photo_url }} style={styles.driverPhoto} />
              ) : (
                <View style={[styles.driverPhotoFallback, { backgroundColor: '#003049' }]}>
                  <SymbolView name={{ ios: 'person.fill', android: 'person', web: 'person' }} size={20} tintColor="#FDF0D5" />
                </View>
              )}
              <View style={styles.recipientCopy}>
                <AppText style={styles.recipientLabel}>VERIFIED DRIVER</AppText>
                <AppText style={[styles.recipientName, { color: theme.text }]}>{quote.driver.name || 'Driver identity unavailable'}</AppText>
                <AppText style={[styles.recipientDetail, { color: theme.textSecondary }]}>
                  Fare paid via Tap &amp; Pay — not a personal transfer.
                </AppText>
              </View>
              {quote.driver.verified ? (
                <SymbolView name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }} size={20} tintColor="#1B8A5A" />
              ) : null}
            </View>

            {quote.fare.boarding_stop_name ? (
              <View style={styles.stopRow}>
                <SymbolView
                  name={{ ios: 'mappin.circle.fill', android: 'place', web: 'place' }}
                  size={14}
                  tintColor={theme.actionPrimary}
                />
                <AppText style={[styles.stopText, { color: theme.textSecondary }]}>Boarding: {quote.fare.boarding_stop_name}</AppText>
              </View>
            ) : null}

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <View style={styles.amountBreakdown}>
              <View style={styles.amountRow}>
                <AppText style={[styles.amountLabel, { color: theme.textSecondary }]}>Trip Fare</AppText>
                <AppText style={[styles.fareAmount, { color: theme.text }]}>
                  NPR {quote.fare.amount_formatted || `Rs. ${(quote.fare.amount_minor / 100).toFixed(2)}`}
                </AppText>
              </View>
              <View style={styles.amountRow}>
                <AppText style={[styles.amountLabel, { color: theme.textSecondary }]}>Wallet Balance</AppText>
                <AppText style={[styles.balanceAmount, { color: theme.textSecondary }]}>
                  NPR {quote.wallet.balance_formatted || `Rs. ${(quote.wallet.balance_minor / 100).toFixed(2)}`}
                </AppText>
              </View>
            </View>

            {insufficientBalance ? (
              <View style={[styles.warningBox, { backgroundColor: 'rgba(193,18,31,0.08)', borderColor: 'rgba(193,18,31,0.2)' }]}>
                <SymbolView
                  name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
                  size={16}
                  tintColor="#C1121F"
                />
                <AppText style={[styles.warningText, { color: '#C1121F' }]}>
                  Insufficient funds. Please top up your wallet before paying.
                </AppText>
              </View>
            ) : (
              <AppText style={[styles.securityNotice, { color: theme.textMuted }]}>
                Fare set by active fare rules. Review driver details and authorize with your MPIN.
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
              <View style={[styles.errorCard, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
                <AppText style={[styles.errorText, { color: theme.textSecondary }]}>{mpinStatusError}</AppText>
                <Pressable onPress={() => void confirmPayment()} style={[styles.errorRetryButton, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                  <AppText style={[styles.errorRetryText, { color: theme.text }]}>Retry security check</AppText>
                </Pressable>
              </View>
            ) : null}

            {insufficientBalance ? (
              <Pressable
                onPress={() => router.push('/(tabs)/wallet' as never)}
                style={[styles.addMoneyButton, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
              >
                <AppText style={[styles.addMoneyText, { color: theme.text }]}>Add Money to Wallet</AppText>
              </Pressable>
            ) : null}

            <Pressable disabled={paying} onPress={reset} style={styles.secondaryButton}>
              <AppText style={[styles.secondaryText, { color: theme.textSecondary }]}>Cancel</AppText>
            </Pressable>
          </View>
        )}

        {/* Digital Ticket / Receipt */}
        {ticket && (
          <View style={[styles.ticketCard, { backgroundColor: theme.surfacePrimary, borderColor: theme.border }]}>
            <View style={styles.successHeader}>
              <View style={styles.successIconCircle}>
                <SymbolView
                  name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                  size={22}
                  tintColor="#FFFFFF"
                />
              </View>
              <AppText style={[styles.successTitle, { color: theme.text }]}>Payment Confirmed</AppText>
              <AppText style={[styles.successSubtitle, { color: theme.textSecondary }]}>Digital transit ticket issued</AppText>
            </View>

            <View style={[styles.ticketBody, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}>
              <View style={styles.ticketRow}>
                <AppText style={[styles.ticketLabel, { color: theme.textMuted }]}>Ticket No.</AppText>
                <AppText style={[styles.ticketValEmphasized, { color: theme.text }]}>{ticket.ticket_number}</AppText>
              </View>
              <View style={[styles.ticketDivider, { backgroundColor: theme.border }]} />
              <View style={styles.ticketRow}>
                <AppText style={[styles.ticketLabel, { color: theme.textMuted }]}>Route &amp; Bus</AppText>
                <AppText style={[styles.ticketVal, { color: theme.text }]}>{ticket.route_name} • Bus {ticket.bus_number}</AppText>
              </View>
              {ticket.driver_name ? (
                <>
                  <View style={[styles.ticketDivider, { backgroundColor: theme.border }]} />
                  <View style={styles.ticketRow}>
                    <AppText style={[styles.ticketLabel, { color: theme.textMuted }]}>Driver</AppText>
                    <AppText style={[styles.ticketVal, { color: theme.text }]}>{ticket.driver_name}</AppText>
                  </View>
                </>
              ) : null}
              <View style={[styles.ticketDivider, { backgroundColor: theme.border }]} />
              <View style={styles.ticketRow}>
                <AppText style={[styles.ticketLabel, { color: theme.textMuted }]}>Amount Paid</AppText>
                <AppText style={[styles.ticketValFare, { color: '#C1121F' }]}>
                  NPR {ticket.fare_formatted || `Rs. ${(ticket.fare_minor / 100).toFixed(2)}`}
                </AppText>
              </View>
              <View style={[styles.ticketDivider, { backgroundColor: theme.border }]} />
              <View style={styles.ticketRow}>
                <AppText style={[styles.ticketLabel, { color: theme.textMuted }]}>Wallet Balance</AppText>
                <AppText style={[styles.ticketValBalance, { color: theme.textSecondary }]}>
                  NPR {ticket.balance_remaining_formatted || `Rs. ${(ticket.balance_remaining_minor / 100).toFixed(2)}`}
                </AppText>
              </View>
              <View style={[styles.ticketDivider, { backgroundColor: theme.border }]} />
              <View style={styles.ticketRow}>
                <AppText style={[styles.ticketLabel, { color: theme.textMuted }]}>Reference</AppText>
                <AppText style={[styles.ticketValSmall, { color: theme.textMuted }]}>{ticket.transaction_reference}</AppText>
              </View>
              <View style={[styles.ticketDivider, { backgroundColor: theme.border }]} />
              <View style={styles.ticketRow}>
                <AppText style={[styles.ticketLabel, { color: theme.textMuted }]}>Issued At</AppText>
                <AppText style={[styles.ticketValSmall, { color: theme.textMuted }]}>
                  {ticket.issued_at ? new Date(ticket.issued_at).toLocaleString() : 'Just now'}
                </AppText>
              </View>
            </View>

            <Pressable onPress={openFeedback} style={styles.primaryButton}>
              <AppText style={styles.primaryText}>Rate Your Ride ⭐</AppText>
            </Pressable>

            <Pressable
              onPress={() => {
                feedbackNavigationHandledRef.current = true;
                router.replace('/travel' as never);
              }}
              style={[styles.secondaryButton, { borderColor: theme.border }]}
            >
              <AppText style={[styles.secondaryText, { color: theme.textSecondary }]}>View Travel History</AppText>
            </Pressable>

            <Pressable onPress={reset} style={[styles.secondaryButton, { borderColor: theme.border }]}>
              <AppText style={[styles.secondaryText, { color: theme.textSecondary }]}>Scan Another QR</AppText>
            </Pressable>
          </View>
        )}

        {/* Error Notification Card */}
        {error ? (
          <View style={[styles.errorCard, { backgroundColor: theme.surfacePrimary, borderColor: 'rgba(193,18,31,0.2)' }]}>
            <View style={styles.errorHeader}>
              <SymbolView
                name={{ ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' }}
                size={18}
                tintColor="#C1121F"
              />
              <AppText style={[styles.errorTitle, { color: theme.text }]}>Scan / Payment Error</AppText>
            </View>
            <AppText style={[styles.errorText, { color: theme.textSecondary }]}>{error}</AppText>
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
        <KeyboardAvoidingView
          style={styles.mpinOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={[
              styles.mpinSheet,
              {
                backgroundColor: theme.surfacePrimary,
                maxHeight: '90%',
              },
            ]}
            contentContainerStyle={[
              styles.mpinSheetContent,
              { paddingBottom: insets.bottom + Spacing.lg },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.mpinHandle, { backgroundColor: theme.border }]} />
            <View style={styles.mpinHeader}>
              <View style={[styles.mpinLockIcon, { backgroundColor: '#C1121F' }]}>
                <SymbolView name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }} size={20} tintColor="#FFFFFF" />
              </View>
              <AppText style={[styles.mpinTitle, { color: theme.text }]}>Authorize Payment</AppText>
              <AppText style={[styles.mpinDescription, { color: theme.textSecondary }]}>
                Pay NPR {((quote?.fare.amount_minor ?? 0) / 100).toFixed(2)} from your transit wallet
              </AppText>
            </View>
            <AppText style={[styles.mpinLabel, { color: theme.textSecondary }]}>Enter your 4-digit MPIN</AppText>
            <AppTextInput
              accessibilityLabel="Four-digit MPIN"
              style={[styles.mpinInput, { borderColor: theme.border, backgroundColor: theme.surfaceSecondary, color: theme.text }]}
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
                ? <ActivityIndicator color="#FFFFFF" />
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
              <AppText style={[styles.secondaryText, { color: theme.textSecondary }]}>Cancel — no payment will be made</AppText>
            </Pressable>
            <Pressable onPress={() => {
              setMpinModalVisible(false);
              setMpinInput('');
              router.push('/security/mpin' as never);
            }}>
              <AppText style={[styles.forgotMpin, { color: theme.actionPrimary }]}>Forgot MPIN?</AppText>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* ── Gradient Header ── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingBottom: 16,
    gap: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(253,240,213,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: { flex: 1 },
  title: {
    color: '#FDF0D5',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: 'rgba(253,240,213,0.6)',
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
  torchButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(253,240,213,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  torchButtonActive: {
    backgroundColor: 'rgba(253,179,77,0.2)',
  },
  headerSpacer: { width: 38 },

  /* ── Scroll Body ── */
  scrollBody: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    paddingTop: Spacing.two,
  },
  scannerWrapper: { marginVertical: Spacing.two },

  /* ── My QR Button ── */
  myQrButton: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: Spacing.two,
    borderRadius: 16,
    borderWidth: 1,
  },
  myQrIconBox: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  myQrCopy: { flex: 1 },
  myQrTitle: { fontSize: 15, fontWeight: '700' },
  myQrSubtitle: { marginTop: 2, fontSize: 12 },

  /* ── Camera ── */
  cameraBox: {
    height: 420,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#000000',
    position: 'relative',
  },
  viewfinderOverlay: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'column',
  },
  maskTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  maskMiddleRow: { flexDirection: 'row', height: 240 },
  maskSide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  reticleFrame: {
    width: 240,
    height: 240,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#C1121F',
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  loadingContainer: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  loadingReticleText: { color: '#FDF0D5', fontSize: 13, fontWeight: '700' },
  maskBottom: {
    flex: 1.2,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  cameraInstruction: { color: '#FDF0D5', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  cameraSubInstruction: { color: 'rgba(253,240,213,0.65)', fontSize: 12, textAlign: 'center', marginTop: 4 },

  /* ── Permission card ── */
  centerCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
  },
  permIconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  cardTitle: { fontSize: 19, fontWeight: '800', textAlign: 'center' },
  bodyText: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8, marginBottom: 20 },

  /* ── Quote Card ── */
  quoteCard: {
    borderRadius: 22,
    padding: 20,
    marginTop: Spacing.two,
    borderWidth: 1,
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  verifiedBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  refText: { fontSize: 11 },
  quoteRouteName: { fontSize: 20, fontWeight: '800' },
  quoteCompanyBus: { fontSize: 13, marginTop: 4 },
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  driverPhoto: { width: 48, height: 48, borderRadius: 24 },
  driverPhotoFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipientCopy: { flex: 1, gap: 2 },
  recipientLabel: { color: '#1B8A5A', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  recipientName: { fontSize: 15, fontWeight: '700' },
  recipientDetail: { fontSize: 11, lineHeight: 15 },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  stopText: { fontSize: 13, fontWeight: '600' },
  divider: { height: 1, marginVertical: 14 },
  amountBreakdown: { gap: 10 },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amountLabel: { fontSize: 13 },
  fareAmount: { fontSize: 22, fontWeight: '800' },
  balanceAmount: { fontSize: 15, fontWeight: '600' },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    marginTop: 14,
    borderWidth: 1,
  },
  warningText: { flex: 1, fontSize: 13, lineHeight: 18 },
  securityNotice: { fontSize: 12, lineHeight: 16, marginTop: 12 },

  /* ── Buttons ── */
  primaryButton: {
    height: 50,
    backgroundColor: '#C1121F',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    paddingHorizontal: 16,
    shadowColor: '#C1121F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  disabledButton: { opacity: 0.5, shadowOpacity: 0 },
  addMoneyButton: {
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  addMoneyText: { fontSize: 14, fontWeight: '600' },
  secondaryButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  secondaryText: { fontSize: 14, fontWeight: '600' },

  /* ── Ticket Card ── */
  ticketCard: {
    borderRadius: 22,
    padding: 22,
    marginTop: Spacing.two,
    borderWidth: 1,
  },
  successHeader: { alignItems: 'center', marginBottom: 18 },
  successIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1B8A5A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#1B8A5A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  successTitle: { fontSize: 18, fontWeight: '800' },
  successSubtitle: { fontSize: 13, marginTop: 2 },
  ticketBody: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 8,
    borderWidth: 1,
  },
  ticketDivider: { height: 1 },
  ticketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
  },
  ticketLabel: { fontSize: 12 },
  ticketVal: { fontSize: 13, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  ticketValEmphasized: {
    fontSize: 14,
    fontWeight: '800',
  },
  ticketValFare: { fontSize: 16, fontWeight: '800' },
  ticketValBalance: { fontSize: 13, fontWeight: '600' },
  ticketValSmall: {
    fontSize: 11,
    maxWidth: '60%',
    textAlign: 'right',
  },

  /* ── Error ── */
  errorCard: {
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
  },
  errorHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  errorTitle: { fontSize: 14, fontWeight: '700' },
  errorText: { fontSize: 13, lineHeight: 18 },
  errorRetryButton: {
    borderRadius: 10,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    borderWidth: 1,
  },
  errorRetryText: { fontSize: 13, fontWeight: '700' },

  /* ── MPIN Sheet ── */
  mpinOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  mpinSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  mpinSheetContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  mpinHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  mpinHeader: { alignItems: 'center', marginBottom: 22 },
  mpinLockIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#C1121F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  mpinTitle: { fontSize: 19, fontWeight: '800' },
  mpinDescription: { fontSize: 13, marginTop: 5, textAlign: 'center' },
  mpinLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  mpinInput: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 14,
    fontWeight: '700',
  },
  mpinError: { color: '#C1121F', fontSize: 13, marginTop: 8, textAlign: 'center' },
  forgotMpin: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 10,
  },
});
