import { AppText, AppTextInput } from '@/components/typography/app-text';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Monochrome, Spacing } from '@/constants/theme';
import {
  getJourneyOptions,
  getRecentJourneySearches,
  getRouteDepartures,
  getRouteStops,
  saveRecentJourneySearch,
  type RecentJourneySearch,
  type RouteDeparture,
  type RouteInfo,
  type StopInfo,
} from '@/features/passenger/services/passengerApi';
import { getNearbyStops, searchStops, type PublicStop } from '@/features/transit/services/transitApi';

export function JourneyPlanner() {
  const insets = useSafeAreaInsets();
  const [fromQuery, setFromQuery] = useState('');
  const [toQuery, setToQuery] = useState('');
  const [fromStop, setFromStop] = useState<PublicStop | null>(null);
  const [toStop, setToStop] = useState<PublicStop | null>(null);
  const [fromResults, setFromResults] = useState<PublicStop[]>([]);
  const [toResults, setToResults] = useState<PublicStop[]>([]);
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentJourneySearch[]>([]);
  const [busySearch, setBusySearch] = useState<'from' | 'to' | 'plan' | 'location' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteInfo | null>(null);
  const [routeStops, setRouteStops] = useState<StopInfo[]>([]);
  const [departures, setDepartures] = useState<RouteDeparture[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadRecentSearches = useCallback(async () => {
    try {
      const result = await getRecentJourneySearches();
      if (result.ok && result.data) setRecentSearches(result.data.searches);
    } catch {
      setError('Recent searches could not be loaded.');
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void loadRecentSearches());
    return () => cancelAnimationFrame(frame);
  }, [loadRecentSearches]);

  const findStops = async (direction: 'from' | 'to') => {
    const query = direction === 'from' ? fromQuery.trim() : toQuery.trim();
    if (query.length < 2) {
      setError('Enter at least two characters to search for a stop.');
      return;
    }
    setError(null);
    setBusySearch(direction);
    try {
      const result = await searchStops(query);
      if (!result.ok || !result.data) {
        setError(result.message || 'Could not search bus stops.');
        return;
      }
      if (direction === 'from') setFromResults(result.data.stops);
      else setToResults(result.data.stops);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Stop search is unavailable.');
    } finally {
      setBusySearch(null);
    }
  };

  const chooseStop = (stop: PublicStop, direction: 'from' | 'to') => {
    if (direction === 'from') {
      setFromStop(stop);
      setFromQuery(stop.name);
      setFromResults([]);
    } else {
      setToStop(stop);
      setToQuery(stop.name);
      setToResults([]);
    }
    setError(null);
  };

  const handleCurrentLocation = async () => {
    setError(null);
    setBusySearch('location');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError(permission.canAskAgain
          ? 'Allow location access to find a nearby starting stop.'
          : 'Location access is disabled. Enable it in device settings to use your current location.');
        return;
      }
      if (!(await Location.hasServicesEnabledAsync())) {
        setError('Turn on device location services to find a nearby starting stop.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const result = await getNearbyStops(
        position.coords.latitude,
        position.coords.longitude,
        3000,
      );
      if (!result.ok || !result.data) {
        setError(result.message || 'Nearby bus stops could not be loaded.');
        return;
      }
      if (result.data.stops.length === 0) {
        setError('No bus stops were found near your current location. Search for a starting stop instead.');
        return;
      }

      const distanceToStop = (stop: PublicStop) => {
        if (typeof stop.distance_km === 'number') return stop.distance_km;
        const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
        const latitudeDelta = toRadians(stop.latitude - position.coords.latitude);
        const longitudeDelta = toRadians(stop.longitude - position.coords.longitude);
        const a = Math.sin(latitudeDelta / 2) ** 2
          + Math.cos(toRadians(position.coords.latitude))
          * Math.cos(toRadians(stop.latitude))
          * Math.sin(longitudeDelta / 2) ** 2;
        return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      };
      const nearestStop = [...result.data.stops].sort(
        (first, second) => distanceToStop(first) - distanceToStop(second),
      )[0];
      chooseStop(nearestStop, 'from');
    } catch (locationError) {
      setError(locationError instanceof Error
        ? locationError.message
        : 'Could not determine your current location.');
    } finally {
      setBusySearch(null);
    }
  };

  const planJourney = async (origin = fromStop, destination = toStop) => {
    if (!origin || !destination) {
      setError('Choose both a starting stop and a destination.');
      return;
    }
    if (origin.id === destination.id) {
      setError('Choose different starting and destination stops.');
      return;
    }
    setError(null);
    setRoutes([]);
    setBusySearch('plan');
    try {
      const result = await getJourneyOptions(origin.id, destination.id);
      if (!result.ok || !result.data) {
        setError(result.message || 'Could not find routes for these stops.');
        return;
      }
      setRoutes(result.data.routes);
      const saved = await saveRecentJourneySearch(origin.id, destination.id);
      if (saved.ok) await loadRecentSearches();
    } catch (planError) {
      setError(planError instanceof Error ? planError.message : 'Journey planning is unavailable.');
    } finally {
      setBusySearch(null);
    }
  };

  const reopenSearch = async (search: RecentJourneySearch) => {
    if (!search.from_stop || !search.to_stop) {
      setError('One of the stops in this search is no longer available.');
      return;
    }
    setError(null);
    setBusySearch('plan');
    try {
      const [fromResult, toResult] = await Promise.all([
        searchStops(search.from_stop.name),
        searchStops(search.to_stop.name),
      ]);
      if (!fromResult.ok || !fromResult.data || !toResult.ok || !toResult.data) {
        setError((!fromResult.ok && fromResult.message) || (!toResult.ok && toResult.message) || 'Could not reload this saved search.');
        return;
      }
      const origin = fromResult.data.stops.find((stop) => stop.id === search.from_stop?.id);
      const destination = toResult.data.stops.find((stop) => stop.id === search.to_stop?.id);
      if (!origin || !destination) {
        setError('A stop in this recent search is no longer available.');
        return;
      }
      setFromStop(origin);
      setFromQuery(origin.name);
      setToStop(destination);
      setToQuery(destination.name);
      await planJourney(origin, destination);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Could not reopen this search.');
    } finally {
      setBusySearch(null);
    }
  };

  const openRoute = async (route: RouteInfo) => {
    setSelectedRoute(route);
    setRouteStops([]);
    setDepartures([]);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const [stopsResult, departuresResult] = await Promise.all([
        getRouteStops(route.id),
        getRouteDepartures(route.id),
      ]);
      if (stopsResult.ok && stopsResult.data) setRouteStops(stopsResult.data.stops);
      else setDetailError(stopsResult.message || 'Route stops could not be loaded.');
      if (departuresResult.ok && departuresResult.data) setDepartures(departuresResult.data.departures);
      else setDetailError(departuresResult.message || 'Scheduled departures could not be loaded.');
    } catch (loadError) {
      setDetailError(loadError instanceof Error ? loadError.message : 'Route details could not be loaded.');
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <>
      <View style={styles.card}>
        <View style={styles.headingRow}>
          <View style={styles.iconBox}>
            <SymbolView name={{ ios: 'point.topleft.down.curvedto.point.bottomright.up', android: 'alt_route', web: 'alt_route' }} size={19} tintColor={Monochrome.textPrimary} />
          </View>
          <View>
            <AppText style={styles.title}>Plan a Journey</AppText>
            <AppText style={styles.subtitle}>Find routes between two bus stops</AppText>
          </View>
        </View>

        <StopPicker
          label="Starting stop"
          query={fromQuery}
          results={fromResults}
          loading={busySearch === 'from'}
          onQueryChange={(value) => {
            setFromQuery(value);
            setFromStop(null);
            setFromResults([]);
          }}
          onSearch={() => void findStops('from')}
          onSelect={(stop) => chooseStop(stop, 'from')}
        />
        <Pressable
          accessibilityRole="button"
          disabled={busySearch !== null}
          onPress={() => void handleCurrentLocation()}
          style={[styles.locationButton, busySearch !== null && styles.disabled]}
        >
          {busySearch === 'location'
            ? <ActivityIndicator size="small" color={Monochrome.textPrimary} />
            : <SymbolView name={{ ios: 'location.fill', android: 'my_location', web: 'my_location' }} size={15} tintColor={Monochrome.textPrimary} />}
          <AppText style={styles.locationButtonText}>
            {busySearch === 'location' ? 'Finding nearby stop…' : 'Use current location'}
          </AppText>
        </Pressable>
        <StopPicker
          label="Destination stop"
          query={toQuery}
          results={toResults}
          loading={busySearch === 'to'}
          onQueryChange={(value) => {
            setToQuery(value);
            setToStop(null);
            setToResults([]);
          }}
          onSearch={() => void findStops('to')}
          onSelect={(stop) => chooseStop(stop, 'to')}
        />

        <Pressable
          accessibilityRole="button"
          disabled={busySearch !== null}
          onPress={() => void planJourney()}
          style={[styles.planButton, busySearch !== null && styles.disabled]}
        >
          {busySearch === 'plan'
            ? <ActivityIndicator size="small" color={Monochrome.actionPrimaryText} />
            : <AppText style={styles.planButtonText}>Find Routes</AppText>}
        </Pressable>

        {error ? <AppText style={styles.error}>{error}</AppText> : null}

        {recentSearches.length > 0 ? (
          <View style={styles.recentSection}>
            <AppText style={styles.recentHeading}>Recent journeys</AppText>
            {recentSearches.slice(0, 3).map((search) => (
              <Pressable
                key={search.id}
                disabled={busySearch !== null}
                onPress={() => void reopenSearch(search)}
                style={styles.recentRow}
              >
                <AppText style={styles.recentText}>
                  {search.from_stop?.name || 'Stop unavailable'} → {search.to_stop?.name || 'Stop unavailable'}
                </AppText>
                <AppText style={styles.recentDate}>{new Date(search.searched_at).toLocaleDateString()}</AppText>
              </Pressable>
            ))}
          </View>
        ) : null}

        {routes.map((route) => (
          <Pressable key={route.id} onPress={() => void openRoute(route)} style={styles.routeOption}>
            <AppText style={styles.routeName}>{route.name} · {route.code}</AppText>
            <AppText style={styles.routeMeta}>
              {route.company_name || 'Public transit'}
              {route.estimated_minutes ? ` · about ${route.estimated_minutes} min` : ''}
            </AppText>
          </Pressable>
        ))}
        {routes.length === 0 && fromStop && toStop && busySearch !== 'plan' && !error ? (
          <AppText style={styles.hint}>No direct routes were found for these stops.</AppText>
        ) : null}
      </View>

      <Modal visible={selectedRoute !== null} transparent animationType="slide" onRequestClose={() => setSelectedRoute(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, Spacing.four) }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeadingText}>
                <AppText style={styles.modalCode}>{selectedRoute?.code}</AppText>
                <AppText style={styles.modalTitle}>{selectedRoute?.name}</AppText>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close route details" onPress={() => setSelectedRoute(null)} hitSlop={10}>
                <SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }} size={24} tintColor={Monochrome.textMuted} />
              </Pressable>
            </View>
            {detailLoading ? (
              <View style={styles.detailLoading}>
                <ActivityIndicator size="small" color={Monochrome.textPrimary} />
                <AppText style={styles.hint}>Loading route stops and schedules…</AppText>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {detailError ? <AppText style={styles.error}>{detailError}</AppText> : null}
                <AppText style={styles.recentHeading}>Stops</AppText>
                {routeStops.length ? routeStops.map((stop) => (
                  <AppText key={stop.id} style={styles.detailLine}>{stop.sequence}. {stop.name}</AppText>
                )) : <AppText style={styles.hint}>No route stops are available.</AppText>}
                <AppText style={[styles.recentHeading, styles.departureHeading]}>Departures · next 24 hours</AppText>
                {departures.length ? departures.slice(0, 5).map((departure) => (
                  <AppText key={departure.trip_id} style={styles.detailLine}>
                    {new Date(departure.scheduled_departure).toLocaleString()}
                    {departure.bus_number ? ` · Bus ${departure.bus_number}` : ''}
                  </AppText>
                )) : <AppText style={styles.hint}>No scheduled departures are published.</AppText>}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

type StopPickerProps = {
  label: string;
  query: string;
  results: PublicStop[];
  loading: boolean;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onSelect: (stop: PublicStop) => void;
};

function StopPicker({ label, query, results, loading, onQueryChange, onSearch, onSelect }: StopPickerProps) {
  return (
    <View style={styles.picker}>
      <AppTextInput
        accessibilityLabel={label}
        returnKeyType="search"
        onSubmitEditing={onSearch}
        value={query}
        onChangeText={onQueryChange}
        placeholder={label}
        placeholderTextColor={Monochrome.textMuted}
        style={styles.input}
      />
      <Pressable accessibilityRole="button" onPress={onSearch} disabled={loading} style={styles.searchButton}>
        {loading
          ? <ActivityIndicator size="small" color={Monochrome.textPrimary} />
          : <AppText style={styles.searchButtonText}>Search</AppText>}
      </Pressable>
      {results.map((stop) => (
        <Pressable key={stop.id} onPress={() => onSelect(stop)} style={styles.stopOption}>
          <AppText style={styles.stopName}>{stop.name}</AppText>
          {stop.code ? <AppText style={styles.stopCode}>{stop.code}</AppText> : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Monochrome.border,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  iconBox: {
    width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Monochrome.surfaceElevated, borderWidth: 1, borderColor: Monochrome.border,
  },
  title: { color: Monochrome.textPrimary, fontSize: 16, fontWeight: '800' },
  subtitle: { color: Monochrome.textMuted, fontSize: 12, marginTop: 2 },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  input: {
    flex: 1, minWidth: 180, minHeight: 44, paddingHorizontal: Spacing.three, borderRadius: 10,
    borderWidth: 1, borderColor: Monochrome.border, color: Monochrome.textPrimary,
    backgroundColor: Monochrome.background,
  },
  searchButton: {
    minWidth: 72, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three,
    borderRadius: 10, backgroundColor: Monochrome.surfaceElevated,
  },
  searchButtonText: { color: Monochrome.textPrimary, fontWeight: '700', fontSize: 12 },
  locationButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 9,
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  locationButtonText: { color: Monochrome.textPrimary, fontSize: 12, fontWeight: '600' },
  stopOption: {
    width: '100%', paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, borderRadius: 8,
    backgroundColor: Monochrome.surfaceElevated,
  },
  stopName: { color: Monochrome.textPrimary, fontSize: 13, fontWeight: '600' },
  stopCode: { color: Monochrome.textMuted, fontSize: 11, marginTop: 2 },
  planButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: Monochrome.actionPrimary },
  planButtonText: { color: Monochrome.actionPrimaryText, fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  error: { color: Monochrome.textPrimary, fontSize: 12 },
  hint: { color: Monochrome.textMuted, fontSize: 12 },
  recentSection: { gap: Spacing.two },
  recentHeading: { color: Monochrome.textSecondary, fontSize: 12, fontWeight: '800' },
  recentRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two,
    padding: Spacing.two, borderRadius: 8, backgroundColor: Monochrome.surfaceElevated,
  },
  recentText: { flex: 1, color: Monochrome.textPrimary, fontSize: 12 },
  recentDate: { color: Monochrome.textMuted, fontSize: 10 },
  routeOption: { padding: Spacing.three, borderRadius: 10, backgroundColor: Monochrome.surfaceElevated, gap: 4 },
  routeName: { color: Monochrome.textPrimary, fontSize: 13, fontWeight: '700' },
  routeMeta: { color: Monochrome.textMuted, fontSize: 11 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalCard: {
    maxHeight: '75%', padding: Spacing.four, backgroundColor: Monochrome.surfacePrimary,
    borderTopLeftRadius: 22, borderTopRightRadius: 22, gap: Spacing.three,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalHeadingText: { flex: 1, gap: 3 },
  modalCode: { color: Monochrome.textMuted, fontSize: 11, fontWeight: '700' },
  modalTitle: { color: Monochrome.textPrimary, fontSize: 17, fontWeight: '800' },
  detailLoading: { minHeight: 100, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  detailLine: { paddingVertical: Spacing.two, color: Monochrome.textPrimary, fontSize: 13 },
  departureHeading: { marginTop: Spacing.four },
});
