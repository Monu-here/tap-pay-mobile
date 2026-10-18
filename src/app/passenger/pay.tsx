import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand, Spacing } from '@/constants/theme';
import {
  payTransitFare,
  quoteTransitFare,
  type TransitFareQuote,
  type TransitFareTicket,
} from '@/features/passenger/services/passengerApi';
import { createIdempotencyKey } from '@/features/auth/services/apiClient';

export default function PassengerPayScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [quote, setQuote] = useState<TransitFareQuote | null>(null);
  const [ticket, setTicket] = useState<TransitFareTicket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const insufficientBalance = quote !== null && quote.wallet.balance_minor < quote.fare.amount_minor;

  const scan = useCallback(async (payload: string) => {
    if (loading || quote || ticket) return;
    setLoading(true);
    setError(null);
    setQrPayload(payload);
    const result = await quoteTransitFare(payload);
    if (result.ok && result.data) {
      setQuote(result.data);
      setIdempotencyKey(createIdempotencyKey());
    } else {
      setError(result.message || 'The transport QR could not be verified.');
      setQrPayload(null);
    }
    setLoading(false);
  }, [loading, quote, ticket]);

  const confirmPayment = async () => {
    if (!qrPayload || !idempotencyKey || paying) return;
    setPaying(true);
    setError(null);
    const result = await payTransitFare(qrPayload, idempotencyKey);
    if (result.ok && result.data?.ticket) {
      setTicket(result.data.ticket);
    } else {
      setError(result.message || 'Payment could not be confirmed. No success has been assumed.');
    }
    setPaying(false);
  };

  const reset = () => {
    setQrPayload(null);
    setQuote(null);
    setTicket(null);
    setError(null);
    setIdempotencyKey(null);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View>
          <Text style={styles.title}>Pay Transit Fare</Text>
          <Text style={styles.subtitle}>Scan the QR displayed by your driver</Text>
        </View>
      </View>

      {!ticket && !quote && (
        <>
          {!permission?.granted ? (
            <View style={styles.centerCard}>
              <Text style={styles.cardTitle}>Camera access is needed</Text>
              <Text style={styles.bodyText}>Allow camera access to scan a Tap & Pay trip QR.</Text>
              <Pressable onPress={requestPermission} style={styles.primaryButton}>
                <Text style={styles.primaryText}>Grant camera permission</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.cameraBox}>
              <CameraView
                style={StyleSheet.absoluteFill}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={loading ? undefined : ({ data }) => void scan(data)}
              />
              <View style={styles.cameraOverlay}>
                {loading ? <ActivityIndicator size="large" color="#FFFFFF" /> : null}
                <Text style={styles.cameraPrompt}>
                  {loading ? 'Verifying trip and fare…' : 'Position the driver’s QR inside the frame'}
                </Text>
              </View>
            </View>
          )}
        </>
      )}

      {quote && !ticket && (
        <View style={styles.centerCard}>
          <Text style={styles.eyebrow}>FARE REVIEW</Text>
          <Text style={styles.cardTitle}>{quote.route.name}</Text>
          <Text style={styles.bodyText}>
            {quote.company.name ? `${quote.company.name} · ` : ''}Bus {quote.bus.bus_number}
          </Text>
          {quote.fare.boarding_stop_name ? (
            <Text style={styles.bodyText}>Boarding: {quote.fare.boarding_stop_name}</Text>
          ) : null}
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Fare</Text>
            <Text style={styles.amount}>{quote.fare.amount_formatted}</Text>
          </View>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Wallet balance</Text>
            <Text style={styles.amountLabel}>{quote.wallet.balance_formatted}</Text>
          </View>
          <Text style={styles.notice}>
            {insufficientBalance
              ? 'Your wallet balance is too low for this fare. Add money before paying.'
              : 'Your wallet is charged only after you confirm. The server will verify the active trip and fare again.'}
          </Text>
          <Pressable disabled={paying || insufficientBalance} onPress={() => void confirmPayment()} style={[styles.primaryButton, (paying || insufficientBalance) && styles.disabledButton]}>
            {paying ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.primaryText}>{insufficientBalance ? 'Insufficient balance' : 'Confirm and pay'}</Text>}
          </Pressable>
          {insufficientBalance ? (
            <Pressable onPress={() => router.push('/(tabs)/wallet' as never)} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Add money</Text>
            </Pressable>
          ) : null}
          <Pressable disabled={paying} onPress={reset} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {ticket && (
        <View style={styles.centerCard}>
          <Text style={styles.successTitle}>Fare paid</Text>
          <Text style={styles.cardTitle}>{ticket.ticket_number}</Text>
          <Text style={styles.bodyText}>{ticket.route_name} · Bus {ticket.bus_number}</Text>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Paid</Text>
            <Text style={styles.amount}>{ticket.fare_formatted}</Text>
          </View>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Remaining balance</Text>
            <Text style={styles.amountLabel}>{ticket.balance_remaining_formatted}</Text>
          </View>
          <Text style={styles.notice}>Reference: {ticket.transaction_reference}</Text>
          <Pressable onPress={() => router.replace('/travel' as never)} style={styles.primaryButton}>
            <Text style={styles.primaryText}>View travel history</Text>
          </Pressable>
          <Pressable onPress={reset} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Pay another fare</Text>
          </Pressable>
        </View>
      )}

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={quote ? () => void confirmPayment() : reset} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>{quote ? 'Retry payment safely' : 'Scan again'}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', paddingHorizontal: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: Spacing.lg },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#FFFFFF', fontSize: 32, lineHeight: 36 },
  title: { color: '#FFFFFF', fontSize: 21, fontWeight: '800' },
  subtitle: { color: '#94A3B8', fontSize: 13, marginTop: 3 },
  cameraBox: { flex: 1, minHeight: 300, overflow: 'hidden', borderRadius: 24, backgroundColor: '#1E293B', marginVertical: 14 },
  cameraOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.18)', padding: 24 },
  cameraPrompt: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'center', marginTop: 18 },
  centerCard: { backgroundColor: '#1E293B', borderRadius: 24, padding: 22, marginTop: 16 },
  cardTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 8 },
  bodyText: { color: '#CBD5E1', fontSize: 14, lineHeight: 21, marginTop: 6 },
  eyebrow: { color: '#4ADE80', fontSize: 12, fontWeight: '800', letterSpacing: 1.3 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 14, marginTop: 14 },
  amountLabel: { color: '#CBD5E1', fontSize: 14 },
  amount: { color: '#4ADE80', fontSize: 24, fontWeight: '900' },
  notice: { color: '#94A3B8', fontSize: 12, lineHeight: 18, marginTop: 16 },
  primaryButton: { minHeight: 50, backgroundColor: Brand.teal.primary, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 20, paddingHorizontal: 16 },
  primaryText: { color: '#0F172A', fontSize: 15, fontWeight: '800' },
  disabledButton: { opacity: 0.5 },
  secondaryButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 10, paddingHorizontal: 16 },
  secondaryText: { color: '#CBD5E1', fontSize: 14, fontWeight: '700' },
  successTitle: { color: '#4ADE80', fontSize: 16, fontWeight: '900', textTransform: 'uppercase' },
  errorCard: { backgroundColor: '#451A1A', borderRadius: 16, padding: 16, marginVertical: 12 },
  errorText: { color: '#FECACA', fontSize: 14, lineHeight: 20 },
});
