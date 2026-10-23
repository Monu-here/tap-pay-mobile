import {AppText, AppTextInput } from '@/components/typography/app-text';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, type Region } from 'react-native-maps';

import { Brand, Spacing } from '@/constants/theme';
import {
  getRouteStops,
  getRoutes,
  type RouteInfo,
  type StopInfo,
} from '@/features/passenger/services/passengerApi';
import {
  getNearbyBuses,
  getNearbyStops,
  searchStops,
  type PublicNearbyBus,
  type PublicStop,
} from '@/features/transit/services/transitApi';

type Coordinates = { latitude: number; longitude: number };

const STALE_AFTER_MS = 120_000;
const REFRESH_INTERVAL_MS = 20_000;

export default function LiveBusTrackingScreen() {
  const insets = useSafeAreaInsets();
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [buses, setBuses] = useState<PublicNearbyBus[]>([]);
  const [stops, setStops] = useState<PublicStop[]>([]);
  const [searchedStops, setSearchedStops] = useState<PublicStop[]>([]);
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [routeStops, setRouteStops] = useState<StopInfo[]>([]);
  const [selectedBus, setSelectedBus] = useState<PublicNearbyBus | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const routeRequest = useRef(0);

  const loadNearby = useCallback(async (coords: Coordinates) => {
    setRefreshing(true);
    setError(null);
    try {
      const [busResult, stopResult] = await Promise.all([
        getNearbyBuses(coords.latitude, coords.longitude, 10),
        getNearbyStops(coords.latitude, coords.longitude, 5),
      ]);

      if (busResult.ok && busResult.data) {
        setBuses(busResult.data.buses);
        setLastUpdated(new Date());
      } else {
        setError(busResult.message || 'Live bus locations could not be retrieved.');
      }

      if (stopResult.ok && stopResult.data) {
        setStops(stopResult.data.stops);
      } else if (!busResult.ok) {
        setError(stopResult.message || busResult.message || 'Nearby transit could not be retrieved.');
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to connect to live transit services.');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  const requestLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      setPermissionGranted(permission.granted);
      if (!permission.granted) {
        setError('Location permission is required to find nearby live buses. You can still browse routes without sharing your location.');
        setLoading(false);
        return;
      }

      if (!(await Location.hasServicesEnabledAsync())) {
        setError('Location services are turned off. Enable GPS and retry to find nearby buses.');
        setLoading(false);
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
      setLocation(coords);
      await loadNearby(coords);
    } catch (locationError) {
      setError(locationError instanceof Error ? locationError.message : 'Unable to read your current location.');
      setLoading(false);
    }
  }, [loadNearby]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!active) return;
        setPermissionGranted(permission.granted);
        if (!permission.granted) {
          setLoading(false);
          return;
        }
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!active) return;
        const coords = {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        };
        setLocation(coords);
        await loadNearby(coords);
      } catch (locationError) {
        if (active) {
          setError(locationError instanceof Error ? locationError.message : 'Unable to read your current location.');
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [loadNearby]);

  useEffect(() => {
    let active = true;
    void getRoutes().then((result) => {
      if (!active) return;
      if (result.ok && result.data) setRoutes(result.data.routes);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const query = search.trim();
    if (!query) return;
    let active = true;
    const timer = setTimeout(() => {
      void searchStops(query).then((result) => {
        if (!active) return;
        if (result.ok && result.data) {
          setSearchedStops(result.data.stops);
          setSearchError(null);
        } else {
          setSearchError(result.message || 'Stop search is currently unavailable.');
        }
      }).catch((searchFailure) => {
        if (active) {
          setSearchError(searchFailure instanceof Error ? searchFailure.message : 'Stop search is currently unavailable.');
        }
      });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search]);

  useEffect(() => {
    if (!location) return;
    const timer = setInterval(() => {
      void loadNearby(location);
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [loadNearby, location]);

  const loadSelectedRouteStops = useCallback(async (routeId: number, requestId: number) => {
    try {
      const result = await getRouteStops(routeId);
      if (routeRequest.current !== requestId) return;
      if (result.ok && result.data) {
        setRouteStops(result.data.stops);
      } else {
        setRouteError(result.message || 'Route stops are unavailable.');
      }
    } catch (routeLoadError) {
      if (routeRequest.current === requestId) {
        setRouteError(routeLoadError instanceof Error ? routeLoadError.message : 'Route stops are unavailable.');
      }
    }
  }, []);

  const selectBus = useCallback(async (bus: PublicNearbyBus) => {
    const requestId = ++routeRequest.current;
    setSelectedBus(bus);
    setSelectedRouteId(bus.route.id);
    setRouteStops([]);
    setRouteError(null);
    if (!bus.route.id) return;
    await loadSelectedRouteStops(bus.route.id, requestId);
  }, [loadSelectedRouteStops]);

  const selectRoute = useCallback(async (route: RouteInfo) => {
    const requestId = ++routeRequest.current;
    setSelectedBus(null);
    setSelectedRouteId(route.id);
    setRouteStops([]);
    setRouteError(null);
    await loadSelectedRouteStops(route.id, requestId);
  }, [loadSelectedRouteStops]);

  const clearSelectedBus = () => {
    routeRequest.current += 1;
    setSelectedBus(null);
    setSelectedRouteId(null);
    setRouteStops([]);
    setRouteError(null);
  };

  const query = search.trim().toLocaleLowerCase();
  const selectedRoute = routes.find((route) => route.id === selectedRouteId) ?? null;
  const visibleBuses = useMemo(
    () => buses.filter((bus) =>
      (!selectedRouteId || bus.route.id === selectedRouteId)
      && `${bus.bus_number} ${bus.route.name ?? ''} ${bus.company.name ?? ''}`.toLocaleLowerCase().includes(query),
    ),
    [buses, query, selectedRouteId],
  );
  const visibleStops = useMemo(
    () => query ? searchedStops : stops,
    [query, searchedStops, stops],
  );
  const visibleRoutes = useMemo(
    () => routes.filter((route) => `${route.code} ${route.name} ${route.company_name ?? ''}`.toLocaleLowerCase().includes(query)),
    [routes, query],
  );
  const routeCoordinates = routeStops
    .filter((stop): stop is StopInfo & { latitude: number; longitude: number } =>
      stop.latitude !== null && stop.longitude !== null,
    )
    .map((stop) => ({ latitude: stop.latitude, longitude: stop.longitude }));
  const stopCenter = visibleStops.find((stop) =>
    Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude),
  );
  const mapCenter = selectedRouteId && routeCoordinates.length
    ? routeCoordinates[0]
    : location ?? (stopCenter
      ? { latitude: stopCenter.latitude, longitude: stopCenter.longitude }
      : undefined);
  const initialRegion: Region | undefined = mapCenter
    ? {
        ...mapCenter,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      }
    : undefined;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button">
          <AppText style={styles.backButtonText}>Back</AppText>
        </Pressable>
        <AppText style={styles.title}>Live Bus Tracking</AppText>
        <Pressable
          onPress={() => location ? void loadNearby(location) : void requestLocation()}
          style={styles.refreshButton}
          accessibilityRole="button"
        >
          <AppText style={styles.refreshButtonText}>{refreshing ? 'Updating' : 'Refresh'}</AppText>
        </Pressable>
      </View>

      <AppTextInput
        value={search}
        onChangeText={(value) => {
          setSearch(value);
          setSearchError(null);
          if (!value.trim()) setSearchedStops([]);
        }}
        placeholder="Search bus, route, company, or stop"
        placeholderTextColor={Brand.textSecondary}
        style={styles.search}
        accessibilityLabel="Search live buses and nearby stops"
      />

      {loading && !location ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Brand.teal.primary} />
          <AppText style={styles.secondary}>Finding your location…</AppText>
        </View>
      ) : (
        <>
          {!permissionGranted || error ? (
            <View style={styles.locationNotice}>
              <AppText style={styles.message}>
                {error || 'Allow location access to find nearby live buses. You can still search routes and stops without location access.'}
              </AppText>
              <Pressable onPress={() => void requestLocation()} style={styles.primaryButton}>
                <AppText style={styles.primaryButtonText}>{permissionGranted ? 'Retry Nearby Tracking' : 'Enable Nearby Tracking'}</AppText>
              </Pressable>
              {permissionGranted ? (
                <Pressable onPress={() => void Linking.openSettings()} style={styles.settingsButton}>
                  <AppText style={styles.secondary}>Open location settings</AppText>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {Platform.OS === 'web' ? (
            <View style={styles.webNotice}>
              <AppText style={styles.secondary}>Interactive maps are available in the iOS and Android app.</AppText>
            </View>
          ) : initialRegion ? (
            <MapView
              key={`${initialRegion.latitude.toFixed(4)}:${initialRegion.longitude.toFixed(4)}`}
              style={styles.map}
              initialRegion={initialRegion}
              showsUserLocation={permissionGranted && Boolean(location)}
              showsCompass
              showsScale
            >
              {visibleBuses.map((bus) => (
                <Marker
                  key={bus.bus_id}
                  coordinate={{ latitude: bus.latitude, longitude: bus.longitude }}
                  title={`Bus ${bus.bus_number}`}
                  description={`${bus.route.name || 'Route unavailable'} · ${freshnessLabel(bus.last_seen_at)}`}
                  pinColor={isStale(bus.last_seen_at) ? Brand.textMuted : Brand.white}
                  onPress={() => void selectBus(bus)}
                />
              ))}
              {visibleStops.map((stop) => (
                <Marker
                  key={`stop-${stop.id}`}
                  coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
                  title={stop.name}
                  description={`Stop ${stop.code}`}
                  pinColor={Brand.textSecondary}
                />
              ))}
              {routeCoordinates.length > 1 ? (
                <Polyline coordinates={routeCoordinates} strokeColor={Brand.teal.primary} strokeWidth={4} />
              ) : null}
            </MapView>
          ) : (
            <View style={styles.webNotice}>
              <AppText style={styles.secondary}>Choose a route or enable location to center the map.</AppText>
            </View>
          )}

          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <AppText style={styles.panelTitle}>
                {selectedBus
                  ? `Bus ${selectedBus.bus_number}`
                  : selectedRoute
                    ? selectedRoute.name
                    : `${visibleBuses.length} nearby buses`}
              </AppText>
              <AppText style={styles.secondary}>
                {lastUpdated ? `Checked ${lastUpdated.toLocaleTimeString()}` : 'Waiting for location data'}
              </AppText>
            </View>
            {selectedBus || selectedRoute ? (
              <View style={styles.selectedBus}>
                <AppText style={styles.message}>
                  {selectedBus
                    ? `${selectedBus.company.name || 'Transport operator'} · ${selectedBus.route.name || 'Route unavailable'}`
                    : `${selectedRoute?.code ?? ''} · ${selectedRoute?.name ?? 'Route'}`}
                </AppText>
                {selectedBus ? (
                  <>
                    <AppText style={isStale(selectedBus.last_seen_at) ? styles.stale : styles.fresh}>
                      {freshnessLabel(selectedBus.last_seen_at)}
                    </AppText>
                    {selectedBus.status ? <AppText style={styles.secondary}>Status: {selectedBus.status}</AppText> : null}
                  </>
                ) : null}
                {selectedBus?.route.destination ? (
                  <AppText style={styles.secondary}>Destination: {selectedBus.route.destination}</AppText>
                ) : null}
                {!selectedBus && selectedRoute?.destination_stop ? (
                  <AppText style={styles.secondary}>Destination: {selectedRoute.destination_stop}</AppText>
                ) : null}
                {routeError ? <AppText style={styles.stale}>{routeError}</AppText> : null}
                {routeStops.map((stop) => (
                  <AppText key={stop.id} style={styles.stopLine}>
                    {stop.sequence}. {stop.name}
                  </AppText>
                ))}
                <Pressable onPress={clearSelectedBus}>
                  <AppText style={styles.clearSelection}>Clear selection</AppText>
                </Pressable>
              </View>
            ) : (
              <ScrollView
                style={styles.busList}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => location && void loadNearby(location)} />}
              >
                {query ? visibleRoutes.map((route) => (
                  <Pressable
                    key={`route-${route.id}`}
                    onPress={() => void selectRoute(route)}
                    style={styles.busRow}
                  >
                    <View style={styles.busRowText}>
                      <AppText style={styles.message}>{route.code} · {route.name}</AppText>
                      <AppText style={styles.secondary}>{route.company_name || 'Transport route'}</AppText>
                    </View>
                    <AppText style={styles.fresh}>Route</AppText>
                  </Pressable>
                )) : null}
                {searchError ? <AppText style={styles.stale}>{searchError}</AppText> : null}
                {query && visibleStops.length ? (
                  <AppText style={styles.secondary}>{visibleStops.length} matching stops are shown on the map.</AppText>
                ) : null}
                {visibleBuses.map((bus) => (
                  <Pressable
                    key={bus.bus_id}
                    onPress={() => void selectBus(bus)}
                    style={styles.busRow}
                  >
                    <View style={styles.busRowText}>
                      <AppText style={styles.message}>Bus {bus.bus_number} · {bus.route.name || 'Route unavailable'}</AppText>
                      <AppText style={styles.secondary}>{bus.company.name || 'Operator unavailable'}</AppText>
                    </View>
                    <AppText style={isStale(bus.last_seen_at) ? styles.stale : styles.fresh}>
                      {freshnessLabel(bus.last_seen_at)}
                    </AppText>
                  </Pressable>
                ))}
                {!visibleRoutes.length && !visibleBuses.length ? (
                  <AppText style={styles.secondary}>No buses or routes match this search.</AppText>
                ) : null}
              </ScrollView>
            )}
            {!selectedBus && !selectedRoute && visibleBuses.length === 0 && visibleRoutes.length === 0 ? (
              <AppText style={styles.secondary}>
                {permissionGranted
                  ? 'No active buses are reporting a recent location in this area. No bus movement is simulated.'
                  : 'Enable location to retrieve nearby active buses.'}
              </AppText>
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}

function isStale(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return true;
  const timestamp = Date.parse(lastSeenAt);
  return Number.isNaN(timestamp) || Date.now() - timestamp > STALE_AFTER_MS;
}

function freshnessLabel(lastSeenAt: string | null): string {
  if (isStale(lastSeenAt)) return 'Location stale / offline';
  const elapsed = Math.max(0, Math.floor((Date.now() - Date.parse(lastSeenAt!)) / 1000));
  return `Updated ${elapsed}s ago`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Brand.background,
  },
  header: {
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 12,
  },
  backButtonText: {
    color: Brand.text,
    fontWeight: '700',
  },
  title: {
    color: Brand.text,
    fontSize: 18,
    fontWeight: '800',
  },
  refreshButton: {
    padding: 8,
  },
  refreshButtonText: {
    color: Brand.text,
    fontWeight: '700',
  },
  search: {
    backgroundColor: Brand.surfaceSecondary,
    borderRadius: 12,
    borderColor: Brand.border,
    borderWidth: 1,
    color: Brand.text,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 11,
  },
  map: {
    flex: 1,
    minHeight: 260,
  },
  webNotice: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  panel: {
    maxHeight: '43%',
    backgroundColor: Brand.surfacePrimary,
    borderTopColor: Brand.border,
    borderTopWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  panelHeader: {
    gap: 4,
    marginBottom: Spacing.two,
  },
  panelTitle: {
    color: Brand.text,
    fontSize: 16,
    fontWeight: '800',
  },
  busList: {
    flexGrow: 0,
  },
  busRow: {
    borderTopColor: Brand.border,
    borderTopWidth: 1,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  busRowText: {
    flex: 1,
    gap: 3,
  },
  selectedBus: {
    gap: 6,
  },
  stopLine: {
    color: Brand.textSecondary,
    fontSize: 12,
  },
  secondary: {
    color: Brand.textSecondary,
    fontSize: 12,
  },
  message: {
    color: Brand.text,
    fontSize: 14,
    fontWeight: '600',
  },
  fresh: {
    color: Brand.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  stale: {
    color: Brand.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  clearSelection: {
    color: Brand.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.five,
    gap: Spacing.three,
  },
  locationNotice: {
    backgroundColor: Brand.surfaceElevated,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  primaryButton: {
    backgroundColor: Brand.teal.primary,
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: Brand.primaryText,
    fontWeight: '700',
  },
  settingsButton: {
    padding: Spacing.two,
  },
});
