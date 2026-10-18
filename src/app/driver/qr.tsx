import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import QRCode from 'react-native-qrcode-svg';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand, Spacing } from '@/constants/theme';
import { getActiveTripQr, type DriverTripQr } from '@/features/driver/services/driverApi';

export default function DriverTripQrScreen() {
  const insets = useSafeAreaInsets();
  const [qr, setQr] = useState<DriverTripQr | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await getActiveTripQr();
    if (result.ok && result.data) {
      setQr(result.data);
      setError(null);
    } else {
      setQr(null);
      setError(result.message || 'Unable to generate a trip payment QR.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    const initialLoad = setTimeout(() => {
      if (active) void refresh();
    }, 0);
    const interval = setInterval(() => {
      if (active) void refresh();
    }, 90_000);
    return () => {
      active = false;
      clearTimeout(initialLoad);
      clearInterval(interval);
    };
  }, [refresh]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
        <View>
          <Text style={styles.title}>Passenger Fare QR</Text>
          <Text style={styles.subtitle}>Only valid for your active trip</Text>
        </View>
      </View>
      <View style={styles.content}>
        {loading && !qr ? <ActivityIndicator size="large" color={Brand.teal.primary} /> : null}
        {qr ? (
          <>
            <View style={styles.qrCard}><QRCode value={qr.qr_payload} size={250} /></View>
            <Text style={styles.route}>{qr.route_name || 'Active route'}</Text>
            <Text style={styles.info}>Bus {qr.bus_number || '—'}</Text>
            <Text style={styles.info}>Trip {qr.trip_reference}</Text>
            <Text style={styles.expiry}>Refreshes every 90 seconds; token expires after {qr.expires_in_seconds} seconds.</Text>
            <Pressable disabled={loading} onPress={() => void refresh()} style={styles.button}>
              <Text style={styles.buttonText}>{loading ? 'Refreshing…' : 'Refresh QR now'}</Text>
            </Pressable>
          </>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
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
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 24 },
  qrCard: { padding: 18, borderRadius: 22, backgroundColor: '#FFFFFF' },
  route: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginTop: 24 },
  info: { color: '#CBD5E1', fontSize: 14, marginTop: 8 },
  expiry: { color: '#94A3B8', fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 16, maxWidth: 300 },
  button: { minHeight: 48, borderRadius: 14, backgroundColor: Brand.teal.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, marginTop: 20 },
  buttonText: { color: '#0F172A', fontSize: 14, fontWeight: '800' },
  error: { color: '#FCA5A5', textAlign: 'center', fontSize: 14, marginTop: 18 },
});
