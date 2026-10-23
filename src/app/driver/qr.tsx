import { AppText } from '@/components/typography/app-text';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import QRCode from 'react-native-qrcode-svg';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { Monochrome, Spacing } from '@/constants/theme';
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
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <SymbolView
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            size={18}
            tintColor={Monochrome.textPrimary}
          />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <AppText style={styles.title}>Passenger Fare QR</AppText>
          <AppText style={styles.subtitle}>Active Trip Payment Pass</AppText>
        </View>
      </View>

      <View style={styles.content}>
        {loading && !qr ? <ActivityIndicator size="large" color={Monochrome.textPrimary} /> : null}
        {qr ? (
          <>
            <View style={styles.qrContainer}>
              <View style={styles.qrCard}>
                <QRCode
                  value={qr.qr_payload}
                  size={240}
                  backgroundColor="#FFFFFF"
                  color="#000000"
                />
              </View>
            </View>

            <View style={styles.detailsCard}>
              <View style={styles.detailRow}>
                <AppText style={styles.detailLabel}>ROUTE</AppText>
                <AppText style={styles.detailValue}>{qr.route_name || 'Active Route'}</AppText>
              </View>
              <View style={styles.detailRow}>
                <AppText style={styles.detailLabel}>BUS</AppText>
                <AppText style={styles.detailValue}>{qr.bus_number || '—'}</AppText>
              </View>
              <View style={styles.detailRow}>
                <AppText style={styles.detailLabel}>TRIP REF</AppText>
                <AppText style={styles.detailValueMono}>{qr.trip_reference}</AppText>
              </View>
            </View>

            <AppText style={styles.expiry}>
              Refreshes every 90 seconds. Cryptographic token expires in {qr.expires_in_seconds}s.
            </AppText>

            <Pressable
              disabled={loading}
              onPress={() => void refresh()}
              style={[styles.button, loading && styles.buttonDisabled]}
            >
              <AppText style={styles.buttonText}>{loading ? 'Refreshing…' : 'Refresh QR Code'}</AppText>
            </Pressable>
          </>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <AppText style={styles.errorText}>{error}</AppText>
            <Pressable onPress={() => void refresh()} style={styles.retryButton}>
              <AppText style={styles.retryButtonText}>Retry</AppText>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Monochrome.background,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
  },
  title: {
    color: Monochrome.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: Monochrome.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 24,
  },
  qrContainer: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  detailsCard: {
    width: '100%',
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
    borderRadius: 16,
    padding: Spacing.md,
    marginTop: 20,
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Monochrome.textMuted,
    letterSpacing: 0.8,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Monochrome.textPrimary,
  },
  detailValueMono: {
    fontSize: 13,
    fontWeight: '600',
    color: Monochrome.textSecondary,
    fontFamily: 'monospace',
  },
  expiry: {
    color: Monochrome.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 16,
    maxWidth: 320,
  },
  button: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: Monochrome.actionPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Monochrome.actionPrimaryText,
    fontSize: 15,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    maxWidth: 340,
    marginTop: 20,
  },
  errorText: {
    color: Monochrome.textSecondary,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryButtonText: {
    color: Monochrome.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
});
