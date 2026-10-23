import {AppText, AppTextInput } from '@/components/typography/app-text';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { Monochrome, Spacing } from '@/constants/theme';
import {
  collectDriverPayment,
  getCurrentDriverBus,
  getDriverTrips,
  type CollectPaymentResult,
  type DriverBusInfo,
} from '@/features/driver/services/driverApi';

export default function DriverScanScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  const [bus, setBus] = useState<DriverBusInfo | null>(null);
  const [activeTrip, setActiveTrip] = useState(false);
  const [tripLoading, setTripLoading] = useState(true);
  const [tripMessage, setTripMessage] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Verification result modal state
  const [ticketResult, setTicketResult] = useState<CollectPaymentResult['ticket'] | null>(null);
  const [errorResult, setErrorResult] = useState<string | null>(null);
  const [manualInputModal, setManualInputModal] = useState(false);
  const [manualPayloadInput, setManualPayloadInput] = useState('');

  // Payment collection is available only during this driver's active assigned trip.
  useEffect(() => {
    let active = true;
    void Promise.all([getCurrentDriverBus(), getDriverTrips()])
      .then(([busResult, tripsResult]) => {
        if (!active) return;
        if (!busResult.ok || !busResult.data) {
          setTripMessage(busResult.message || 'Could not verify your assigned bus.');
          return;
        }
        setBus(busResult.data.bus);
        if (!busResult.data.bus) {
          setTripMessage('No bus is currently assigned to your driver account.');
          return;
        }
        if (!tripsResult.ok || !tripsResult.data) {
          setTripMessage(tripsResult.message || 'Could not verify your active trip.');
          return;
        }
        const hasActiveTrip = tripsResult.data.trips.some(
          (trip) => trip.status === 'in_progress' && trip.bus_id === busResult.data?.bus?.id,
        );
        setActiveTrip(hasActiveTrip);
        setTripMessage(hasActiveTrip ? null : 'Start an assigned trip before scanning passenger QR codes.');
      })
      .catch((error) => {
        if (active) setTripMessage(error instanceof Error ? error.message : 'Unable to verify driver trip status.');
      })
      .finally(() => {
        if (active) setTripLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const processQrPayload = useCallback(async (payload: string) => {
    if (!activeTrip) {
      setErrorResult('Fare collection requires your own active trip.');
      return;
    }
    if (processing) return;
    setProcessing(true);
    setErrorResult(null);
    setTicketResult(null);

    try {
      const res = await collectDriverPayment({
        qr_payload: payload.trim(),
      });

      if (res.ok && res.data?.ticket) {
        setTicketResult(res.data.ticket);
      } else {
        const errorMsg = res.message || 'Payment collection failed. Please verify QR.';
        setErrorResult(errorMsg);
      }
    } catch {
      setErrorResult('Network failure communicating with validator server.');
    } finally {
      setProcessing(false);
    }
  }, [activeTrip, processing]);

  const onBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned || processing || ticketResult || errorResult) return;
    setScanned(true);
    processQrPayload(data);
  };

  const resetScanner = () => {
    setScanned(false);
    setTicketResult(null);
    setErrorResult(null);
    setManualPayloadInput('');
    setManualInputModal(false);
  };

  const handleManualSubmit = () => {
    if (!manualPayloadInput.trim()) return;
    setManualInputModal(false);
    setScanned(true);
    processQrPayload(manualPayloadInput.trim());
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <SymbolView
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            size={18}
            tintColor={Monochrome.textPrimary}
          />
        </Pressable>
        <View style={styles.headerTitleGroup}>
          <AppText style={styles.headerTitle}>Scan Passenger QR</AppText>
          <AppText style={styles.headerSubtitle}>
            {bus ? `Bus ${bus.bus_number}` : 'Driver POS Mode'}
          </AppText>
        </View>
        <Pressable
          disabled={!activeTrip}
          onPress={() => setManualInputModal(true)}
          style={[styles.manualBtn, !activeTrip && styles.manualBtnDisabled]}
          hitSlop={8}
        >
          <SymbolView
            name={{ ios: 'keyboard', android: 'keyboard', web: 'keyboard' }}
            size={18}
            tintColor={activeTrip ? Monochrome.textPrimary : Monochrome.textMuted}
          />
        </Pressable>
      </View>

      {/* Camera Viewfinder Area */}
      <View style={styles.cameraWrapper}>
        {tripLoading ? (
          <View style={styles.permissionBox}>
            <ActivityIndicator size="large" color={Monochrome.textPrimary} />
            <AppText style={styles.permText}>Checking assigned bus and active trip…</AppText>
          </View>
        ) : !activeTrip ? (
          <View style={styles.permissionBox}>
            <AppText style={styles.permTitle}>No Active Trip</AppText>
            <AppText style={styles.permText}>{tripMessage || 'Start an assigned trip before collecting fares.'}</AppText>
          </View>
        ) : !permission ? (
          <View style={styles.permissionBox}>
            <ActivityIndicator size="large" color={Monochrome.textPrimary} />
            <AppText style={styles.permText}>Requesting camera permission...</AppText>
          </View>
        ) : !permission.granted ? (
          <View style={styles.permissionBox}>
            <SymbolView
              name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }}
              size={48}
              tintColor={Monochrome.textMuted}
            />
            <AppText style={styles.permTitle}>Camera Access Required</AppText>
            <AppText style={styles.permText}>
              Tap &amp; Pay needs camera permission to scan passenger transit QR codes on boarding.
            </AppText>
            <Pressable onPress={requestPermission} style={styles.grantBtn}>
              <AppText style={styles.grantBtnText}>Grant Camera Permission</AppText>
            </Pressable>
            <Pressable onPress={() => setManualInputModal(true)} style={styles.textBtn}>
              <AppText style={styles.textBtnText}>Or enter QR payload manually</AppText>
            </Pressable>
          </View>
        ) : (
          <View style={styles.cameraContainer}>
            <CameraView
              style={StyleSheet.absoluteFill}
              barcodeScannerSettings={{
                barcodeTypes: ['qr'],
              }}
              onBarcodeScanned={scanned ? undefined : onBarcodeScanned}
            />

            {/* Viewfinder Reticle Overlay */}
            <View style={styles.reticleOverlay}>
              <View style={styles.reticleFrame}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />

                {processing && (
                  <View style={styles.processingCover}>
                    <ActivityIndicator size="large" color={Monochrome.textPrimary} />
                    <AppText style={styles.processingText}>Verifying token with backend...</AppText>
                  </View>
                )}
              </View>
              <AppText style={styles.reticlePrompt}>
                Align passenger&apos;s phone QR inside the square
              </AppText>
            </View>
          </View>
        )}
      </View>

      {/* Bottom Status Bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.busInfoRow}>
          <SymbolView
            name={{ ios: 'shield.lefthalf.filled', android: 'verified_user', web: 'verified_user' }}
            size={16}
            tintColor={Monochrome.textSecondary}
          />
          <AppText style={styles.bottomBarText}>
            Cryptographic Server Verification Active · Anti-Replay Guard On
          </AppText>
        </View>
      </View>

      {/* Verification Result Modal */}
      <Modal
        visible={ticketResult !== null || errorResult !== null}
        animationType="slide"
        transparent
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {ticketResult ? (
              <>
                <View style={styles.resultIconCircle}>
                  <SymbolView
                    name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                    size={30}
                    tintColor={Monochrome.textPrimary}
                  />
                </View>
                <AppText style={styles.resultTitle}>FARE PAID &amp; ISSUED</AppText>
                <AppText style={styles.resultTicketNumber}>{ticketResult.ticket_number}</AppText>

                <View style={styles.ticketDetailsBox}>
                  <View style={styles.ticketRow}>
                    <AppText style={styles.ticketLabel}>PASSENGER</AppText>
                    <AppText style={styles.ticketValue}>{ticketResult.passenger_name}</AppText>
                  </View>
                  <View style={styles.ticketRow}>
                    <AppText style={styles.ticketLabel}>FARE COLLECTED</AppText>
                    <AppText style={styles.ticketValue}>
                      {ticketResult.fare_formatted}
                    </AppText>
                  </View>
                  {ticketResult.balance_remaining_formatted && (
                    <View style={styles.ticketRow}>
                      <AppText style={styles.ticketLabel}>PASSENGER BALANCE</AppText>
                      <AppText style={styles.ticketValue}>
                        {ticketResult.balance_remaining_formatted}
                      </AppText>
                    </View>
                  )}
                  <View style={styles.ticketRow}>
                    <AppText style={styles.ticketLabel}>ISSUED AT</AppText>
                    <AppText style={styles.ticketValue}>
                      {new Date(ticketResult.issued_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </AppText>
                  </View>
                </View>

                <Pressable onPress={resetScanner} style={styles.scanNextBtn}>
                  <AppText style={styles.scanNextBtnText}>Scan Next Passenger</AppText>
                </Pressable>
              </>
            ) : errorResult ? (
              <>
                <View style={styles.resultIconCircle}>
                  <SymbolView
                    name={{ ios: 'xmark', android: 'close', web: 'close' }}
                    size={30}
                    tintColor={Monochrome.textPrimary}
                  />
                </View>
                <AppText style={styles.resultTitle}>BOARDING REJECTED</AppText>
                <AppText style={styles.resultErrorReason}>{errorResult}</AppText>

                <View style={styles.rejectionNoticeBox}>
                  <AppText style={styles.rejectionNoticeText}>
                    • No fare has been deducted from the passenger wallet.
                  </AppText>
                  <AppText style={styles.rejectionNoticeText}>
                    • Check passenger balance or request a fresh dynamic QR token.
                  </AppText>
                </View>

                <Pressable onPress={resetScanner} style={styles.scanNextBtn}>
                  <AppText style={styles.scanNextBtnText}>Dismiss &amp; Scan Again</AppText>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Manual Input Modal */}
      <Modal visible={manualInputModal} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.manualModalCard}>
            <AppText style={styles.manualModalTitle}>Manual QR Payload Entry</AppText>
            <AppText style={styles.manualModalSub}>
              Paste or type the encoded QR transit token for manual validation:
            </AppText>

            <AppTextInput
              style={styles.manualInput}
              value={manualPayloadInput}
              onChangeText={setManualPayloadInput}
              placeholder="Paste base64 QR payload..."
              placeholderTextColor={Monochrome.textMuted}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.manualModalActions}>
              <Pressable onPress={() => setManualInputModal(false)} style={styles.manualCancelBtn}>
                <AppText style={styles.manualCancelBtnText}>Cancel</AppText>
              </Pressable>
              <Pressable onPress={handleManualSubmit} style={styles.manualSubmitBtn}>
                <AppText style={styles.manualSubmitBtnText}>Verify &amp; Collect</AppText>
              </Pressable>
            </View>
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
  headerTitleGroup: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Monochrome.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },
  manualBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualBtnDisabled: {
    opacity: 0.4,
  },
  cameraWrapper: {
    flex: 1,
  },
  cameraContainer: {
    flex: 1,
  },
  reticleOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  reticleFrame: {
    width: 250,
    height: 250,
    position: 'relative',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: Monochrome.textPrimary,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 10 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 10 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 10 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 10 },
  processingCover: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  processingText: {
    marginTop: Spacing.sm,
    fontSize: 13,
    fontWeight: '600',
    color: Monochrome.textPrimary,
    textAlign: 'center',
  },
  reticlePrompt: {
    marginTop: Spacing.lg,
    fontSize: 13,
    fontWeight: '500',
    color: Monochrome.textSecondary,
    backgroundColor: Monochrome.surfacePrimary,
    borderWidth: 1,
    borderColor: Monochrome.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
    backgroundColor: Monochrome.background,
  },
  permTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Monochrome.textPrimary,
    marginTop: Spacing.sm,
  },
  permText: {
    fontSize: 13,
    color: Monochrome.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  grantBtn: {
    backgroundColor: Monochrome.actionPrimary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: Spacing.sm,
  },
  grantBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Monochrome.actionPrimaryText,
  },
  textBtn: {
    padding: Spacing.sm,
  },
  textBtnText: {
    fontSize: 13,
    color: Monochrome.textSecondary,
    fontWeight: '600',
  },
  bottomBar: {
    backgroundColor: Monochrome.surfacePrimary,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Monochrome.border,
  },
  busInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    justifyContent: 'center',
  },
  bottomBarText: {
    fontSize: 11,
    color: Monochrome.textSecondary,
    fontWeight: '500',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Monochrome.border,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  resultIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  resultTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Monochrome.textPrimary,
    letterSpacing: 0.5,
  },
  resultTicketNumber: {
    fontSize: 13,
    color: Monochrome.textSecondary,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', web: 'monospace' }),
    marginTop: 4,
  },
  resultErrorReason: {
    fontSize: 14,
    fontWeight: '600',
    color: Monochrome.textPrimary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
  ticketDetailsBox: {
    width: '100%',
    backgroundColor: Monochrome.surfacePrimary,
    borderWidth: 1,
    borderColor: Monochrome.border,
    borderRadius: 16,
    padding: Spacing.md,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  ticketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketLabel: {
    fontSize: 11,
    color: Monochrome.textMuted,
    fontWeight: '700',
  },
  ticketValue: {
    fontSize: 13,
    color: Monochrome.textPrimary,
    fontWeight: '700',
  },
  rejectionNoticeBox: {
    width: '100%',
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
    borderRadius: 12,
    padding: Spacing.md,
    marginTop: Spacing.md,
    gap: 4,
  },
  rejectionNoticeText: {
    fontSize: 12,
    color: Monochrome.textSecondary,
    lineHeight: 18,
  },
  scanNextBtn: {
    width: '100%',
    backgroundColor: Monochrome.actionPrimary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  scanNextBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Monochrome.actionPrimaryText,
  },
  manualModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Monochrome.border,
    padding: Spacing.lg,
  },
  manualModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  manualModalSub: {
    fontSize: 12,
    color: Monochrome.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  manualInput: {
    marginTop: Spacing.md,
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
    borderRadius: 12,
    padding: Spacing.md,
    fontSize: 13,
    color: Monochrome.textPrimary,
    minHeight: 90,
    textAlignVertical: 'top',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', web: 'monospace' }),
  },
  manualModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  manualCancelBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 10,
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  manualCancelBtnText: {
    fontSize: 13,
    color: Monochrome.textSecondary,
    fontWeight: '600',
  },
  manualSubmitBtn: {
    backgroundColor: Monochrome.actionPrimary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 10,
  },
  manualSubmitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Monochrome.actionPrimaryText,
  },
});
