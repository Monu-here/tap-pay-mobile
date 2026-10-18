import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { Brand, Spacing } from '@/constants/theme';
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
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <SymbolView
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            size={22}
            tintColor={Brand.white}
          />
        </Pressable>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerTitle}>Scan Passenger QR</Text>
          <Text style={styles.headerSubtitle}>
            {bus ? `Bus ${bus.bus_number}` : 'Driver POS Mode'}
          </Text>
        </View>
        <Pressable
          disabled={!activeTrip}
          onPress={() => setManualInputModal(true)}
          style={styles.manualBtn}
          hitSlop={8}
        >
          <SymbolView
            name={{ ios: 'keyboard', android: 'keyboard', web: 'keyboard' }}
            size={20}
            tintColor="#4ADE80"
          />
        </Pressable>
      </View>

      {/* Camera Viewfinder Area */}
      <View style={styles.cameraWrapper}>
        {tripLoading ? (
          <View style={styles.permissionBox}>
            <ActivityIndicator size="large" color="#4ADE80" />
            <Text style={styles.permText}>Checking assigned bus and active trip…</Text>
          </View>
        ) : !activeTrip ? (
          <View style={styles.permissionBox}>
            <Text style={styles.permTitle}>No Active Trip</Text>
            <Text style={styles.permText}>{tripMessage || 'Start an assigned trip before collecting fares.'}</Text>
          </View>
        ) : !permission ? (
          <View style={styles.permissionBox}>
            <ActivityIndicator size="large" color="#4ADE80" />
            <Text style={styles.permText}>Requesting camera permission...</Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.permissionBox}>
            <SymbolView
              name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }}
              size={48}
              tintColor="#94A3B8"
            />
            <Text style={styles.permTitle}>Camera Access Required</Text>
            <Text style={styles.permText}>
              Tap &amp; Pay needs camera permission to scan passenger transit QR codes on boarding.
            </Text>
            <Pressable onPress={requestPermission} style={styles.grantBtn}>
              <Text style={styles.grantBtnText}>Grant Camera Permission</Text>
            </Pressable>
            <Pressable onPress={() => setManualInputModal(true)} style={styles.textBtn}>
              <Text style={styles.textBtnText}>Or enter QR payload manually</Text>
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
                    <ActivityIndicator size="large" color="#4ADE80" />
                    <Text style={styles.processingText}>Verifying token with backend...</Text>
                  </View>
                )}
              </View>
              <Text style={styles.reticlePrompt}>
                Align passenger&apos;s phone QR inside the square
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Bottom Status Bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.busInfoRow}>
          <SymbolView
            name={{ ios: 'shield.lefthalf.filled', android: 'verified_user', web: 'verified_user' }}
            size={18}
            tintColor="#4ADE80"
          />
          <Text style={styles.bottomBarText}>
            Cryptographic Server Verification Active · Anti-Replay Guard On
          </Text>
        </View>
      </View>

      {/* Verification Result Modal */}
      <Modal
        visible={ticketResult !== null || errorResult !== null}
        animationType="slide"
        transparent
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, ticketResult ? styles.modalCardSuccess : styles.modalCardError]}>
            {ticketResult ? (
              <>
                <View style={styles.resultIconCircleSuccess}>
                  <SymbolView
                    name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                    size={32}
                    tintColor="#FFFFFF"
                  />
                </View>
                <Text style={styles.resultTitleSuccess}>FARED PAID & ISSUED</Text>
                <Text style={styles.resultTicketNumber}>{ticketResult.ticket_number}</Text>

                <View style={styles.ticketDetailsBox}>
                  <View style={styles.ticketRow}>
                    <Text style={styles.ticketLabel}>PASSENGER</Text>
                    <Text style={styles.ticketValue}>{ticketResult.passenger_name}</Text>
                  </View>
                  <View style={styles.ticketRow}>
                    <Text style={styles.ticketLabel}>FARE COLLECTED</Text>
                    <Text style={[styles.ticketValue, { color: '#4ADE80' }]}>
                      {ticketResult.fare_formatted}
                    </Text>
                  </View>
                  {ticketResult.balance_remaining_formatted && (
                    <View style={styles.ticketRow}>
                      <Text style={styles.ticketLabel}>PASSENGER BALANCE</Text>
                      <Text style={styles.ticketValue}>
                        {ticketResult.balance_remaining_formatted}
                      </Text>
                    </View>
                  )}
                  <View style={styles.ticketRow}>
                    <Text style={styles.ticketLabel}>ISSUED AT</Text>
                    <Text style={styles.ticketValue}>
                      {new Date(ticketResult.issued_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </Text>
                  </View>
                </View>

                <Pressable onPress={resetScanner} style={styles.scanNextBtn}>
                  <Text style={styles.scanNextBtnText}>Scan Next Passenger</Text>
                </Pressable>
              </>
            ) : errorResult ? (
              <>
                <View style={styles.resultIconCircleError}>
                  <SymbolView
                    name={{ ios: 'xmark', android: 'close', web: 'close' }}
                    size={32}
                    tintColor="#FFFFFF"
                  />
                </View>
                <Text style={styles.resultTitleError}>BOARDING REJECTED</Text>
                <Text style={styles.resultErrorReason}>{errorResult}</Text>

                <View style={styles.rejectionNoticeBox}>
                  <Text style={styles.rejectionNoticeText}>
                    • No fare has been deducted from the passenger wallet.
                  </Text>
                  <Text style={styles.rejectionNoticeText}>
                    • Check passenger balance or request a fresh dynamic QR token.
                  </Text>
                </View>

                <Pressable onPress={resetScanner} style={[styles.scanNextBtn, { backgroundColor: '#EF4444' }]}>
                  <Text style={styles.scanNextBtnText}>Dismiss & Scan Again</Text>
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
            <Text style={styles.manualModalTitle}>Manual QR Payload Entry</Text>
            <Text style={styles.manualModalSub}>
              Paste or type the encoded QR transit token for manual validation:
            </Text>

            <TextInput
              style={styles.manualInput}
              value={manualPayloadInput}
              onChangeText={setManualPayloadInput}
              placeholder="Paste base64 QR payload..."
              placeholderTextColor="#64748B"
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.manualModalActions}>
              <Pressable onPress={() => setManualInputModal(false)} style={styles.manualCancelBtn}>
                <Text style={styles.manualCancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleManualSubmit} style={styles.manualSubmitBtn}>
                <Text style={styles.manualSubmitBtnText}>Verify & Collect</Text>
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
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleGroup: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.white,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#4ADE80',
    fontWeight: '600',
    marginTop: 2,
  },
  manualBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fareToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: '#1E293B',
    gap: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  fareToolbarLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  farePillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  farePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  farePillSelected: {
    backgroundColor: '#4ADE80',
  },
  farePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.white,
  },
  farePillTextSelected: {
    color: '#0F172A',
  },
  customFareBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 32,
  },
  currencyPrefix: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
  },
  customFareInput: {
    flex: 1,
    fontSize: 13,
    color: Brand.white,
    fontWeight: '700',
    padding: 0,
    marginLeft: 4,
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
    width: 260,
    height: 260,
    position: 'relative',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#4ADE80',
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 10 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 10 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 10 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 10 },
  processingCover: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  processingText: {
    marginTop: Spacing.sm,
    fontSize: 13,
    fontWeight: '600',
    color: Brand.white,
    textAlign: 'center',
  },
  reticlePrompt: {
    marginTop: Spacing.lg,
    fontSize: 13,
    fontWeight: '600',
    color: Brand.white,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
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
  },
  permTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.white,
    marginTop: Spacing.sm,
  },
  permText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
  grantBtn: {
    backgroundColor: '#4ADE80',
    paddingHorizontal: Spacing.xl,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: Spacing.sm,
  },
  grantBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  textBtn: {
    padding: Spacing.sm,
  },
  textBtnText: {
    fontSize: 13,
    color: Brand.teal.primary,
    fontWeight: '600',
  },
  bottomBar: {
    backgroundColor: '#1E293B',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  busInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    justifyContent: 'center',
  },
  bottomBarText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
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
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: Spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  modalCardSuccess: {
    borderWidth: 2,
    borderColor: '#4ADE80',
  },
  modalCardError: {
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  resultIconCircleSuccess: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  resultIconCircleError: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  resultTitleSuccess: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4ADE80',
    letterSpacing: 0.5,
  },
  resultTitleError: {
    fontSize: 18,
    fontWeight: '800',
    color: '#EF4444',
    letterSpacing: 0.5,
  },
  resultTicketNumber: {
    fontSize: 13,
    color: '#94A3B8',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', web: 'monospace' }),
    marginTop: 4,
  },
  resultErrorReason: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.white,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
  ticketDetailsBox: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
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
    color: '#64748B',
    fontWeight: '700',
  },
  ticketValue: {
    fontSize: 13,
    color: Brand.white,
    fontWeight: '700',
  },
  rejectionNoticeBox: {
    width: '100%',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    padding: Spacing.md,
    marginTop: Spacing.md,
    gap: 4,
  },
  rejectionNoticeText: {
    fontSize: 12,
    color: '#FCA5A5',
    lineHeight: 18,
  },
  scanNextBtn: {
    width: '100%',
    backgroundColor: '#22C55E',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  scanNextBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: Brand.white,
  },
  manualModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: Spacing.lg,
  },
  manualModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.white,
  },
  manualModalSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    lineHeight: 18,
  },
  manualInput: {
    marginTop: Spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    padding: Spacing.md,
    fontSize: 13,
    color: Brand.white,
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
  },
  manualCancelBtnText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  manualSubmitBtn: {
    backgroundColor: '#4ADE80',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 10,
  },
  manualSubmitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
});
