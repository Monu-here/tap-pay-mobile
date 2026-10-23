import {AppText, AppTextInput } from '@/components/typography/app-text';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import * as Location from 'expo-location';

import { Monochrome, Spacing } from '@/constants/theme';
import {
  getFareRules,
  getJourneyOptions,
  saveRecentJourneySearch,
  getPassengerFavorites,
  getRecentJourneySearches,
  getRouteDepartures,
  getRouteStops,
  getRoutes,
  setRouteFavorite,
  setStopFavorite,
  type FavoriteStopInfo,
  type RouteDeparture,
  type RouteInfo,
  type RecentJourneySearch,
  type StopInfo,
} from '@/features/passenger/services/passengerApi';
import {
  getNearbyBuses,
  getNearbyStops,
  getPublicCompanies,
  getServiceNotices,
  searchStops,
  type PublicNearbyBus,
  type PublicStop,
  type ServiceNoticeItem,
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
  const [serviceNotices, setServiceNotices] = useState<ServiceNoticeItem[]>([]);
  const [serviceNoticesError, setServiceNoticesError] = useState<string | null>(null);
  const [favoriteRouteIds, setFavoriteRouteIds] = useState<number[]>([]);
  const [favoriteStopIds, setFavoriteStopIds] = useState<number[]>([]);
  const [favoriteStops, setFavoriteStops] = useState<FavoriteStopInfo[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [fromStopQuery, setFromStopQuery] = useState('');
  const [toStopQuery, setToStopQuery] = useState('');
  const [fromStopResults, setFromStopResults] = useState<PublicStop[]>([]);
  const [toStopResults, setToStopResults] = useState<PublicStop[]>([]);
  const [fromStop, setFromStop] = useState<PublicStop | null>(null);
  const [toStop, setToStop] = useState<PublicStop | null>(null);
  const [journeyOptions, setJourneyOptions] = useState<RouteInfo[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentJourneySearch[]>([]);
  const [recentSearchError, setRecentSearchError] = useState<string | null>(null);
  const [plannerError, setPlannerError] = useState<string | null>(null);
  const [plannerLoading, setPlannerLoading] = useState(false);

  // Route Detail Modal
  const [selectedRoute, setSelectedRoute] = useState<RouteInfo | null>(null);
  const [routeStops, setRouteStops] = useState<StopInfo[]>([]);
  const [loadingStops, setLoadingStops] = useState(false);
  const [routeDepartures, setRouteDepartures] = useState<RouteDeparture[]>([]);
  const [loadingDepartures, setLoadingDepartures] = useState(false);
  const [departureError, setDepartureError] = useState<string | null>(null);

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

      const [routesRes, compsRes, faresRes, favoritesRes, noticesRes, recentSearchesRes] = await Promise.all([
        getRoutes(),
        getPublicCompanies(),
        getFareRules(),
        getPassengerFavorites(),
        getServiceNotices(),
        getRecentJourneySearches(),
      ]);
      const [stopsRes, busesRes] = location
        ? await Promise.all([
            getNearbyStops(location.coords.latitude, location.coords.longitude, 3000),
            getNearbyBuses(location.coords.latitude, location.coords.longitude, 10),
          ])
        : [null, null];

      if (routesRes.ok && routesRes.data) setRoutes(routesRes.data.routes || []);
      if (favoritesRes.ok && favoritesRes.data) {
        setFavoriteRouteIds(favoritesRes.data.route_ids);
        setFavoriteStopIds(favoritesRes.data.stop_ids);
        setFavoriteStops(favoritesRes.data.favorite_stops);
      }
      if (stopsRes?.ok && stopsRes.data) setNearbyStops(stopsRes.data.stops || []);
      if (busesRes?.ok && busesRes.data) setNearbyBuses(busesRes.data.buses || []);
      if (!location) {
        setNearbyStops([]);
        setNearbyBuses([]);
      }
      setNearbyLocationAvailable(location !== null);
      if (compsRes.ok && compsRes.data) setCompanies(compsRes.data.companies || []);
      if (faresRes.ok && faresRes.data) setFareRules(faresRes.data.fare_rules || []);
      if (noticesRes.ok && noticesRes.data) {
        setServiceNotices(noticesRes.data.notices);
        setServiceNoticesError(null);
      } else if (!noticesRes.ok) {
        setServiceNoticesError(noticesRes.message || 'Could not load current service notices.');
      }
      if (recentSearchesRes.ok && recentSearchesRes.data) {
        setRecentSearches(recentSearchesRes.data.searches);
        setRecentSearchError(null);
      } else if (!recentSearchesRes.ok) {
        setRecentSearchError(recentSearchesRes.message || 'Could not load recent journey searches.');
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
      void loadTransitData();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadTransitData]);

  const handleOpenRouteDetails = async (route: RouteInfo) => {
    setSelectedRoute(route);
    setRouteStops([]);
    setRouteDepartures([]);
    setDepartureError(null);
    setLoadingStops(true);
    setLoadingDepartures(true);
    try {
      const [stopsResult, departuresResult] = await Promise.all([
        getRouteStops(route.id),
        getRouteDepartures(route.id),
      ]);
      setRouteStops(stopsResult.ok && stopsResult.data ? stopsResult.data.stops : []);
      if (departuresResult.ok && departuresResult.data) {
        setRouteDepartures(departuresResult.data.departures);
      } else {
        setDepartureError(departuresResult.message || 'Unable to load scheduled departures.');
      }
    } catch {
      setRouteStops([]);
      setDepartureError('Unable to load route details. Please try again.');
    } finally {
      setLoadingStops(false);
      setLoadingDepartures(false);
    }
  };

  const reopenRecentSearch = async (search: RecentJourneySearch) => {
    if (!search.from_stop || !search.to_stop) return;
    setPlannerError(null);
    try {
      const [fromResult, toResult] = await Promise.all([
        searchStops(search.from_stop.name),
        searchStops(search.to_stop.name),
      ]);
      if (!fromResult.ok || !fromResult.data || !toResult.ok || !toResult.data) {
        setPlannerError((!fromResult.ok && fromResult.message) || (!toResult.ok && toResult.message) || 'Could not reload the selected stops.');
        return;
      }
      const from = fromResult.data.stops.find((stop) => stop.id === search.from_stop?.id);
      const to = toResult.data.stops.find((stop) => stop.id === search.to_stop?.id);
      if (!from || !to) {
        setPlannerError('One of these stops is no longer available. Search again to choose active stops.');
        return;
      }
      setFromStop(from);
      setFromStopQuery(from.name);
      setToStop(to);
      setToStopQuery(to.name);
      setJourneyOptions([]);
      setPlannerLoading(true);
      const result = await getJourneyOptions(from.id, to.id);
      if (!result.ok || !result.data) {
        setPlannerError(result.message || 'Could not find routes for these stops.');
        return;
      }
      setJourneyOptions(result.data.routes);
    } catch (error) {
      setPlannerError(error instanceof Error ? error.message : 'Network error reopening this search.');
    } finally {
      setPlannerLoading(false);
    }
  };

  const filteredRoutes = routes.filter((r) => {
    if (showFavoritesOnly && !favoriteRouteIds.includes(r.id)) return false;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      r.code.toLowerCase().includes(q) ||
      (r.company_name && r.company_name.toLowerCase().includes(q)) ||
      (r.origin_stop && r.origin_stop.toLowerCase().includes(q)) ||
      (r.destination_stop && r.destination_stop.toLowerCase().includes(q))
    );
  });

  const searchPlannerStops = async (direction: 'from' | 'to') => {
    const query = direction === 'from' ? fromStopQuery : toStopQuery;
    if (query.trim().length < 2) {
      setPlannerError('Enter at least two characters to search for a stop.');
      return;
    }
    setPlannerError(null);
    const result = await searchStops(query.trim());
    if (!result.ok || !result.data) {
      setPlannerError(result.message || 'Could not search stops.');
      return;
    }
    if (direction === 'from') setFromStopResults(result.data.stops);
    else setToStopResults(result.data.stops);
  };

  const planJourney = async () => {
    if (!fromStop || !toStop) {
      setPlannerError('Choose both a starting stop and a destination.');
      return;
    }
    setPlannerError(null);
    setPlannerLoading(true);
    try {
      const result = await getJourneyOptions(fromStop.id, toStop.id);
      if (!result.ok || !result.data) {
        setPlannerError(result.message || 'Could not find routes for these stops.');
        setJourneyOptions([]);
        return;
      }
      setJourneyOptions(result.data.routes);
      const saved = await saveRecentJourneySearch(fromStop.id, toStop.id);
      if (saved.ok) {
        const recent = await getRecentJourneySearches();
        if (recent.ok && recent.data) setRecentSearches(recent.data.searches);
      } else {
        setRecentSearchError(saved.message || 'Journey found, but could not save it to recent searches.');
      }
    } catch (error) {
      setPlannerError(error instanceof Error ? error.message : 'Network error planning this journey.');
    } finally {
      setPlannerLoading(false);
    }
  };

  const toggleRouteFavorite = async (routeId: number) => {
    const nextFavorite = !favoriteRouteIds.includes(routeId);
    const result = await setRouteFavorite(routeId, nextFavorite);
    if (!result.ok) {
      Alert.alert('Could not update favorite', result.message || 'Please try again.');
      return;
    }
    setFavoriteRouteIds((current) => nextFavorite
      ? [...current, routeId]
      : current.filter((id) => id !== routeId));
  };

  const toggleStopFavorite = async (stopId: number) => {
    const nextFavorite = !favoriteStopIds.includes(stopId);
    const result = await setStopFavorite(stopId, nextFavorite);
    if (!result.ok) {
      Alert.alert('Could not update favorite', result.message || 'Please try again.');
      return;
    }
    setFavoriteStopIds((current) => nextFavorite
      ? [...current, stopId]
      : current.filter((id) => id !== stopId));
    setFavoriteStops((current) => {
      if (!nextFavorite) return current.filter((stop) => stop.id !== stopId);
      if (current.some((stop) => stop.id === stopId)) return current;
      const stop = nearbyStops.find((item) => item.id === stopId);
      return stop
        ? [...current, {
            id: stop.id,
            name: stop.name,
            code: stop.code,
            latitude: stop.latitude,
            longitude: stop.longitude,
          }]
        : current;
    });
  };

  const filteredCompanies = companies.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <AppText style={styles.headerTitle}>Transit &amp; Routes</AppText>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBarWrap}>
        <SymbolView
          name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
          size={16}
          tintColor={Monochrome.textMuted}
        />
        <AppTextInput
          style={styles.searchInput}
          placeholder="Search routes, bus stops, companies..."
          placeholderTextColor={Monochrome.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
            <SymbolView
              name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
              size={16}
              tintColor={Monochrome.textMuted}
            />
          </Pressable>
        )}
      </View>

      {/* Segment Navigation */}
      <View style={styles.segmentBar}>
        <Pressable
          onPress={() => setActiveSegment('routes')}
          style={[styles.segmentBtn, activeSegment === 'routes' && styles.segmentBtnActive]}
        >
          <AppText style={[styles.segmentText, activeSegment === 'routes' && styles.segmentTextActive]}>
            Routes
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => setActiveSegment('nearby')}
          style={[styles.segmentBtn, activeSegment === 'nearby' && styles.segmentBtnActive]}
        >
          <AppText style={[styles.segmentText, activeSegment === 'nearby' && styles.segmentTextActive]}>
            Nearby
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => setActiveSegment('companies')}
          style={[styles.segmentBtn, activeSegment === 'companies' && styles.segmentBtnActive]}
        >
          <AppText style={[styles.segmentText, activeSegment === 'companies' && styles.segmentTextActive]}>
            Fleets
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => setActiveSegment('fares')}
          style={[styles.segmentBtn, activeSegment === 'fares' && styles.segmentBtnActive]}
        >
          <AppText style={[styles.segmentText, activeSegment === 'fares' && styles.segmentTextActive]}>
            Fare Rules
          </AppText>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadTransitData(true)}
            tintColor={Monochrome.textPrimary}
          />
        }
      >
        {/* ROUTES TAB */}
        {activeSegment === 'routes' && (
          <View style={styles.sectionContainer}>
            {(serviceNotices.length > 0 || serviceNoticesError) && (
              <View style={styles.serviceNoticesCard}>
                <AppText style={styles.serviceNoticesHeading}>Current service notices</AppText>
                {serviceNoticesError ? <AppText style={styles.serviceNoticeError}>{serviceNoticesError}</AppText> : null}
                {serviceNotices.map((notice) => (
                  <View key={notice.id} style={styles.serviceNoticeItem}>
                    <View style={styles.serviceNoticeTitleRow}>
                      <AppText style={styles.serviceNoticeTitle}>{notice.title}</AppText>
                      <AppText style={styles.serviceNoticeSeverity}>{notice.severity.toUpperCase()}</AppText>
                    </View>
                    <AppText style={styles.serviceNoticeText}>{notice.message}</AppText>
                    <AppText style={styles.serviceNoticeMeta}>
                      {notice.company?.name || 'Transport operator'}
                      {notice.route?.name ? ` · ${notice.route.name}` : ''}
                      {notice.stop?.name ? ` · ${notice.stop.name}` : ''}
                    </AppText>
                  </View>
                ))}
              </View>
            )}
            <Pressable
              onPress={() => router.push('/passenger/tracking' as any)}
              style={styles.trackingButton}
            >
              <SymbolView
                name={{ ios: 'map.fill', android: 'map', web: 'map' }}
                size={16}
                tintColor={Monochrome.actionPrimaryText}
              />
              <AppText style={styles.trackingButtonText}>Open Live Bus GPS Tracking</AppText>
            </Pressable>

            <View style={styles.plannerCard}>
              <AppText style={styles.plannerTitle}>Plan a journey</AppText>
              <View style={styles.plannerSearchRow}>
                <AppTextInput
                  style={styles.plannerInput}
                  placeholder="Starting stop"
                  placeholderTextColor={Monochrome.textMuted}
                  value={fromStopQuery}
                  onChangeText={(value) => {
                    setFromStopQuery(value);
                    setFromStop(null);
                    setFromStopResults([]);
                  }}
                  accessibilityLabel="Starting stop"
                  returnKeyType="search"
                  onSubmitEditing={() => void searchPlannerStops('from')}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Search starting stops"
                  onPress={() => void searchPlannerStops('from')}
                  style={styles.plannerSearchButton}
                >
                  <AppText style={styles.plannerSearchButtonText}>Search</AppText>
                </Pressable>
              </View>
              {fromStopResults.map((stop) => (
                <Pressable
                  key={stop.id}
                  onPress={() => {
                    setFromStop(stop);
                    setFromStopQuery(stop.name);
                    setFromStopResults([]);
                  }}
                  style={styles.plannerStopOption}
                >
                  <AppText style={styles.plannerStopText}>{stop.name}</AppText>
                </Pressable>
              ))}
              <View style={styles.plannerSearchRow}>
                <AppTextInput
                  style={styles.plannerInput}
                  placeholder="Destination stop"
                  placeholderTextColor={Monochrome.textMuted}
                  value={toStopQuery}
                  onChangeText={(value) => {
                    setToStopQuery(value);
                    setToStop(null);
                    setToStopResults([]);
                  }}
                  accessibilityLabel="Destination stop"
                  returnKeyType="search"
                  onSubmitEditing={() => void searchPlannerStops('to')}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Search destination stops"
                  onPress={() => void searchPlannerStops('to')}
                  style={styles.plannerSearchButton}
                >
                  <AppText style={styles.plannerSearchButtonText}>Search</AppText>
                </Pressable>
              </View>
              {toStopResults.map((stop) => (
                <Pressable
                  key={stop.id}
                  onPress={() => {
                    setToStop(stop);
                    setToStopQuery(stop.name);
                    setToStopResults([]);
                  }}
                  style={styles.plannerStopOption}
                >
                  <AppText style={styles.plannerStopText}>{stop.name}</AppText>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                onPress={() => void planJourney()}
                disabled={plannerLoading}
                style={styles.planButton}
              >
                {plannerLoading
                  ? <ActivityIndicator size="small" color={Monochrome.actionPrimaryText} />
                  : <AppText style={styles.planButtonText}>Find direct routes</AppText>}
              </Pressable>
              {recentSearches.length > 0 ? (
                <View style={styles.recentSearches}>
                  <AppText style={styles.recentSearchesHeading}>Recent searches</AppText>
                  {recentSearches.slice(0, 5).map((search) => (
                    <Pressable
                      key={search.id}
                      accessibilityRole="button"
                      onPress={() => void reopenRecentSearch(search)}
                      style={styles.recentSearchRow}
                    >
                      <AppText style={styles.recentSearchText}>
                        {search.from_stop?.name || 'Unavailable stop'} → {search.to_stop?.name || 'Unavailable stop'}
                      </AppText>
                      <AppText style={styles.recentSearchDate}>{new Date(search.searched_at).toLocaleDateString()}</AppText>
                    </Pressable>
                  ))}
                  {recentSearchError ? <AppText style={styles.plannerHint}>{recentSearchError}</AppText> : null}
                </View>
              ) : recentSearchError ? (
                <AppText style={styles.plannerHint}>{recentSearchError}</AppText>
              ) : null}
              {plannerError && <AppText style={styles.plannerError}>{plannerError}</AppText>}
              {journeyOptions.map((route) => (
                <Pressable
                  key={route.id}
                  onPress={() => handleOpenRouteDetails(route)}
                  style={styles.journeyOption}
                >
                  <AppText style={styles.journeyOptionName}>{route.name} · {route.code}</AppText>
                  <AppText style={styles.journeyOptionMeta}>
                    {route.company_name || 'Public Transit'}
                    {route.estimated_minutes ? ` · about ${route.estimated_minutes} min` : ''}
                  </AppText>
                </Pressable>
              ))}
              {journeyOptions.length === 0 && fromStop && toStop && !plannerLoading && !plannerError && (
                <AppText style={styles.plannerHint}>No direct route was found for the selected stops.</AppText>
              )}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showFavoritesOnly ? 'Show all routes' : `Show saved routes, ${favoriteRouteIds.length} saved`}
              onPress={() => setShowFavoritesOnly((current) => !current)}
              style={styles.favoriteFilter}
            >
              <AppText style={styles.favoriteFilterText}>
                {showFavoritesOnly ? 'Show all routes' : `Saved routes (${favoriteRouteIds.length})`}
              </AppText>
            </Pressable>

            {loading && !refreshing ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={Monochrome.textPrimary} />
                <AppText style={styles.loadingText}>Loading transit routes...</AppText>
              </View>
            ) : filteredRoutes.length > 0 ? (
              filteredRoutes.map((route) => (
                <View key={route.id} style={styles.routeCard}>
                  <View style={styles.routeCardTop}>
                    <Pressable
                      onPress={() => handleOpenRouteDetails(route)}
                      style={styles.routeOpenButton}
                      accessibilityRole="button"
                      accessibilityLabel={`View ${route.name} route details`}
                    >
                      <View style={styles.routeCodeBadge}>
                        <AppText style={styles.routeCodeText}>{route.code}</AppText>
                      </View>
                      <View style={styles.routeTitleGroup}>
                        <AppText style={styles.routeName}>{route.name}</AppText>
                        <AppText style={styles.routeCompany}>{route.company_name || 'Public Transit'}</AppText>
                      </View>
                      <SymbolView
                        name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                        size={14}
                        tintColor={Monochrome.textMuted}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => void toggleRouteFavorite(route.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${favoriteRouteIds.includes(route.id) ? 'Remove' : 'Save'} ${route.name} favorite`}
                      hitSlop={8}
                      style={styles.favoriteButton}
                    >
                      <SymbolView
                        name={{ ios: favoriteRouteIds.includes(route.id) ? 'star.fill' : 'star', android: favoriteRouteIds.includes(route.id) ? 'star' : 'star_outline', web: favoriteRouteIds.includes(route.id) ? 'star' : 'star_outline' }}
                        size={18}
                        tintColor={Monochrome.textPrimary}
                      />
                    </Pressable>
                  </View>

                  <Pressable onPress={() => handleOpenRouteDetails(route)}>
                    <View style={styles.routeMetricsRow}>
                      <View style={styles.metricItem}>
                        <SymbolView
                          name={{ ios: 'mappin.and.ellipse', android: 'place', web: 'place' }}
                          size={14}
                          tintColor={Monochrome.textSecondary}
                        />
                        <AppText style={styles.metricText} numberOfLines={1}>
                          {route.origin_stop && route.destination_stop
                            ? `${route.origin_stop} → ${route.destination_stop}`
                            : 'Public Bus Route'}
                        </AppText>
                      </View>
                      <View style={styles.metricPills}>
                        {route.distance_km ? (
                          <AppText style={styles.pillDistance}>{route.distance_km} km</AppText>
                        ) : null}
                        {route.estimated_minutes ? (
                          <AppText style={styles.pillDuration}>{route.estimated_minutes} min</AppText>
                        ) : null}
                      </View>
                    </View>
                  </Pressable>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <AppText style={styles.emptyText}>No matching routes found</AppText>
              </View>
            )}
          </View>
        )}

        {/* NEARBY TAB */}
        {activeSegment === 'nearby' && (
          <View style={styles.sectionContainer}>
            {favoriteStops.length > 0 && (
              <View style={styles.nearbyGroup}>
                <AppText style={styles.subHeading}>Saved Stops</AppText>
                <View style={styles.cardList}>
                  {favoriteStops.map((stop, index) => (
                    <View key={stop.id} style={[styles.stopRow, index > 0 && styles.rowDivider]}>
                      <View style={styles.stopIconBox}>
                        <SymbolView
                          name={{ ios: 'star.fill', android: 'star', web: 'star' }}
                          size={18}
                          tintColor={Monochrome.textPrimary}
                        />
                      </View>
                      <View style={styles.stopInfo}>
                        <AppText style={styles.stopName}>{stop.name}</AppText>
                        <AppText style={styles.stopCode}>{stop.code || 'Transit Stop'}</AppText>
                      </View>
                      <Pressable
                        onPress={() => void toggleStopFavorite(stop.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${stop.name} from saved stops`}
                        hitSlop={8}
                      >
                        <SymbolView
                          name={{ ios: 'star.slash', android: 'star', web: 'star' }}
                          size={18}
                          tintColor={Monochrome.textSecondary}
                        />
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {!nearbyLocationAvailable && (
              <View style={styles.emptyCard}>
                <SymbolView
                  name={{ ios: 'location.slash', android: 'location_off', web: 'location_off' }}
                  size={32}
                  tintColor={Monochrome.textMuted}
                />
                <AppText style={styles.emptyTitle}>Location Access Needed</AppText>
                <AppText style={styles.emptyText}>
                  Enable device GPS permissions to see live buses and stops closest to your position.
                </AppText>
              </View>
            )}

            {nearbyBuses.length > 0 && (
              <View style={styles.nearbyGroup}>
                <AppText style={styles.subHeading}>Nearby Active Buses</AppText>
                <View style={styles.cardList}>
                  {nearbyBuses.map((bus, idx) => (
                    <View key={bus.bus_id} style={[styles.busRow, idx > 0 && styles.rowDivider]}>
                      <View style={styles.busIconBox}>
                        <SymbolView
                          name={{ ios: 'bus.fill', android: 'directions_bus', web: 'directions_bus' }}
                          size={18}
                          tintColor={Monochrome.textPrimary}
                        />
                      </View>
                      <View style={styles.busInfo}>
                        <AppText style={styles.busNumber}>{bus.bus_number}</AppText>
                        <AppText style={styles.busRouteName}>{bus.route.name || 'Active Line'}</AppText>
                        <AppText style={styles.busCompany}>{bus.company.name || 'Fleet'}</AppText>
                      </View>
                      <View style={styles.busLiveRight}>
                        <View style={styles.liveIndicator}>
                          <View style={[styles.liveDot, bus.status !== 'active' && styles.staleDot]} />
                          <AppText style={[styles.liveText, bus.status !== 'active' && styles.staleText]}>
                            {bus.status === 'active' ? 'Live' : 'Offline'}
                          </AppText>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {nearbyStops.length > 0 && (
              <View style={styles.nearbyGroup}>
                <AppText style={styles.subHeading}>Nearby Bus Stops</AppText>
                <View style={styles.cardList}>
                  {nearbyStops.map((stop, idx) => (
                    <View key={stop.id} style={[styles.stopRow, idx > 0 && styles.rowDivider]}>
                      <View style={styles.stopIconBox}>
                        <SymbolView
                          name={{ ios: 'mappin.circle.fill', android: 'place', web: 'place' }}
                          size={18}
                          tintColor={Monochrome.textPrimary}
                        />
                      </View>
                      <View style={styles.stopInfo}>
                        <AppText style={styles.stopName}>{stop.name}</AppText>
                        <AppText style={styles.stopCode}>{stop.code || 'Transit Stop'}</AppText>
                      </View>
                      {typeof stop.distance_km === 'number' && (
                        <AppText style={styles.stopDistance}>{Math.round(stop.distance_km * 1000)}m away</AppText>
                      )}
                      <Pressable
                        onPress={() => void toggleStopFavorite(stop.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`${favoriteStopIds.includes(stop.id) ? 'Remove' : 'Save'} ${stop.name} favorite`}
                        hitSlop={8}
                      >
                        <SymbolView
                          name={{ ios: favoriteStopIds.includes(stop.id) ? 'star.fill' : 'star', android: favoriteStopIds.includes(stop.id) ? 'star' : 'star_outline', web: favoriteStopIds.includes(stop.id) ? 'star' : 'star_outline' }}
                          size={18}
                          tintColor={Monochrome.textPrimary}
                        />
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {nearbyLocationAvailable && nearbyBuses.length === 0 && nearbyStops.length === 0 && (
              <View style={styles.emptyCard}>
                <AppText style={styles.emptyText}>No active buses or stops within 3km of your location</AppText>
              </View>
            )}
          </View>
        )}

        {/* FLEETS / COMPANIES TAB */}
        {activeSegment === 'companies' && (
          <View style={styles.sectionContainer}>
            {loading && !refreshing ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={Monochrome.textPrimary} />
                <AppText style={styles.loadingText}>Loading fleet operators...</AppText>
              </View>
            ) : filteredCompanies.length > 0 ? (
              filteredCompanies.map((comp) => (
                <View key={comp.id} style={styles.companyCard}>
                  <View style={styles.compHeader}>
                    <View style={styles.compIcon}>
                      <SymbolView
                        name={{ ios: 'building.2.fill', android: 'business', web: 'business' }}
                        size={18}
                        tintColor={Monochrome.textPrimary}
                      />
                    </View>
                    <View style={styles.compInfo}>
                      <AppText style={styles.compName}>{comp.name}</AppText>
                      <AppText style={styles.compCode}>Code: {comp.code}</AppText>
                    </View>
                    <View
                      style={[
                        styles.statusTag,
                        comp.status === 'active' ? styles.statusActive : styles.statusInactive,
                      ]}
                    >
                      <AppText style={styles.statusTagText}>
                        {comp.status === 'active' ? 'Active' : comp.status}
                      </AppText>
                    </View>
                  </View>

                  <View style={styles.compDetails}>
                    {comp.phone ? (
                      <View style={styles.compRow}>
                        <SymbolView
                          name={{ ios: 'phone.fill', android: 'call', web: 'call' }}
                          size={12}
                          tintColor={Monochrome.textMuted}
                        />
                        <AppText style={styles.compDetailText}>{comp.phone}</AppText>
                      </View>
                    ) : null}
                    {comp.email ? (
                      <View style={styles.compRow}>
                        <SymbolView
                          name={{ ios: 'envelope.fill', android: 'mail', web: 'mail' }}
                          size={12}
                          tintColor={Monochrome.textMuted}
                        />
                        <AppText style={styles.compDetailText}>{comp.email}</AppText>
                      </View>
                    ) : null}
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <AppText style={styles.emptyText}>No transport operators found</AppText>
              </View>
            )}
          </View>
        )}

        {/* FARE RULES TAB */}
        {activeSegment === 'fares' && (
          <View style={styles.sectionContainer}>
            {fareRules.length > 0 ? (
              fareRules.map((rule: any) => (
                <View key={rule.id} style={styles.fareCard}>
                  <View style={styles.fareHeader}>
                    <AppText style={styles.fareTitle}>{rule.name || 'Standard Transit Fare'}</AppText>
                    <View style={styles.farePill}>
                      <AppText style={styles.farePillText}>{rule.type || 'Flat / Zone'}</AppText>
                    </View>
                  </View>
                  <AppText style={styles.fareDesc}>
                    {rule.description || 'Applicable to passenger tap-in and tap-out validation.'}
                  </AppText>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <AppText style={styles.emptyText}>Standard government rate cards apply</AppText>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Route Detail Modal */}
      <Modal visible={selectedRoute !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <View>
                <AppText style={styles.modalRouteCode}>{selectedRoute?.code}</AppText>
                <AppText style={styles.modalRouteName}>{selectedRoute?.name}</AppText>
              </View>
              <Pressable onPress={() => setSelectedRoute(null)} hitSlop={8}>
                <SymbolView
                  name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                  size={22}
                  tintColor={Monochrome.textMuted}
                />
              </Pressable>
            </View>

            <AppText style={styles.stopsHeading}>Scheduled departures · next 24 hours</AppText>
            {loadingDepartures ? (
              <View style={styles.departureLoading}>
                <ActivityIndicator size="small" color={Monochrome.textPrimary} />
                <AppText style={styles.loadingText}>Checking published trip schedules...</AppText>
              </View>
            ) : departureError ? (
              <AppText style={styles.departureError}>{departureError}</AppText>
            ) : routeDepartures.length > 0 ? (
              <View style={styles.departureList}>
                {routeDepartures.slice(0, 5).map((departure) => (
                  <View key={departure.trip_id} style={styles.departureRow}>
                    <AppText style={styles.departureTime}>
                      {new Date(departure.scheduled_departure).toLocaleString()}
                    </AppText>
                    <AppText style={styles.departureMeta}>
                      {departure.company_name || 'Transport operator'}
                      {departure.bus_number ? ` · Bus ${departure.bus_number}` : ''}
                    </AppText>
                  </View>
                ))}
              </View>
            ) : (
              <AppText style={styles.departureEmpty}>No scheduled departures are published for this route in the next 24 hours.</AppText>
            )}

            <AppText style={styles.stopsHeading}>Bus Stops Along This Route</AppText>

            {loadingStops ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={Monochrome.textPrimary} />
                <AppText style={styles.loadingText}>Fetching route stops...</AppText>
              </View>
            ) : routeStops.length > 0 ? (
              <ScrollView style={styles.stopsList} showsVerticalScrollIndicator={false}>
                {routeStops.map((stop, index) => {
                  const isFirst = index === 0;
                  const isLast = index === routeStops.length - 1;

                  return (
                    <View key={stop.id} style={styles.stopTimelineItem}>
                      <View style={styles.timelineLeft}>
                        <View
                          style={[
                            styles.timelineDot,
                            isFirst && styles.dotStart,
                            isLast && styles.dotEnd,
                          ]}
                        />
                        {!isLast && <View style={styles.timelineLine} />}
                      </View>
                      <View style={styles.timelineContent}>
                        <AppText style={styles.timelineStopName}>{stop.name}</AppText>
                        <AppText style={styles.timelineSequence}>Stop #{stop.sequence}</AppText>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.emptyCard}>
                <AppText style={styles.emptyText}>No stops registered for this route</AppText>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Monochrome.background,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    backgroundColor: Monochrome.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: Monochrome.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Monochrome.textPrimary,
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Monochrome.surfaceSecondary,
    marginHorizontal: Spacing.four,
    marginVertical: Spacing.two,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    height: 44,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Monochrome.textPrimary,
  },
  segmentBar: {
    flexDirection: 'row',
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 12,
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.two,
    padding: 3,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 9,
  },
  segmentBtnActive: {
    backgroundColor: Monochrome.surfaceElevated,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '500',
    color: Monochrome.textMuted,
  },
  segmentTextActive: {
    color: Monochrome.textPrimary,
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
    fontSize: 14,
    fontWeight: '700',
    color: Monochrome.textPrimary,
    marginBottom: 6,
  },
  trackingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Monochrome.actionPrimary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: Spacing.three,
    gap: 8,
  },
  trackingButtonText: {
    color: Monochrome.actionPrimaryText,
    fontSize: 14,
    fontWeight: '700',
  },
  serviceNoticesCard: {
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Monochrome.border,
    backgroundColor: Monochrome.surfaceSecondary,
    gap: Spacing.two,
  },
  serviceNoticesHeading: {
    color: Monochrome.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  serviceNoticeItem: {
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: Monochrome.border,
    gap: 4,
  },
  serviceNoticeTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  serviceNoticeTitle: {
    flex: 1,
    color: Monochrome.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  serviceNoticeSeverity: {
    color: Monochrome.textSecondary,
    fontSize: 9,
    fontWeight: '700',
  },
  serviceNoticeText: {
    color: Monochrome.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  serviceNoticeMeta: {
    color: Monochrome.textMuted,
    fontSize: 10,
  },
  serviceNoticeError: {
    color: Monochrome.textSecondary,
    fontSize: 11,
  },
  plannerCard: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 16,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: Monochrome.border,
    gap: Spacing.two,
  },
  plannerTitle: {
    color: Monochrome.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  plannerSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  plannerInput: {
    flex: 1,
    minHeight: 42,
    paddingHorizontal: Spacing.three,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Monochrome.border,
    color: Monochrome.textPrimary,
    backgroundColor: Monochrome.background,
  },
  plannerSearchButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: Monochrome.surfaceElevated,
  },
  plannerSearchButtonText: {
    color: Monochrome.textPrimary,
    fontWeight: '700',
    fontSize: 12,
  },
  plannerStopOption: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 8,
    backgroundColor: Monochrome.surfaceElevated,
  },
  plannerStopText: {
    color: Monochrome.textPrimary,
    fontSize: 13,
  },
  planButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: Monochrome.actionPrimary,
  },
  planButtonText: {
    color: Monochrome.actionPrimaryText,
    fontSize: 13,
    fontWeight: '700',
  },
  plannerError: {
    color: Monochrome.textPrimary,
    fontSize: 12,
  },
  plannerHint: {
    color: Monochrome.textMuted,
    fontSize: 12,
  },
  recentSearches: {
    gap: 6,
    paddingTop: Spacing.two,
  },
  recentSearchesHeading: {
    color: Monochrome.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  recentSearchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderRadius: 8,
    backgroundColor: Monochrome.surfaceElevated,
  },
  recentSearchText: {
    flex: 1,
    color: Monochrome.textPrimary,
    fontSize: 11,
  },
  recentSearchDate: {
    color: Monochrome.textMuted,
    fontSize: 10,
  },
  journeyOption: {
    padding: Spacing.three,
    borderRadius: 10,
    backgroundColor: Monochrome.surfaceElevated,
    gap: 4,
  },
  journeyOptionName: {
    color: Monochrome.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  journeyOptionMeta: {
    color: Monochrome.textMuted,
    fontSize: 11,
  },
  favoriteFilter: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignSelf: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Monochrome.border,
    backgroundColor: Monochrome.surfaceSecondary,
  },
  favoriteFilterText: {
    color: Monochrome.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  loadingBox: {
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.two,
  },
  loadingText: {
    fontSize: 13,
    color: Monochrome.textSecondary,
  },
  routeCard: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 16,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: Monochrome.border,
    gap: Spacing.three,
  },
  routeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  routeOpenButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  favoriteButton: {
    padding: 4,
  },
  routeCodeBadge: {
    backgroundColor: Monochrome.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  routeCodeText: {
    fontSize: 13,
    fontWeight: '700',
    color: Monochrome.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  routeTitleGroup: {
    flex: 1,
  },
  routeName: {
    fontSize: 15,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  routeCompany: {
    fontSize: 12,
    color: Monochrome.textMuted,
    marginTop: 2,
  },
  routeMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: Monochrome.surfaceElevated,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  metricText: {
    fontSize: 12,
    color: Monochrome.textSecondary,
  },
  metricPills: {
    flexDirection: 'row',
    gap: 6,
  },
  pillDistance: {
    fontSize: 11,
    color: Monochrome.textSecondary,
    backgroundColor: Monochrome.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    fontWeight: '600',
  },
  pillDuration: {
    fontSize: 11,
    color: Monochrome.textSecondary,
    backgroundColor: Monochrome.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    fontWeight: '600',
  },
  nearbyGroup: {
    gap: Spacing.two,
  },
  cardList: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 16,
    paddingHorizontal: Spacing.four,
    borderWidth: 1,
    borderColor: Monochrome.border,
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
    borderTopColor: Monochrome.surfaceElevated,
  },
  busIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busInfo: {
    flex: 1,
  },
  busNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  busRouteName: {
    fontSize: 12,
    color: Monochrome.textSecondary,
    marginTop: 2,
  },
  busCompany: {
    fontSize: 11,
    color: Monochrome.textMuted,
    marginTop: 1,
  },
  busLiveRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  speedText: {
    fontSize: 12,
    fontWeight: '700',
    color: Monochrome.textPrimary,
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
    backgroundColor: Monochrome.textPrimary,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  staleDot: {
    backgroundColor: Monochrome.textMuted,
  },
  staleText: {
    color: Monochrome.textMuted,
  },
  stopIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopInfo: {
    flex: 1,
  },
  stopName: {
    fontSize: 14,
    fontWeight: '600',
    color: Monochrome.textPrimary,
  },
  stopCode: {
    fontSize: 11,
    color: Monochrome.textMuted,
    marginTop: 2,
  },
  stopDistance: {
    fontSize: 12,
    fontWeight: '600',
    color: Monochrome.textSecondary,
  },
  companyCard: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 16,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: Monochrome.border,
    gap: Spacing.two,
  },
  compHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  compIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compInfo: {
    flex: 1,
  },
  compName: {
    fontSize: 15,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  compCode: {
    fontSize: 12,
    color: Monochrome.textMuted,
    marginTop: 2,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  statusActive: {
    backgroundColor: Monochrome.surfaceElevated,
  },
  statusInactive: {
    backgroundColor: Monochrome.surfaceSecondary,
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: Monochrome.textPrimary,
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
    color: Monochrome.textSecondary,
  },
  fareCard: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 14,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: Monochrome.border,
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
    color: Monochrome.textPrimary,
  },
  farePill: {
    backgroundColor: Monochrome.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  farePillText: {
    fontSize: 10,
    color: Monochrome.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  fareDesc: {
    fontSize: 13,
    color: Monochrome.textSecondary,
  },
  emptyCard: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 16,
    padding: Spacing.five,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Monochrome.border,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  emptyText: {
    fontSize: 13,
    color: Monochrome.textMuted,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Monochrome.surfacePrimary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: Monochrome.border,
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
    fontSize: 12,
    fontWeight: '700',
    color: Monochrome.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modalRouteName: {
    fontSize: 18,
    fontWeight: '800',
    color: Monochrome.textPrimary,
    marginTop: 2,
  },
  stopsHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: Monochrome.textSecondary,
    marginBottom: Spacing.two,
  },
  departureLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  departureList: {
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  departureRow: {
    padding: Spacing.two,
    borderRadius: 8,
    backgroundColor: Monochrome.surfaceSecondary,
  },
  departureTime: {
    color: Monochrome.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  departureMeta: {
    marginTop: 2,
    color: Monochrome.textMuted,
    fontSize: 11,
  },
  departureEmpty: {
    marginBottom: Spacing.three,
    color: Monochrome.textMuted,
    fontSize: 12,
  },
  departureError: {
    marginBottom: Spacing.three,
    color: Monochrome.textSecondary,
    fontSize: 12,
  },
  stopsList: {
    marginTop: Spacing.two,
  },
  stopTimelineItem: {
    flexDirection: 'row',
    minHeight: 48,
  },
  timelineLeft: {
    width: 24,
    alignItems: 'center',
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Monochrome.textPrimary,
    marginTop: 4,
  },
  dotStart: {
    backgroundColor: Monochrome.textPrimary,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotEnd: {
    backgroundColor: Monochrome.textSecondary,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timelineLine: {
    width: 1.5,
    flex: 1,
    backgroundColor: Monochrome.border,
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
    color: Monochrome.textPrimary,
  },
  timelineSequence: {
    fontSize: 11,
    color: Monochrome.textMuted,
    marginTop: 1,
  },
});
