import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { Brand, Spacing } from '@/constants/theme';
import { getTravelHistory, type TravelRecord } from '@/features/passenger/services/passengerApi';

export default function TravelHistoryScreen() {
  const insets = useSafeAreaInsets();

  const [trips, setTrips] = useState<TravelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);

  const loadTrips = useCallback(async (pageNum = 1, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await getTravelHistory(pageNum);
      if (res.ok && res.data) {
        setTrips(res.data.travel_records || []);
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTrips(page);
  }, [loadTrips, page]);

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
        <Text style={styles.headerTitle}>Travel History</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadTrips(1, true)} tintColor={Brand.teal.primary} />
        }
      >
        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Brand.teal.primary} />
            <Text style={styles.loadingText}>Fetching journey receipts...</Text>
          </View>
        ) : trips.length > 0 ? (
          <View style={styles.listCard}>
            {trips.map((trip, idx) => (
              <Pressable
                key={trip.travel_uid || trip.id}
                onPress={() => router.push(`/travel/${trip.travel_uid}` as any)}
                style={[styles.itemRow, idx > 0 && styles.rowDivider]}
              >
                <View style={styles.iconWrap}>
                  <SymbolView
                    name={{ ios: 'bus.fill', android: 'directions_bus', web: 'directions_bus' }}
                    size={20}
                    tintColor="#0284C7"
                  />
                </View>

                <View style={styles.infoCol}>
                  <Text style={styles.routeName}>{trip.route_name || 'Bus Journey'}</Text>
                  <Text style={styles.stopsText}>
                    {trip.boarding_stop && trip.exit_stop
                      ? `${trip.boarding_stop} → ${trip.exit_stop}`
                      : trip.bus_number ? `Bus: ${trip.bus_number}` : 'Public Transit'}
                  </Text>
                  <Text style={styles.dateText}>
                    {trip.boarded_at ? new Date(trip.boarded_at).toLocaleString() : 'Recent'}
                  </Text>
                </View>

                <View style={styles.fareCol}>
                  <Text style={styles.fareAmount}>
                    {trip.fare_formatted || `Rs. ${(trip.fare_minor / 100).toFixed(2)}`}
                  </Text>
                  <Text style={styles.statusBadge}>{trip.status.toUpperCase()}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <SymbolView
              name={{ ios: 'bus', android: 'directions_bus', web: 'directions_bus' }}
              size={44}
              tintColor={Brand.textSecondary}
            />
            <Text style={styles.emptyTitle}>No Journeys Recorded</Text>
            <Text style={styles.emptySubtitle}>
              When you tap your card or QR on public transit, each trip and its cryptographic fare receipt will be cataloged here.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    backgroundColor: Brand.white,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    padding: Spacing.one,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Brand.text,
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
    color: Brand.textSecondary,
  },
  listCard: {
    backgroundColor: Brand.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'center',
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCol: {
    flex: 1,
    gap: 2,
  },
  routeName: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.text,
  },
  stopsText: {
    fontSize: 13,
    color: '#475569',
  },
  dateText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  fareCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  fareAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: Brand.text,
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  emptyBox: {
    backgroundColor: Brand.white,
    borderRadius: 16,
    padding: Spacing.six,
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: Spacing.four,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Brand.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Brand.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
