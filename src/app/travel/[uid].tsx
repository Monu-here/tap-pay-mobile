import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { Brand, Spacing } from '@/constants/theme';
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
            size={22}
            tintColor={Brand.text}
          />
        </Pressable>
        <Text style={styles.headerTitle}>Journey Receipt</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Brand.teal.primary} />
            <Text style={styles.loadingText}>Loading cryptographic receipt...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : record ? (
          <View style={styles.receiptContainer}>
            {/* Top Ticket Header */}
            <View style={styles.ticketTop}>
              <View style={styles.iconCircle}>
                <SymbolView
                  name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                  size={36}
                  tintColor="#16A34A"
                />
              </View>
              <Text style={styles.paidTitle}>Transit Fare Paid</Text>
              <Text style={styles.amountLarge}>{fareFormatted}</Text>
              <Text style={styles.statusLabel}>{record.status?.toUpperCase() || 'COMPLETED'}</Text>
            </View>

            {/* Jagged Divider / Perforation Simulation */}
            <View style={styles.perforationRow}>
              <View style={styles.circleCutLeft} />
              <View style={styles.dashedLine} />
              <View style={styles.circleCutRight} />
            </View>

            {/* Journey Meta Details */}
            <View style={styles.ticketBody}>
              <View style={styles.row}>
                <Text style={styles.label}>Route</Text>
                <Text style={styles.value}>{record.route?.name || record.route_name || 'Transit Route'}</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Bus Number</Text>
                <Text style={styles.value}>{record.bus?.bus_number || record.bus_number || 'Standard Bus'}</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Operator</Text>
                <Text style={styles.value}>{record.company?.name || record.company_name || 'Nepal Public Transit'}</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Boarding Stop</Text>
                <Text style={styles.value}>{record.boarding_stop?.name || record.boarding_stop || 'Stop Origin'}</Text>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Exit Stop</Text>
                <Text style={styles.value}>{record.exit_stop?.name || record.exit_stop || 'Stop Destination'}</Text>
              </View>

              {record.distance_km && (
                <View style={styles.row}>
                  <Text style={styles.label}>Distance</Text>
                  <Text style={styles.value}>{record.distance_km} km</Text>
                </View>
              )}

              {record.boarded_at && (
                <View style={styles.row}>
                  <Text style={styles.label}>Boarded At</Text>
                  <Text style={styles.value}>{new Date(record.boarded_at).toLocaleString()}</Text>
                </View>
              )}

              <View style={[styles.row, { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: Spacing.three }]}>
                <Text style={styles.label}>Travel UID</Text>
                <Text style={[styles.value, styles.uidText]}>{record.travel_uid || uid}</Text>
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
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    backgroundColor: '#0F172A',
  },
  backBtn: {
    padding: Spacing.one,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Brand.white,
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
    fontSize: 14,
    color: '#94A3B8',
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: Spacing.four,
    alignItems: 'center',
  },
  errorText: {
    color: Brand.error,
    fontSize: 14,
    fontWeight: '600',
  },
  receiptContainer: {
    backgroundColor: Brand.white,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
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
    fontSize: 14,
    color: Brand.textSecondary,
    fontWeight: '600',
  },
  amountLarge: {
    fontSize: 36,
    fontWeight: '800',
    color: Brand.text,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16A34A',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  perforationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 30,
    backgroundColor: Brand.white,
  },
  circleCutLeft: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    marginLeft: -10,
  },
  circleCutRight: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    marginRight: -10,
  },
  dashedLine: {
    flex: 1,
    height: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    color: Brand.textSecondary,
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.text,
    textAlign: 'right',
    maxWidth: '65%',
  },
  uidText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    color: Brand.primary,
  },
});
