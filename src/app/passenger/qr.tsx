import { AppText } from '@/components/typography/app-text';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import QRCode from 'react-native-qrcode-svg';

import { Monochrome, Spacing } from '@/constants/theme';
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
    const frame = requestAnimationFrame(() => {
      void fetchQr();
    });
    return () => cancelAnimationFrame(frame);
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
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <SymbolView
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            size={20}
            tintColor={Monochrome.textPrimary}
          />
        </Pressable>
        <AppText style={styles.headerTitle}>My Transit QR Pass</AppText>
        <Pressable onPress={fetchQr} style={styles.refreshIconBtn} hitSlop={10}>
          <SymbolView
            name={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }}
            size={18}
            tintColor={Monochrome.textPrimary}
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
                  size={20}
                  tintColor={Monochrome.textPrimary}
                />
              </View>
              <View>
                <AppText style={styles.brandTitle}>TAP &amp; PAY PASS</AppText>
                <AppText style={styles.brandSubtitle}>Digital Transit Token</AppText>
              </View>
            </View>

            <View style={[styles.statusBadge, isActive ? styles.statusActive : styles.statusInactive]}>
              <AppText style={styles.statusText}>{isActive ? 'ACTIVE' : (qrData?.status?.toUpperCase() || 'INACTIVE')}</AppText>
            </View>
          </View>

          {/* Passenger Identity */}
          <View style={styles.passengerInfoRow}>
            <View>
              <AppText style={styles.infoLabel}>PASSENGER NAME</AppText>
              <AppText style={styles.infoValue} numberOfLines={1}>{passengerName}</AppText>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <AppText style={styles.infoLabel}>CARD CODE</AppText>
              <AppText style={styles.infoValue}>{maskedCode}</AppText>
            </View>
          </View>

          <View style={styles.divider} />

          {/* QR Code Presentation Box */}
          <View style={styles.qrContainer}>
            {loading ? (
              <View style={styles.qrLoadingBox}>
                <ActivityIndicator size="small" color={Monochrome.textPrimary} />
                <AppText style={styles.qrLoadingText}>Generating cryptographic token...</AppText>
              </View>
            ) : error ? (
              <View style={styles.errorBox}>
                <SymbolView
                  name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
                  size={32}
                  tintColor={Monochrome.textPrimary}
                />
                <AppText style={styles.errorText}>{error}</AppText>
                <Pressable onPress={fetchQr} style={styles.retryBtn}>
                  <AppText style={styles.retryBtnText}>Retry Generation</AppText>
                </Pressable>
              </View>
            ) : qrData ? (
              <View style={styles.qrWrapper}>
                <QRCode
                  value={qrData.qr_payload}
                  size={220}
                  backgroundColor="#FFFFFF"
                  color="#000000"
                />
                <AppText style={styles.scanNotice}>Present this code to the driver for fare verification</AppText>
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
                <AppText style={styles.timerText}>
                  Refreshes in <AppText style={{ fontWeight: '700', color: Monochrome.textPrimary }}>{secondsRemaining}s</AppText>
                </AppText>
                <Pressable onPress={fetchQr} hitSlop={6}>
                  <AppText style={styles.manualRefreshText}>Refresh Now</AppText>
                </Pressable>
              </View>
            </View>
          )}

          {/* Card UID footnote */}
          {cardUid ? (
            <View style={styles.footerRow}>
              <AppText style={styles.footerLabel}>CARD UID</AppText>
              <AppText style={styles.footerUid}>{cardUid}</AppText>
            </View>
          ) : null}
        </View>

        {/* Security & Instructions Box */}
        <View style={styles.tipsBox}>
          <View style={styles.tipsHeader}>
            <SymbolView
              name={{ ios: 'shield.checkerboard', android: 'security', web: 'security' }}
              size={16}
              tintColor={Monochrome.textPrimary}
            />
            <AppText style={styles.tipsTitle}>Secure Transit Verification</AppText>
          </View>
          <AppText style={styles.tipItem}>• Each QR token is digitally signed by the Tap &amp; Pay server.</AppText>
          <AppText style={styles.tipItem}>• Replayed or expired QR codes are rejected by the bus scanner.</AppText>
          <AppText style={styles.tipItem}>• Fare is deducted securely from your linked digital wallet.</AppText>
        </View>
      </ScrollView>
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
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Monochrome.textPrimary,
  },
  refreshIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  passCard: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 22,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  passHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.four,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Monochrome.textPrimary,
    letterSpacing: 0.8,
  },
  brandSubtitle: {
    fontSize: 11,
    color: Monochrome.textMuted,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  statusActive: {
    backgroundColor: Monochrome.surfaceElevated,
  },
  statusInactive: {
    backgroundColor: Monochrome.surfacePrimary,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: Monochrome.textPrimary,
    letterSpacing: 0.5,
  },
  passengerInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Monochrome.textMuted,
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: Monochrome.surfaceElevated,
    marginVertical: Spacing.three,
  },
  qrContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 280,
  },
  qrWrapper: {
    alignItems: 'center',
  },
  scanNotice: {
    marginTop: Spacing.three,
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
  },
  qrLoadingBox: {
    alignItems: 'center',
    padding: Spacing.four,
  },
  qrLoadingText: {
    marginTop: Spacing.two,
    fontSize: 13,
    color: '#000000',
  },
  errorBox: {
    alignItems: 'center',
    padding: Spacing.three,
  },
  errorText: {
    marginTop: Spacing.one,
    fontSize: 13,
    color: '#000000',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: Spacing.three,
    backgroundColor: '#000000',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  timerRow: {
    marginTop: Spacing.four,
  },
  timerIndicator: {
    height: 3,
    backgroundColor: Monochrome.surfaceElevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  timerProgress: {
    height: '100%',
    backgroundColor: Monochrome.textPrimary,
  },
  timerDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  timerText: {
    fontSize: 12,
    color: Monochrome.textSecondary,
  },
  manualRefreshText: {
    fontSize: 12,
    color: Monochrome.textPrimary,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: Monochrome.surfaceElevated,
  },
  footerLabel: {
    fontSize: 10,
    color: Monochrome.textMuted,
    fontWeight: '700',
  },
  footerUid: {
    fontSize: 11,
    color: Monochrome.textSecondary,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', web: 'monospace' }),
  },
  tipsBox: {
    marginTop: Spacing.four,
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 16,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.two,
  },
  tipsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  tipItem: {
    fontSize: 12,
    color: Monochrome.textMuted,
    lineHeight: 18,
    marginBottom: 4,
  },
});
