import { AppText } from '@/components/typography/app-text';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { Monochrome, Spacing } from '@/constants/theme';
import { getTravelRecord } from '@/features/passenger/services/passengerApi';

export default function TravelDetailScreen() {
  const insets = useSafeAreaInsets();
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <SymbolView
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            size={20}
            tintColor={Monochrome.textPrimary}
          />
        </Pressable>
        <AppText style={styles.headerTitle}>Journey Receipt</AppText>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={Monochrome.textPrimary} />
            <AppText style={styles.loadingText}>Loading cryptographic receipt...</AppText>
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <AppText style={styles.errorText}>{error}</AppText>
          </View>
        ) : record ? (
          <View style={styles.receiptContainer}>
            {/* Top Ticket Header */}
            <View style={styles.ticketTop}>
              <View style={styles.iconCircle}>
                <SymbolView
                  name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                  size={36}
                  tintColor={Monochrome.textPrimary}
                />
              </View>
              <AppText style={styles.paidTitle}>Transit Fare Paid</AppText>
              <AppText style={styles.amountLarge}>{fareFormatted}</AppText>
              <View style={styles.statusBadge}>
                <AppText style={styles.statusLabel}>{record.status?.toUpperCase() || 'COMPLETED'}</AppText>
              </View>
            </View>

            {/* Perforation Simulation */}
            <View style={styles.perforationRow}>
              <View style={styles.circleCutLeft} />
              <View style={styles.dashedLine} />
              <View style={styles.circleCutRight} />
            </View>

            {/* Journey Meta Details */}
            <View style={styles.ticketBody}>
              <View style={styles.row}>
                <AppText style={styles.label}>Route</AppText>
                <AppText style={styles.value}>{record.route?.name || record.route_name || 'Transit Route'}</AppText>
              </View>

              <View style={styles.row}>
                <AppText style={styles.label}>Bus Number</AppText>
                <AppText style={styles.value}>{record.bus?.bus_number || record.bus_number || 'Standard Bus'}</AppText>
              </View>

              <View style={styles.row}>
                <AppText style={styles.label}>Operator</AppText>
                <AppText style={styles.value}>{record.company?.name || record.company_name || 'Nepal Public Transit'}</AppText>
              </View>

              <View style={styles.row}>
                <AppText style={styles.label}>Boarding Stop</AppText>
                <AppText style={styles.value}>{record.boarding_stop?.name || record.boarding_stop || 'Stop Origin'}</AppText>
              </View>

              <View style={styles.row}>
                <AppText style={styles.label}>Exit Stop</AppText>
                <AppText style={styles.value}>{record.exit_stop?.name || record.exit_stop || 'Stop Destination'}</AppText>
              </View>

              {record.distance_km && (
                <View style={styles.row}>
                  <AppText style={styles.label}>Distance</AppText>
                  <AppText style={styles.value}>{record.distance_km} km</AppText>
                </View>
              )}

              {record.boarded_at && (
                <View style={styles.row}>
                  <AppText style={styles.label}>Boarded At</AppText>
                  <AppText style={styles.value}>{new Date(record.boarded_at).toLocaleString()}</AppText>
                </View>
              )}

              <View style={[styles.row, { borderTopWidth: 1, borderTopColor: Monochrome.surfaceElevated, paddingTop: Spacing.three }]}>
                <AppText style={styles.label}>Travel UID</AppText>
                <AppText style={[styles.value, styles.uidText]}>{record.travel_uid || uid}</AppText>
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
    fontSize: 18,
    fontWeight: '800',
    color: Monochrome.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  loadingBox: {
    padding: Spacing.six,
    alignItems: 'center',
    gap: Spacing.two,
  },
  loadingText: {
    fontSize: 13,
    color: Monochrome.textSecondary,
  },
  errorBox: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 14,
    padding: Spacing.four,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  errorText: {
    color: Monochrome.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  receiptContainer: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  ticketTop: {
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.one,
  },
  iconCircle: {
    marginBottom: Spacing.two,
  },
  paidTitle: {
    fontSize: 13,
    color: Monochrome.textSecondary,
    fontWeight: '600',
  },
  amountLarge: {
    fontSize: 34,
    fontWeight: '800',
    color: Monochrome.textPrimary,
    letterSpacing: -0.5,
  },
  statusBadge: {
    backgroundColor: Monochrome.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Monochrome.textSecondary,
  },
  perforationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 24,
    backgroundColor: Monochrome.surfaceSecondary,
  },
  circleCutLeft: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Monochrome.background,
    marginLeft: -10,
  },
  circleCutRight: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Monochrome.background,
    marginRight: -10,
  },
  dashedLine: {
    flex: 1,
    height: 1,
    borderWidth: 1,
    borderColor: Monochrome.border,
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
    color: Monochrome.textMuted,
    fontWeight: '500',
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
    color: Monochrome.textPrimary,
    textAlign: 'right',
    maxWidth: '65%',
  },
  uidText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    color: Monochrome.textSecondary,
  },
});
