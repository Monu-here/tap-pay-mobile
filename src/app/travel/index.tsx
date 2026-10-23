import { AppText } from '@/components/typography/app-text';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { Monochrome, Spacing } from '@/constants/theme';
import { getTravelHistory, type TravelRecord } from '@/features/passenger/services/passengerApi';

export default function TravelHistoryScreen() {
  const insets = useSafeAreaInsets();

  const [trips, setTrips] = useState<TravelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const page = 1;

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
    const frame = requestAnimationFrame(() => {
      void loadTrips(page);
    });
    return () => cancelAnimationFrame(frame);
  }, [loadTrips, page]);

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
        <AppText style={styles.headerTitle}>Travel History</AppText>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadTrips(1, true)}
            tintColor={Monochrome.textPrimary}
          />
        }
      >
        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={Monochrome.textPrimary} />
            <AppText style={styles.loadingText}>Fetching journey receipts...</AppText>
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
                    size={18}
                    tintColor={Monochrome.textPrimary}
                  />
                </View>

                <View style={styles.infoCol}>
                  <AppText style={styles.routeName}>{trip.route_name || 'Bus Journey'}</AppText>
                  <AppText style={styles.stopsText}>
                    {trip.boarding_stop && trip.exit_stop
                      ? `${trip.boarding_stop} → ${trip.exit_stop}`
                      : trip.bus_number ? `Bus: ${trip.bus_number}` : 'Public Transit'}
                  </AppText>
                  <AppText style={styles.dateText}>
                    {trip.boarded_at ? new Date(trip.boarded_at).toLocaleString() : 'Recent'}
                  </AppText>
                </View>

                <View style={styles.fareCol}>
                  <AppText style={styles.fareAmount}>
                    {trip.fare_formatted || `Rs. ${(trip.fare_minor / 100).toFixed(2)}`}
                  </AppText>
                  <View style={styles.statusBadge}>
                    <AppText style={styles.statusBadgeText}>{trip.status.toUpperCase()}</AppText>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <SymbolView
              name={{ ios: 'bus', android: 'directions_bus', web: 'directions_bus' }}
              size={40}
              tintColor={Monochrome.textMuted}
            />
            <AppText style={styles.emptyTitle}>No Journeys Recorded</AppText>
            <AppText style={styles.emptySubtitle}>
              When you tap your card or QR on public transit, each trip and its cryptographic fare receipt will be cataloged here.
            </AppText>
          </View>
        )}
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
  listCard: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Monochrome.border,
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
    borderTopColor: Monochrome.surfaceElevated,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
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
    color: Monochrome.textPrimary,
  },
  stopsText: {
    fontSize: 12,
    color: Monochrome.textSecondary,
  },
  dateText: {
    fontSize: 11,
    color: Monochrome.textMuted,
    marginTop: 2,
  },
  fareCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  fareAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: Monochrome.textPrimary,
  },
  statusBadge: {
    backgroundColor: Monochrome.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Monochrome.textSecondary,
  },
  emptyBox: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 16,
    padding: Spacing.six,
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: Monochrome.border,
    marginTop: Spacing.four,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Monochrome.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
