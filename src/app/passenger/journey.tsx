import { AppText } from '@/components/typography/app-text';
import { Monochrome, Spacing } from '@/constants/theme';
import {
  getCurrentTransitJourney,
  getRouteStops,
  boardTransitJourney,
  previewTransitExit,
  payTransitExit,
  type ExitFarePreview,
  type PassengerJourney,
  type StopInfo,
  type TransitFareTicket,
} from '@/features/passenger/services/passengerApi';
import { createIdempotencyKey } from '@/features/auth/services/apiClient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PassengerJourneyScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [journey, setJourney] = useState<PassengerJourney | null>(null);
  const [stops, setStops] = useState<StopInfo[]>([]);
  const [preview, setPreview] = useState<ExitFarePreview | null>(null);
  const [ticket, setTicket] = useState<TransitFareTicket | null>(null);
  const [selectedSequence, setSelectedSequence] = useState<number | null>(null);
  const [mpin, setMpin] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const scanLock = useRef(false);

  const loadJourney = useCallback(async () => {
    const result = await getCurrentTransitJourney();
    if (!result.ok || !result.data) {
      setMessage(result.message || 'Your active journey could not be loaded.');
      return;
    }
    setJourney(result.data.journey);
    if (result.data.journey?.route_id) {
      const routeStops = await getRouteStops(result.data.journey.route_id);
      if (routeStops.ok && routeStops.data) setStops(routeStops.data.stops);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void loadJourney());
    return () => cancelAnimationFrame(frame);
  }, [loadJourney]);

  const board = async (qrPayload: string) => {
    if (scanLock.current || busy) return;
    scanLock.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const result = await boardTransitJourney(qrPayload, createIdempotencyKey());
      if (!result.ok || !result.data) {
        setMessage(result.message || 'The trip could not be started.');
        return;
      }
      await loadJourney();
    } finally {
      setBusy(false);
      scanLock.current = false;
    }
  };

  const previewExit = async (sequence: number) => {
    if (!journey || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await previewTransitExit(journey.travel_uid, sequence);
      if (!result.ok || !result.data) {
        setMessage(result.message || 'The exit fare could not be calculated.');
        return;
      }
      setSelectedSequence(sequence);
      setPreview(result.data.fare_due);
      setJourney((current) => current ? {
        ...current,
        status: 'payment_due',
        fare_due_minor: result.data.fare_due.fare.amount_minor,
        exit_stop: result.data.fare_due.exit_stop.name,
        exited_at: new Date().toISOString(),
      } : current);
    } finally {
      setBusy(false);
    }
  };

  const pay = async () => {
    if (!journey || !/^\d{4}$/.test(mpin) || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await payTransitExit(journey.travel_uid, mpin, createIdempotencyKey());
      if (!result.ok || !result.data) {
        setMessage(result.message || 'Payment failed. Your fare due remains saved for retry.');
        setMpin('');
        return;
      }
      setTicket(result.data.ticket);
      setMpin('');
    } finally {
      setBusy(false);
    }
  };

  const boardingSequence = journey?.boarding_stop_sequence ?? 0;
  const canChooseExit = journey?.status === 'in_progress' && journey.exit_stop == null;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={19} tintColor={Monochrome.textPrimary} />
        </Pressable>
        <AppText style={styles.title}>My bus journey</AppText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {ticket ? (
          <View style={styles.card}>
            <AppText style={styles.heading}>Fare paid · Ticket issued</AppText>
            <AppText style={styles.route}>{ticket.route_name || 'Bus journey'} · Bus {ticket.bus_number || '—'}</AppText>
            <AppText style={styles.detail}>{ticket.boarding_stop || 'Boarding stop'} → {ticket.exit_stop || 'Exit stop'}</AppText>
            <AppText style={styles.amount}>{ticket.fare_formatted}</AppText>
            <AppText style={styles.detail}>Ticket {ticket.ticket_number}</AppText>
            <Pressable style={styles.primaryButton} onPress={() => router.replace('/(tabs)/history' as never)}>
              <AppText style={styles.primaryText}>View travel history</AppText>
            </Pressable>
          </View>
        ) : journey ? (
          <View style={styles.card}>
            <AppText style={styles.heading}>{journey.status === 'payment_due' ? 'Fare due' : 'Journey in progress'}</AppText>
            <AppText style={styles.route}>{journey.route_name || 'Bus journey'} · Bus {journey.bus_number || '—'}</AppText>
            <AppText style={styles.detail}>Boarded at {journey.boarding_stop || 'your selected stop'}</AppText>

            {canChooseExit ? (
              <>
                <AppText style={styles.sectionTitle}>Select your exit stop</AppText>
                {stops.filter((stop) => stop.sequence > boardingSequence).map((stop) => (
                  <Pressable
                    accessibilityRole="button"
                    key={`${stop.id}-${stop.sequence}`}
                    onPress={() => void previewExit(stop.sequence)}
                    disabled={busy}
                    style={[styles.stopButton, selectedSequence === stop.sequence && styles.stopSelected]}
                  >
                    <AppText style={styles.stopName}>{stop.name}</AppText>
                    <AppText style={styles.stopSequence}>Stop {stop.sequence}</AppText>
                  </Pressable>
                ))}
              </>
            ) : null}

            {preview || journey.status === 'payment_due' ? (
              <View style={styles.dueBox}>
                <AppText style={styles.sectionTitle}>Fare to pay</AppText>
                <AppText style={styles.amount}>
                  {preview?.fare.amount_formatted || `Rs. ${((journey.fare_due_minor || 0) / 100).toFixed(2)}`}
                </AppText>
                <TextInput
                  accessibilityLabel="Four-digit MPIN"
                  value={mpin}
                  onChangeText={(value) => setMpin(value.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                  placeholder="Enter MPIN"
                  placeholderTextColor={Monochrome.textMuted}
                  style={styles.mpinInput}
                />
                <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => void pay()} disabled={busy || mpin.length !== 4}>
                  <AppText style={styles.primaryText}>{busy ? 'Processing…' : 'Pay fare and get ticket'}</AppText>
                </Pressable>
              </View>
            ) : (
              <AppText style={styles.detail}>Choose the stop where you exit to calculate and save your fare.</AppText>
            )}
          </View>
        ) : (
          <View style={styles.card}>
            <AppText style={styles.heading}>Scan the driver QR to board</AppText>
            <AppText style={styles.detail}>Your route-based fare is calculated at exit. No fare is charged when boarding.</AppText>
            {!permission?.granted ? (
              <Pressable style={styles.primaryButton} onPress={() => void requestPermission()}>
                <AppText style={styles.primaryText}>Allow camera access</AppText>
              </Pressable>
            ) : (
              <View style={styles.camera}>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={busy ? undefined : ({ data }) => void board(data)}
                />
              </View>
            )}
            {busy ? <ActivityIndicator color={Monochrome.textPrimary} /> : null}
          </View>
        )}
        {message ? <AppText style={styles.message}>{message}</AppText> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Monochrome.background },
  header: {
    minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.four, backgroundColor: Monochrome.surfacePrimary,
    borderBottomWidth: 1, borderBottomColor: Monochrome.border,
  },
  backButton: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    borderRadius: 20, backgroundColor: Monochrome.surfaceSecondary,
  },
  title: { fontSize: 17, fontWeight: '800', color: Monochrome.textPrimary },
  content: { padding: Spacing.four, gap: Spacing.three },
  card: {
    padding: Spacing.four, gap: Spacing.three, borderRadius: 16,
    backgroundColor: Monochrome.surfacePrimary, borderWidth: 1, borderColor: Monochrome.border,
  },
  heading: { fontSize: 20, fontWeight: '800', color: Monochrome.textPrimary },
  route: { fontSize: 15, fontWeight: '700', color: Monochrome.textPrimary },
  detail: { fontSize: 13, lineHeight: 19, color: Monochrome.textSecondary },
  sectionTitle: { marginTop: Spacing.two, fontSize: 14, fontWeight: '700', color: Monochrome.textPrimary },
  stopButton: {
    padding: Spacing.three, borderRadius: 10, borderWidth: 1, borderColor: Monochrome.border,
    backgroundColor: Monochrome.surfaceSecondary, flexDirection: 'row', justifyContent: 'space-between',
  },
  stopSelected: { borderColor: Monochrome.actionPrimary },
  stopName: { fontSize: 14, fontWeight: '600', color: Monochrome.textPrimary },
  stopSequence: { fontSize: 12, color: Monochrome.textSecondary },
  dueBox: { marginTop: Spacing.two, gap: Spacing.two },
  amount: { fontSize: 26, fontWeight: '800', color: Monochrome.textPrimary },
  mpinInput: {
    height: 48, borderRadius: 10, borderWidth: 1, borderColor: Monochrome.border,
    backgroundColor: Monochrome.surfaceSecondary, paddingHorizontal: Spacing.three,
    color: Monochrome.textPrimary, letterSpacing: 8, textAlign: 'center',
  },
  primaryButton: {
    minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10,
    backgroundColor: Monochrome.actionPrimary, paddingHorizontal: Spacing.four,
  },
  primaryText: { color: Monochrome.surfacePrimary, fontSize: 14, fontWeight: '700' },
  camera: { height: 380, overflow: 'hidden', borderRadius: 12, backgroundColor: '#111' },
  message: { color: '#9b2c2c', fontSize: 13, lineHeight: 18 },
});
