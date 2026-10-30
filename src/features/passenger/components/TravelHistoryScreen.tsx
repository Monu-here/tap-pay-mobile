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
import { LinearGradient } from 'expo-linear-gradient';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getTravelHistory, type TravelRecord } from '@/features/passenger/services/passengerApi';

type TravelHistoryScreenProps = {
  onBack?: () => void;
};

function getStatusColor(status: string): { bg: string; text: string } {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'paid':
      return { bg: 'rgba(27,138,90,0.12)', text: '#1B8A5A' };
    case 'pending':
      return { bg: 'rgba(194,120,3,0.12)', text: '#C27803' };
    case 'failed':
    case 'cancelled':
      return { bg: 'rgba(193,18,31,0.12)', text: '#C1121F' };
    default:
      return { bg: 'rgba(102,155,188,0.12)', text: '#669BBC' };
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Recent';
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (isToday) return `Today, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (isYesterday) return `Yesterday, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

function groupTripsByDate(trips: TravelRecord[]): { label: string; trips: TravelRecord[] }[] {
  const groups: Record<string, TravelRecord[]> = {};
  for (const trip of trips) {
    const d = trip.boarded_at ? new Date(trip.boarded_at) : null;
    const now = new Date();
    let label: string;
    if (!d) {
      label = 'Recent';
    } else {
      const isToday = d.toDateString() === now.toDateString();
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const isYesterday = d.toDateString() === yesterday.toDateString();
      if (isToday) label = 'Today';
      else if (isYesterday) label = 'Yesterday';
      else label = d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
    }
    if (!groups[label]) groups[label] = [];
    groups[label].push(trip);
  }
  return Object.entries(groups).map(([label, grpTrips]) => ({ label, trips: grpTrips }));
}

function formatFare(formatted: string | null, minor: number): string {
  if (formatted) return formatted;
  return `NPR ${(minor / 100).toFixed(2)}`;
}

export function TravelHistoryScreen({ onBack = () => router.back() }: TravelHistoryScreenProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const [trips, setTrips] = useState<TravelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTrips = useCallback(async (page = 1, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await getTravelHistory(page);
      if (result.ok && result.data) setTrips(result.data.travel_records || []);
      else setError(result.message || 'Travel history could not be loaded.');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Travel history could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void loadTrips());
    return () => cancelAnimationFrame(frame);
  }, [loadTrips]);

  const grouped = groupTripsByDate(trips);
  const totalSpent = trips.reduce((sum, t) => sum + t.fare_minor, 0);
  const completedCount = trips.filter(t =>
    ['completed', 'paid'].includes(t.status.toLowerCase())).length;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />

      {/* Gradient Header */}
      <LinearGradient
        colors={['#003049', '#001824']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradientHeader, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerTopRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={onBack}
            style={styles.backBtn}
            hitSlop={8}
          >
            <SymbolView
              name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
              size={20}
              tintColor="#FDF0D5"
            />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <AppText style={styles.headerTitle}>My Trips</AppText>
            <AppText style={styles.headerSubtitle}>Travel history & receipts</AppText>
          </View>
          <View style={{ width: 38 }} />
        </View>

        {/* Stats Row */}
        {!loading && trips.length > 0 && (
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <AppText style={styles.statValue}>{trips.length}</AppText>
              <AppText style={styles.statLabel}>Total Trips</AppText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <AppText style={styles.statValue}>{completedCount}</AppText>
              <AppText style={styles.statLabel}>Completed</AppText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <AppText style={styles.statValue}>
                {(totalSpent / 100).toLocaleString('en-NP', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </AppText>
              <AppText style={styles.statLabel}>NPR Spent</AppText>
            </View>
          </View>
        )}
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadTrips(1, true)}
            tintColor="#C1121F"
          />
        }
      >
        {/* Loading */}
        {loading && !refreshing && (
          <View style={styles.centeredBox}>
            <ActivityIndicator size="large" color="#C1121F" />
            <AppText style={[styles.stateText, { color: theme.textSecondary }]}>
              Fetching your journey receipts…
            </AppText>
          </View>
        )}

        {/* Error */}
        {error && !loading && (
          <View style={[styles.errorCard, { backgroundColor: theme.surfacePrimary, borderColor: theme.border }]}>
            <View style={[styles.errorIconBox, { backgroundColor: 'rgba(193,18,31,0.1)' }]}>
              <SymbolView
                name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
                size={26}
                tintColor="#C1121F"
              />
            </View>
            <AppText style={[styles.errorTitle, { color: theme.text }]}>
              Couldn&apos;t Load History
            </AppText>
            <AppText style={[styles.errorSub, { color: theme.textSecondary }]}>{error}</AppText>
            <Pressable
              accessibilityRole="button"
              onPress={() => void loadTrips()}
              style={styles.retryButton}
            >
              <AppText style={styles.retryText}>Try Again</AppText>
            </Pressable>
          </View>
        )}

        {/* Empty State */}
        {!loading && !error && trips.length === 0 && (
          <View style={[styles.emptyCard, { backgroundColor: theme.surfacePrimary, borderColor: theme.border }]}>
            <View style={[styles.emptyIconBox, { backgroundColor: '#003049' }]}>
              <SymbolView
                name={{ ios: 'bus.fill', android: 'directions_bus', web: 'directions_bus' }}
                size={32}
                tintColor="#FDF0D5"
              />
            </View>
            <AppText style={[styles.emptyTitle, { color: theme.text }]}>No Journeys Yet</AppText>
            <AppText style={[styles.emptySub, { color: theme.textSecondary }]}>
              Scan a driver QR with the Scan tab to pay your fare. Every trip will be recorded here.
            </AppText>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(tabs)/scan' as any)}
              style={styles.emptyAction}
            >
              <SymbolView
                name={{ ios: 'qrcode.viewfinder', android: 'qr_code_scanner', web: 'qr_code_scanner' }}
                size={16}
                tintColor="#FFFFFF"
              />
              <AppText style={styles.emptyActionText}>Scan & Pay Now</AppText>
            </Pressable>
          </View>
        )}

        {/* Grouped Trip List */}
        {!loading && !error && grouped.map(({ label, trips: groupTrips }) => (
          <View key={label} style={styles.group}>
            <View style={styles.groupLabelRow}>
              <AppText style={[styles.groupLabel, { color: theme.textSecondary }]}>{label}</AppText>
              <View style={[styles.groupLine, { backgroundColor: theme.border }]} />
            </View>

            <View style={[styles.groupCard, { backgroundColor: theme.surfacePrimary, borderColor: theme.border }]}>
              {groupTrips.map((trip, idx) => {
                const statusStyle = getStatusColor(trip.status);
                return (
                  <Pressable
                    key={trip.travel_uid || trip.id}
                    onPress={() => router.push(`/travel/${trip.travel_uid}` as any)}
                    style={[styles.tripRow, idx > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}
                  >
                    {/* Icon */}
                    <View style={[styles.tripIconBox, { backgroundColor: '#003049' }]}>
                      <SymbolView
                        name={{ ios: 'bus.fill', android: 'directions_bus', web: 'directions_bus' }}
                        size={16}
                        tintColor="#FDF0D5"
                      />
                    </View>

                    {/* Info */}
                    <View style={styles.tripInfo}>
                      <AppText style={[styles.tripRoute, { color: theme.text }]} numberOfLines={1}>
                        {trip.route_name || 'Bus Journey'}
                      </AppText>
                      {(trip.boarding_stop || trip.exit_stop) ? (
                        <AppText style={[styles.tripStops, { color: theme.textSecondary }]} numberOfLines={1}>
                          {trip.boarding_stop && trip.exit_stop
                            ? `${trip.boarding_stop} → ${trip.exit_stop}`
                            : trip.boarding_stop || trip.exit_stop}
                        </AppText>
                      ) : trip.bus_number ? (
                        <AppText style={[styles.tripStops, { color: theme.textSecondary }]}>
                          Bus {trip.bus_number}
                        </AppText>
                      ) : null}
                      <AppText style={[styles.tripTime, { color: theme.textMuted }]}>
                        {formatDate(trip.boarded_at)}
                      </AppText>
                    </View>

                    {/* Right */}
                    <View style={styles.tripRight}>
                      <AppText style={[styles.tripFare, { color: theme.text }]}>
                        {formatFare(trip.fare_formatted, trip.fare_minor)}
                      </AppText>
                      <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                        <AppText style={[styles.statusText, { color: statusStyle.text }]}>
                          {trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}
                        </AppText>
                      </View>
                    </View>

                    <SymbolView
                      name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                      size={13}
                      tintColor={theme.textMuted}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* ── Gradient Header ── */
  gradientHeader: {
    paddingHorizontal: Spacing.four,
    paddingBottom: 20,
    gap: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(253,240,213,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FDF0D5',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(253,240,213,0.6)',
    marginTop: 2,
  },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(253,240,213,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(253,240,213,0.12)',
    padding: 14,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FDF0D5',
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(253,240,213,0.55)',
    letterSpacing: 0.2,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(253,240,213,0.15)',
    marginVertical: 4,
  },

  /* ── Scroll Content ── */
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },

  /* ── Centered / Loading ── */
  centeredBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  stateText: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
  },

  /* ── Error ── */
  errorCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    marginTop: Spacing.two,
  },
  errorIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorSub: {
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 18,
  },
  retryButton: {
    marginTop: 6,
    backgroundColor: '#C1121F',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  /* ── Empty ── */
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    gap: 10,
    marginTop: Spacing.two,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 19,
  },
  emptyAction: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#C1121F',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  /* ── Groups ── */
  group: {
    gap: 8,
    marginTop: 6,
  },
  groupLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    flexShrink: 0,
  },
  groupLine: {
    flex: 1,
    height: 1,
  },

  /* ── Trip Cards ── */
  groupCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  tripIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tripInfo: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  tripRoute: {
    fontSize: 14,
    fontWeight: '700',
  },
  tripStops: {
    fontSize: 12,
    fontWeight: '400',
  },
  tripTime: {
    fontSize: 11,
    fontWeight: '400',
    marginTop: 1,
  },
  tripRight: {
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
  },
  tripFare: {
    fontSize: 14,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
