import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import QRCode from 'react-native-qrcode-svg';

import { Brand, Spacing } from '@/constants/theme';
import { getPassengerQr, type PassengerQrData } from '@/features/passenger/services/passengerApi';
import { getSession } from '@/features/auth/session';

export default function PassengerQrScreen() {
  const insets = useSafeAreaInsets();
  const session = getSession();

  const [qrData, setQrData] = useState<PassengerQrData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(120);

  const fetchQr = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await getPassengerQr();
      if (res.ok && res.data) {
        setQrData(res.data);
        setSecondsRemaining(res.data.expires_in_seconds || 120);
      } else {
        setError(res.message || 'Unable to generate dynamic transit QR.');
      }
    } catch {
      setError('Connection failure. Please check backend connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQr();
  }, [fetchQr]);

  // Countdown timer for dynamic QR code refresh
  useEffect(() => {
    if (!qrData || loading) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          fetchQr();
          return 120;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [qrData, loading, fetchQr]);

  const passengerName = qrData?.passenger_name || session.user?.name || 'Passenger';
  const cardUid = qrData?.card_uid || '';
  const maskedCode = qrData?.masked_code || '••••';
  const isActive = qrData?.status === 'active';

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
        <Text style={styles.headerTitle}>My Transit QR</Text>
        <Pressable onPress={fetchQr} style={styles.refreshIconBtn} hitSlop={10}>
          <SymbolView
            name={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }}
            size={20}
            tintColor={Brand.teal.primary}
          />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 30 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Pass Card Container */}
        <View style={styles.passCard}>
          {/* Top Brand Banner */}
          <View style={styles.passHeader}>
            <View style={styles.brandRow}>
              <View style={styles.logoBadge}>
                <SymbolView
                  name={{ ios: 'wave.3.right.circle.fill', android: 'nfc', web: 'nfc' }}
                  size={22}
                  tintColor={Brand.white}
                />
              </View>
              <View>
                <Text style={styles.brandTitle}>TAP & PAY PASS</Text>
                <Text style={styles.brandSubtitle}>Digital Transit Token</Text>
              </View>
            </View>

            <View style={[styles.statusBadge, isActive ? styles.statusActive : styles.statusInactive]}>
              <Text style={styles.statusText}>{isActive ? 'ACTIVE' : (qrData?.status?.toUpperCase() || 'INACTIVE')}</Text>
            </View>
          </View>

          {/* Passenger Identity */}
          <View style={styles.passengerInfoRow}>
            <View>
              <Text style={styles.infoLabel}>PASSENGER NAME</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{passengerName}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.infoLabel}>CARD CODE</Text>
              <Text style={styles.infoValue}>{maskedCode}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* QR Code Presentation Box */}
          <View style={styles.qrContainer}>
            {loading ? (
              <View style={styles.qrLoadingBox}>
                <ActivityIndicator size="large" color={Brand.teal.primary} />
                <Text style={styles.qrLoadingText}>Generating cryptographic token...</Text>
              </View>
            ) : error ? (
              <View style={styles.errorBox}>
                <SymbolView
                  name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
                  size={36}
                  tintColor="#EF4444"
                />
                <Text style={styles.errorText}>{error}</Text>
                <Pressable onPress={fetchQr} style={styles.retryBtn}>
                  <Text style={styles.retryBtnText}>Retry Generation</Text>
                </Pressable>
              </View>
            ) : qrData ? (
              <View style={styles.qrWrapper}>
                <QRCode
                  value={qrData.qr_payload}
                  size={220}
                  backgroundColor="#FFFFFF"
                  color="#0B132B"
                />
                <Text style={styles.scanNotice}>Present this screen to the driver's scanner</Text>
              </View>
            ) : null}
          </View>

          {/* Dynamic Refresh Bar */}
          {!loading && !error && qrData && (
            <View style={styles.timerRow}>
              <View style={styles.timerIndicator}>
                <View
                  style={[
                    styles.timerProgress,
                    { width: `${Math.min(100, (secondsRemaining / 120) * 100)}%` },
                  ]}
                />
              </View>
              <View style={styles.timerDetails}>
                <Text style={styles.timerText}>
                  Refreshes in <Text style={{ fontWeight: '700', color: Brand.teal.primary }}>{secondsRemaining}s</Text>
                </Text>
                <Pressable onPress={fetchQr} hitSlop={6}>
                  <Text style={styles.manualRefreshText}>Refresh Now</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Card UID footnote */}
          {cardUid ? (
            <View style={styles.footerRow}>
              <Text style={styles.footerLabel}>CARD UID</Text>
              <Text style={styles.footerUid}>{cardUid}</Text>
            </View>
          ) : null}
        </View>

        {/* Security & Instructions Box */}
        <View style={styles.tipsBox}>
          <View style={styles.tipsHeader}>
            <SymbolView
              name={{ ios: 'shield.checkerboard', android: 'security', web: 'security' }}
              size={18}
              tintColor={Brand.teal.primary}
            />
            <Text style={styles.tipsTitle}>Secure Transit Verification</Text>
          </View>
          <Text style={styles.tipItem}>• Each QR token is digitally signed by the Tap & Pay server.</Text>
          <Text style={styles.tipItem}>• Replayed or expired QR codes are rejected by the bus scanner.</Text>
          <Text style={styles.tipItem}>• Fare is deducted securely from your linked digital wallet.</Text>
        </View>
      </ScrollView>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.white,
  },
  refreshIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(20, 184, 166, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  passCard: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  passHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logoBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Brand.teal.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Brand.white,
    letterSpacing: 0.8,
  },
  brandSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  statusInactive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4ADE80',
    letterSpacing: 0.5,
  },
  passengerInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.white,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: Spacing.md,
  },
  qrContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 280,
  },
  qrWrapper: {
    alignItems: 'center',
  },
  scanNotice: {
    marginTop: Spacing.md,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  qrLoadingBox: {
    alignItems: 'center',
    padding: Spacing.xl,
  },
  qrLoadingText: {
    marginTop: Spacing.md,
    fontSize: 13,
    color: '#64748B',
  },
  errorBox: {
    alignItems: 'center',
    padding: Spacing.md,
  },
  errorText: {
    marginTop: Spacing.sm,
    fontSize: 13,
    color: '#EF4444',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: Spacing.md,
    backgroundColor: Brand.teal.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 12,
  },
  retryBtnText: {
    color: Brand.white,
    fontWeight: '700',
    fontSize: 13,
  },
  timerRow: {
    marginTop: Spacing.lg,
  },
  timerIndicator: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  timerProgress: {
    height: '100%',
    backgroundColor: Brand.teal.primary,
  },
  timerDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  timerText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  manualRefreshText: {
    fontSize: 12,
    color: Brand.teal.primary,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  footerLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
  },
  footerUid: {
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', web: 'monospace' }),
  },
  tipsBox: {
    marginTop: Spacing.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.white,
  },
  tipItem: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 4,
  },
});
