import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import * as Location from 'expo-location';

import { Brand, Spacing } from '@/constants/theme';
import {
  getFareRules,
  getRouteStops,
  getRoutes,
  type RouteInfo,
  type StopInfo,
} from '@/features/passenger/services/passengerApi';
import {
  getNearbyBuses,
  getNearbyStops,
  getPublicCompanies,
  searchStops,
  type PublicNearbyBus,
  type PublicStop,
  type TransportCompanyItem,
} from '@/features/transit/services/transitApi';

export default function TransitScreen() {
  const insets = useSafeAreaInsets();

  const [activeSegment, setActiveSegment] = useState<'routes' | 'nearby' | 'companies' | 'fares'>('routes');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [nearbyStops, setNearbyStops] = useState<PublicStop[]>([]);
  const [nearbyBuses, setNearbyBuses] = useState<PublicNearbyBus[]>([]);
  const [nearbyLocationAvailable, setNearbyLocationAvailable] = useState(false);
  const [companies, setCompanies] = useState<TransportCompanyItem[]>([]);
  const [fareRules, setFareRules] = useState<Record<string, unknown>[]>([]);

  // Route Detail Modal
  const [selectedRoute, setSelectedRoute] = useState<RouteInfo | null>(null);
  const [routeStops, setRouteStops] = useState<StopInfo[]>([]);
  const [loadingStops, setLoadingStops] = useState(false);

  const loadTransitData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      let location: Location.LocationObject | null = null;
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status === 'granted') {
          location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
        }
      } catch {
        location = null;
      }

      const [routesRes, compsRes, faresRes] = await Promise.all([
        getRoutes(),
        getPublicCompanies(),
        getFareRules(),
      ]);
      const [stopsRes, busesRes] = location
        ? await Promise.all([
            getNearbyStops(location.coords.latitude, location.coords.longitude, 3000),
            getNearbyBuses(location.coords.latitude, location.coords.longitude, 10),
          ])
        : [null, null];

      if (routesRes.ok && routesRes.data) setRoutes(routesRes.data.routes || []);
      if (stopsRes?.ok && stopsRes.data) setNearbyStops(stopsRes.data.stops || []);
      if (busesRes?.ok && busesRes.data) setNearbyBuses(busesRes.data.buses || []);
      if (!location) {
        setNearbyStops([]);
        setNearbyBuses([]);
      }
      setNearbyLocationAvailable(location !== null);
      if (compsRes.ok && compsRes.data) setCompanies(compsRes.data.companies || []);
      if (faresRes.ok && faresRes.data) setFareRules(faresRes.data.fare_rules || []);
    } catch {
      // Ignored
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTransitData();
  }, [loadTransitData]);

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      loadTransitData(false);
      return;
    }

    try {
      const res = await searchStops(text.trim());
      if (res.ok && res.data) {
        setNearbyStops(res.data.stops || []);
        setActiveSegment('nearby');
      }
    } catch {
      // Ignored
    }
  };

  const openRouteModal = async (route: RouteInfo) => {
    setSelectedRoute(route);
    setLoadingStops(true);
    try {
      const res = await getRouteStops(route.id);
      if (res.ok && res.data) {
        setRouteStops(res.data.stops || []);
      }
    } catch {
      // Ignored
    } finally {
      setLoadingStops(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Public Transit</Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchBarWrap}>
        <SymbolView
          name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
          size={18}
          tintColor={Brand.textSecondary}
        />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={handleSearch}
          placeholder="Search bus stops or routes..."
          placeholderTextColor={Brand.textSecondary}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => handleSearch('')} hitSlop={8}>
            <SymbolView
              name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
              size={16}
              tintColor={Brand.textSecondary}
            />
          </Pressable>
        )}
      </View>

      {/* Segment Tabs */}
      <View style={styles.segmentBar}>
        <Pressable
          onPress={() => setActiveSegment('routes')}
          style={[styles.segmentBtn, activeSegment === 'routes' && styles.segmentBtnActive]}
        >
          <Text style={[styles.segmentText, activeSegment === 'routes' && styles.segmentTextActive]}>
            Bus Routes
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveSegment('nearby')}
          style={[styles.segmentBtn, activeSegment === 'nearby' && styles.segmentBtnActive]}
        >
          <Text style={[styles.segmentText, activeSegment === 'nearby' && styles.segmentTextActive]}>
            Nearby Transit
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveSegment('companies')}
          style={[styles.segmentBtn, activeSegment === 'companies' && styles.segmentBtnActive]}
        >
          <Text style={[styles.segmentText, activeSegment === 'companies' && styles.segmentTextActive]}>
            Operators
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveSegment('fares')}
          style={[styles.segmentBtn, activeSegment === 'fares' && styles.segmentBtnActive]}
        >
          <Text style={[styles.segmentText, activeSegment === 'fares' && styles.segmentTextActive]}>
            Fare Rules
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadTransitData(true)} tintColor={Brand.teal.primary} />
        }
      >
        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Brand.teal.primary} />
            <Text style={styles.loadingText}>Fetching transit network...</Text>
          </View>
        ) : null}

        {/* --- Segment: Bus Routes --- */}
        {activeSegment === 'routes' && (
          <View style={styles.sectionContainer}>
            {routes.length > 0 ? (
              routes.map((rt) => (
                <Pressable
                  key={rt.id}
                  onPress={() => openRouteModal(rt)}
                  style={styles.routeCard}
                >
                  <View style={styles.routeCardTop}>
                    <View style={styles.routeCodeBadge}>
                      <Text style={styles.routeCodeText}>{rt.code}</Text>
                    </View>
                    <View style={styles.routeTitleGroup}>
                      <Text style={styles.routeName}>{rt.name}</Text>
                      {rt.company_name && (
                        <Text style={styles.routeCompany}>{rt.company_name}</Text>
                      )}
                    </View>
                    <SymbolView
                      name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                      size={18}
                      tintColor={Brand.textSecondary}
                    />
                  </View>

                  <View style={styles.routeMetricsRow}>
                    <View style={styles.metricItem}>
                      <SymbolView
                        name={{ ios: 'location.north.circle', android: 'near_me', web: 'near_me' }}
                        size={14}
                        tintColor={Brand.textSecondary}
                      />
                      <Text style={styles.metricText}>
                        {rt.origin_stop || 'Start'} → {rt.destination_stop || 'End'}
                      </Text>
                    </View>

                    <View style={styles.metricPills}>
                      {rt.distance_km && (
                        <Text style={styles.pillDistance}>{rt.distance_km} km</Text>
                      )}
                      {rt.estimated_minutes && (
                        <Text style={styles.pillDuration}>~{rt.estimated_minutes} mins</Text>
                      )}
                    </View>
                  </View>
                </Pressable>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No bus routes available</Text>
              </View>
            )}
          </View>
        )}

        {/* --- Segment: Nearby Buses & Stops --- */}
        {activeSegment === 'nearby' && (
          <View style={styles.sectionContainer}>
            <Text style={styles.subHeading}>Live Buses Near You (10 km radius)</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/passenger/tracking' as any)}
              style={styles.trackingButton}
            >
              <Text style={styles.trackingButtonText}>Open Live Bus Map</Text>
            </Pressable>
            {!nearbyLocationAvailable ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>Live bus locations are unavailable without your current location.</Text>
              </View>
            ) : nearbyBuses.length > 0 ? (
              <View style={styles.cardList}>
                {nearbyBuses.map((bus, idx) => (
                  <View key={bus.bus_id} style={[styles.busRow, idx > 0 && styles.rowDivider]}>
                    <View style={styles.busIconBox}>
                      <SymbolView
                        name={{ ios: 'bus.fill', android: 'directions_bus', web: 'directions_bus' }}
                        size={20}
                        tintColor="#0284C7"
                      />
                    </View>
                    <View style={styles.busInfo}>
                      <Text style={styles.busNumber}>{bus.bus_number}</Text>
                      <Text style={styles.busRouteName}>{bus.route.name || 'Active Service'}</Text>
                      {bus.company.name && <Text style={styles.busCompany}>{bus.company.name}</Text>}
                    </View>
                    <View style={styles.busLiveRight}>
                      {bus.speed !== null && (
                        <Text style={styles.speedText}>{bus.speed.toFixed(1)} km/h</Text>
                      )}
                      <View style={styles.liveIndicator}>
                        <View style={[
                          styles.liveDot,
                          isLocationStale(bus.last_seen_at) && styles.staleDot,
                        ]} />
                        <Text style={[
                          styles.liveText,
                          isLocationStale(bus.last_seen_at) && styles.staleText,
                        ]}>
                          {isLocationStale(bus.last_seen_at) ? 'Location Stale' : 'GPS Active'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No live buses reporting in this vicinity</Text>
              </View>
            )}

            <Text style={[styles.subHeading, { marginTop: Spacing.four }]}>Nearby Bus Stops</Text>
            {!nearbyLocationAvailable && nearbyStops.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>Nearby stops are unavailable without your current location.</Text>
              </View>
            ) : nearbyStops.length > 0 ? (
              <View style={styles.cardList}>
                {nearbyStops.map((stop, idx) => (
                  <View key={stop.id} style={[styles.stopRow, idx > 0 && styles.rowDivider]}>
                    <View style={styles.stopIconBox}>
                      <SymbolView
                        name={{ ios: 'mappin.circle.fill', android: 'pin_drop', web: 'pin_drop' }}
                        size={20}
                        tintColor={Brand.teal.primary}
                      />
                    </View>
                    <View style={styles.stopInfo}>
                      <Text style={styles.stopName}>{stop.name}</Text>
                      <Text style={styles.stopCode}>Code: {stop.code}</Text>
                    </View>
                    {stop.distance_km !== undefined && (
                      <Text style={styles.stopDistance}>{stop.distance_km.toFixed(1)} km away</Text>
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No bus stops located</Text>
              </View>
            )}
          </View>
        )}

        {/* --- Segment: Transport Companies --- */}
        {activeSegment === 'companies' && (
          <View style={styles.sectionContainer}>
            {companies.length > 0 ? (
              companies.map((comp) => (
                <View key={comp.id} style={styles.companyCard}>
                  <View style={styles.compHeader}>
                    <View style={styles.compIcon}>
                      <SymbolView
                        name={{ ios: 'building.2.crop.circle.fill', android: 'business', web: 'business' }}
                        size={26}
                        tintColor={Brand.primary}
                      />
                    </View>
                    <View style={styles.compInfo}>
                      <Text style={styles.compName}>{comp.name}</Text>
                      <Text style={styles.compCode}>ID: {comp.code}</Text>
                    </View>
                    <View style={[styles.statusTag, comp.status === 'active' ? styles.statusActive : styles.statusInactive]}>
                      <Text style={styles.statusTagText}>{comp.status.toUpperCase()}</Text>
                    </View>
                  </View>

                  <View style={styles.compDetails}>
                    {comp.phone && (
                      <View style={styles.compRow}>
                        <SymbolView name={{ ios: 'phone.fill', android: 'call', web: 'call' }} size={14} tintColor={Brand.textSecondary} />
                        <Text style={styles.compDetailText}>{comp.phone}</Text>
                      </View>
                    )}
                    {comp.address && (
                      <View style={styles.compRow}>
                        <SymbolView name={{ ios: 'mappin', android: 'location_on', web: 'location_on' }} size={14} tintColor={Brand.textSecondary} />
                        <Text style={styles.compDetailText}>{comp.address}</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No registered transport operators</Text>
              </View>
            )}
          </View>
        )}

        {/* --- Segment: Fare Rules --- */}
        {activeSegment === 'fares' && (
          <View style={styles.sectionContainer}>
            {fareRules.length > 0 ? (
              fareRules.map((rule: any) => (
                <View key={rule.id} style={styles.fareCard}>
                  <View style={styles.fareHeader}>
                    <Text style={styles.fareTitle}>{rule.name || `Fare Rule #${rule.id}`}</Text>
                    <View style={styles.farePill}>
                      <Text style={styles.farePillText}>
                        {rule.type_label || rule.type || 'standard'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.fareDesc}>
                    Base: {formatMoney(rule.base_amount ?? rule.amount)} ·
                    Per km: {formatMoney(rule.per_km_amount) || 'Not distance-based'}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>Standard Nepal Transit Fare System Active</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Route Stops Modal */}
      <Modal visible={Boolean(selectedRoute)} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalRouteCode}>{selectedRoute?.code}</Text>
                <Text style={styles.modalRouteName}>{selectedRoute?.name}</Text>
              </View>
              <Pressable onPress={() => setSelectedRoute(null)} hitSlop={8}>
                <SymbolView
                  name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                  size={24}
                  tintColor={Brand.textSecondary}
                />
              </Pressable>
            </View>

            <Text style={styles.stopsHeading}>Ordered Bus Stops</Text>

            {loadingStops ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={Brand.teal.primary} />
                <Text style={styles.loadingText}>Loading route sequence...</Text>
              </View>
            ) : routeStops.length > 0 ? (
              <ScrollView style={styles.stopsList}>
                {routeStops.map((stop, idx) => (
                  <View key={stop.id} style={styles.stopTimelineItem}>
                    <View style={styles.timelineLeft}>
                      <View style={[
                        styles.timelineDot,
                        idx === 0 && styles.dotStart,
                        idx === routeStops.length - 1 && styles.dotEnd,
                      ]} />
                      {idx < routeStops.length - 1 && <View style={styles.timelineLine} />}
                    </View>
                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineStopName}>{stop.name}</Text>
                      <Text style={styles.timelineSequence}>Stop #{stop.sequence || idx + 1}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.emptyText}>No stops sequenced for this route yet.</Text>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function isLocationStale(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return true;
  const timestamp = Date.parse(lastSeenAt);
  return Number.isNaN(timestamp) || Date.now() - timestamp > 120_000;
}

function formatMoney(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const money = value as Record<string, unknown>;
  if (typeof money.formatted === 'string') return money.formatted;
  if (typeof money.amount_minor === 'number') return `Rs. ${(money.amount_minor / 100).toFixed(2)}`;
  return '';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    backgroundColor: Brand.white,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Brand.text,
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.inputBackground,
    marginHorizontal: Spacing.four,
    marginVertical: Spacing.two,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    height: 44,
    gap: Spacing.two,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Brand.text,
  },
  segmentBar: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.two,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: Brand.white,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.textSecondary,
  },
  segmentTextActive: {
    color: Brand.text,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    gap: Spacing.three,
  },
  sectionContainer: {
    gap: Spacing.three,
  },
  subHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.text,
    marginBottom: 4,
  },
  trackingButton: {
    alignItems: 'center',
    backgroundColor: Brand.teal.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: Spacing.three,
  },
  trackingButtonText: {
    color: Brand.white,
    fontSize: 14,
    fontWeight: '700',
  },
  loadingBox: {
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.two,
  },
  loadingText: {
    fontSize: 13,
    color: Brand.textSecondary,
  },
  routeCard: {
    backgroundColor: Brand.white,
    borderRadius: 16,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: Spacing.three,
  },
  routeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  routeCodeBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  routeCodeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0284C7',
  },
  routeTitleGroup: {
    flex: 1,
  },
  routeName: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.text,
  },
  routeCompany: {
    fontSize: 12,
    color: Brand.textSecondary,
    marginTop: 2,
  },
  routeMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  metricText: {
    fontSize: 12,
    color: Brand.textSecondary,
  },
  metricPills: {
    flexDirection: 'row',
    gap: 6,
  },
  pillDistance: {
    fontSize: 11,
    color: '#0369A1',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    fontWeight: '600',
  },
  pillDuration: {
    fontSize: 11,
    color: '#15803D',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    fontWeight: '600',
  },
  cardList: {
    backgroundColor: Brand.white,
    borderRadius: 16,
    paddingHorizontal: Spacing.four,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  busRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  busIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  busInfo: {
    flex: 1,
  },
  busNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.text,
  },
  busRouteName: {
    fontSize: 12,
    color: Brand.textSecondary,
    marginTop: 2,
  },
  busCompany: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  busLiveRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  speedText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284C7',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#22C55E',
  },
  staleDot: {
    backgroundColor: '#F59E0B',
  },
  staleText: {
    color: '#B45309',
  },
  stopIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopInfo: {
    flex: 1,
  },
  stopName: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.text,
  },
  stopCode: {
    fontSize: 11,
    color: Brand.textSecondary,
    marginTop: 2,
  },
  stopDistance: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.teal.text,
  },
  companyCard: {
    backgroundColor: Brand.white,
    borderRadius: 16,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: Spacing.two,
  },
  compHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  compIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compInfo: {
    flex: 1,
  },
  compName: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.text,
  },
  compCode: {
    fontSize: 12,
    color: Brand.textSecondary,
    marginTop: 2,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: '#DCFCE7',
  },
  statusInactive: {
    backgroundColor: '#FEE2E2',
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  compDetails: {
    gap: 4,
    marginTop: 4,
  },
  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compDetailText: {
    fontSize: 12,
    color: Brand.textSecondary,
  },
  fareCard: {
    backgroundColor: Brand.white,
    borderRadius: 14,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  fareHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fareTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.text,
  },
  farePill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  farePillText: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  fareDesc: {
    fontSize: 13,
    color: Brand.textSecondary,
  },
  emptyCard: {
    backgroundColor: Brand.white,
    borderRadius: 16,
    padding: Spacing.five,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyText: {
    fontSize: 14,
    color: Brand.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Brand.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.three,
  },
  modalRouteCode: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0284C7',
  },
  modalRouteName: {
    fontSize: 18,
    fontWeight: '800',
    color: Brand.text,
    marginTop: 2,
  },
  stopsHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.textSecondary,
    marginBottom: Spacing.two,
  },
  stopsList: {
    marginTop: Spacing.two,
  },
  stopTimelineItem: {
    flexDirection: 'row',
    minHeight: 50,
  },
  timelineLeft: {
    width: 24,
    alignItems: 'center',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Brand.teal.primary,
    marginTop: 4,
  },
  dotStart: {
    backgroundColor: '#16A34A',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotEnd: {
    backgroundColor: '#DC2626',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#CBD5E1',
    marginVertical: 2,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: Spacing.two,
    paddingBottom: Spacing.three,
  },
  timelineStopName: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.text,
  },
  timelineSequence: {
    fontSize: 11,
    color: Brand.textSecondary,
    marginTop: 1,
  },
});
