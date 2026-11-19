import { AppText } from '@/components/typography/app-text';
import { AppBackButton } from '@/components/ui/app-back-button';
import { TransactionSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { Palette, SemanticColors, Spacing } from '@/constants/theme';
import { getTravelRecord } from '@/features/passenger/services/passengerApi';
import { useTheme } from '@/hooks/use-theme';
import { LinearGradient } from 'expo-linear-gradient';

export default function TravelDetailScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { uid } = useLocalSearchParams<{ uid: string }>();

  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      setLoading(true);
      try {
        const res = await getTravelRecord(uid);
        if (res.ok && res.data) {
          setRecord(res.data.travel_record);
        } else {
          setError(res.message || 'Travel record not found.');
        }
      } catch {
        setError('Network error fetching receipt.');
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]);

  const fareMinor = record?.fare_minor ?? record?.fare?.amount_minor ?? 0;
  const fareFormatted = record?.fare?.formatted ?? `Rs. ${(fareMinor / 100).toFixed(2)}`;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />

      <LinearGradient
        colors={['#003049', '#001824']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <AppBackButton />
        <AppText style={styles.headerTitle}>Journey Receipt</AppText>
        <View style={styles.headerSpacer} />
      </LinearGradient>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}>
        {loading ? (
          <TransactionSkeleton count={1} />
        ) : error ? (
          <View style={[styles.errorBox, { backgroundColor: theme.surfacePrimary, borderColor: theme.border }]}>
            <AppText style={[styles.errorText, { color: theme.text }]}>{error}</AppText>
          </View>
        ) : record ? (
          <View style={[styles.receiptContainer, { backgroundColor: theme.surfacePrimary, borderColor: theme.border }]}>
            <LinearGradient
              colors={['#003049', '#001824']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ticketTop}
            >
              <View style={styles.iconCircle}>
                <SymbolView
                  name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                  size={36}
                  tintColor={SemanticColors.success}
                />
              </View>
              <AppText style={styles.paidTitle}>Transit Fare Paid</AppText>
              <AppText style={styles.amountLarge}>{fareFormatted}</AppText>
              <View style={styles.statusBadge}>
                <AppText style={styles.statusLabel}>{record.status?.toUpperCase() || 'COMPLETED'}</AppText>
              </View>
            </LinearGradient>

            <View style={styles.perforationRow}>
              <View style={[styles.circleCutLeft, { backgroundColor: theme.background }]} />
              <View style={[styles.dashedLine, { borderColor: theme.border }]} />
              <View style={[styles.circleCutRight, { backgroundColor: theme.background }]} />
            </View>

            <View style={styles.ticketBody}>
              <View style={styles.row}>
                <AppText style={[styles.label, { color: theme.textMuted }]}>Route</AppText>
                <AppText style={[styles.value, { color: theme.text }]}>{record.route?.name || record.route_name || 'Transit Route'}</AppText>
              </View>

              <View style={styles.row}>
                <AppText style={[styles.label, { color: theme.textMuted }]}>Bus Number</AppText>
                <AppText style={[styles.value, { color: theme.text }]}>{record.bus?.bus_number || record.bus_number || 'Standard Bus'}</AppText>
              </View>

              <View style={styles.row}>
                <AppText style={[styles.label, { color: theme.textMuted }]}>Operator</AppText>
                <AppText style={[styles.value, { color: theme.text }]}>{record.company?.name || record.company_name || 'Nepal Public Transit'}</AppText>
              </View>

              <View style={styles.row}>
                <AppText style={[styles.label, { color: theme.textMuted }]}>From</AppText>
                <AppText style={[styles.value, { color: theme.text }]}>{record.boarding_stop?.name || record.boarding_stop || 'Stop Origin'}</AppText>
              </View>

              <View style={styles.row}>
                <AppText style={[styles.label, { color: theme.textMuted }]}>To</AppText>
                <AppText style={[styles.value, { color: theme.text }]}>{record.exit_stop?.name || record.exit_stop || 'Stop Destination'}</AppText>
              </View>

              {record.distance_km && (
                <View style={styles.row}>
                  <AppText style={[styles.label, { color: theme.textMuted }]}>Distance</AppText>
                  <AppText style={[styles.value, { color: theme.text }]}>{record.distance_km} km</AppText>
                </View>
              )}

              {record.boarded_at && (
                <View style={styles.row}>
                  <AppText style={[styles.label, { color: theme.textMuted }]}>Boarded At</AppText>
                  <AppText style={[styles.value, { color: theme.text }]}>{new Date(record.boarded_at).toLocaleString()}</AppText>
                </View>
              )}

              <View style={[styles.row, { borderTopWidth: 1, borderTopColor: theme.border, paddingTop: Spacing.three }]}>
                <AppText style={[styles.label, { color: theme.textMuted }]}>Travel UID</AppText>
                <AppText style={[styles.value, styles.uidText, { color: theme.textSecondary }]}>{record.travel_uid || uid}</AppText>
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingBottom: 20,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(253,240,213,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 38,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Palette.warmCream,
    letterSpacing: -0.2,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  loadingBox: {
    padding: Spacing.six,
    alignItems: 'center',
    gap: Spacing.two,
  },
  loadingText: {
    fontSize: 13,
  },
  errorBox: {
    borderRadius: 18,
    padding: Spacing.four,
    alignItems: 'center',
    borderWidth: 1,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
  },
  receiptContainer: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#001824',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  ticketTop: {
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 210,
    justifyContent: 'center',
  },
  iconCircle: {
    marginBottom: Spacing.two,
  },
  paidTitle: {
    fontSize: 13,
    color: 'rgba(253,240,213,0.72)',
    fontWeight: '600',
  },
  amountLarge: {
    fontSize: 34,
    fontWeight: '800',
    color: Palette.warmCream,
    letterSpacing: -0.5,
  },
  statusBadge: {
    backgroundColor: 'rgba(253,240,213,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(253,240,213,0.16)',
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Palette.warmCream,
    letterSpacing: 0.6,
  },
  perforationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 24,
  },
  circleCutLeft: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: -10,
  },
  circleCutRight: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: -10,
  },
  dashedLine: {
    flex: 1,
    height: 1,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginHorizontal: Spacing.two,
  },
  ticketBody: {
    padding: Spacing.five,
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    maxWidth: '65%',
  },
  uidText: {
    fontSize: 11,
  },
});
