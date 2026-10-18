import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  ActivityIndicator,
  Alert,
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
import * as Location from 'expo-location';

import { Brand, Spacing } from '@/constants/theme';
import {
  endTrip,
  getCurrentDriverBus,
  getDriverTrips,
  reportDriverLocation,
  startTrip,
  updateTripProgress,
  type DriverBusInfo,
  type DriverTripInfo,
} from '@/features/driver/services/driverApi';

export default function DriverConsoleScreen() {
  const insets = useSafeAreaInsets();

  const [bus, setBus] = useState<DriverBusInfo | null>(null);
  const [trips, setTrips] = useState<DriverTripInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'requesting' | 'live' | 'denied' | 'error'>('requesting');
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsRetry, setGpsRetry] = useState(0);
  const [appForeground, setAppForeground] = useState(AppState.currentState === 'active');
  const [loadError, setLoadError] = useState<string | null>(null);
  const locationRequestInFlight = useRef(false);

  const loadDriverData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    try {
      const [busRes, tripsRes] = await Promise.all([
        getCurrentDriverBus(),
        getDriverTrips(),
      ]);

      const errors: string[] = [];
      if (busRes.ok && busRes.data) setBus(busRes.data.bus);
      else if (!busRes.ok) errors.push(busRes.message || 'Could not load your assigned bus.');
      if (tripsRes.ok && tripsRes.data) setTrips(tripsRes.data.trips);
      else if (!tripsRes.ok) errors.push(tripsRes.message || 'Could not load your assigned trips.');
      setLoadError(errors[0] ?? null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load driver data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadDriverData();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadDriverData]);

  const activeTrip = trips.find(
    (trip) => trip.status === 'in_progress' && bus !== null && trip.bus_id === bus.id,
  ) ?? null;
  const activeTripId = activeTrip?.id ?? null;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setAppForeground(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let active = true;
    let subscription: Location.LocationSubscription | null = null;

    if (activeTripId === null) {
      return () => {
        active = false;
        subscription?.remove();
      };
    }
    if (!appForeground) {
      return () => {
        active = false;
        subscription?.remove();
      };
    }

    void (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!active) return;
        setGpsError(null);
        if (permission.status !== 'granted') {
          setGpsStatus('denied');
          setGpsError('Location permission is needed while this trip is active.');
          return;
        }
        if (!(await Location.hasServicesEnabledAsync())) {
          setGpsStatus('error');
          setGpsError('Device location services are turned off.');
          return;
        }

        setGpsStatus('requesting');
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 15000,
            distanceInterval: 30,
          },
          async (position) => {
            if (!active || locationRequestInFlight.current) return;
            locationRequestInFlight.current = true;
            try {
              const { latitude, longitude, speed, heading, accuracy } = position.coords;
              const speedKmh = speed === null ? undefined : Math.max(0, speed * 3.6);
              const result = await reportDriverLocation(
                latitude,
                longitude,
                speedKmh,
                heading === null ? undefined : heading,
                accuracy === null ? undefined : accuracy,
              );
              if (!active) return;
              if (result.ok) {
                setGpsStatus('live');
                setGpsError(null);
              } else {
                setGpsStatus('error');
                setGpsError(result.message || 'Location update was rejected by the server.');
              }
            } catch (error) {
              if (active) {
                setGpsStatus('error');
                setGpsError(error instanceof Error ? error.message : 'Network error while publishing location.');
              }
            } finally {
              locationRequestInFlight.current = false;
            }
          },
        );
      } catch (error) {
        if (active) {
          setGpsStatus('error');
          setGpsError(error instanceof Error ? error.message : 'Unable to start GPS sharing.');
        }
      }
    })();

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [activeTripId, appForeground, gpsRetry]);

  const handleStartTrip = async (tripId: number) => {
    setActionBusyId(tripId);
    try {
      const res = await startTrip(tripId);
      if (res.ok) {
        Alert.alert('Trip Started', 'Trip is now active and recording taps.');
        await loadDriverData(true);
      } else {
        Alert.alert('Error', res.message || 'Could not start trip.');
      }
    } catch {
      Alert.alert('Error', 'Connection error.');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleNextStop = async (tripId: number) => {
    const trip = trips.find((item) => item.id === tripId);
    if (!trip) return;
    setActionBusyId(tripId);
    try {
      const res = await updateTripProgress(tripId, {
        stop_sequence: (trip.current_stop_sequence ?? 0) + 1,
      });
      if (res.ok) {
        Alert.alert('Progress Recorded', 'Trip progress updated to next scheduled stop.');
        await loadDriverData(true);
      } else {
        Alert.alert('Error', res.message || 'Could not update stop.');
      }
    } catch {
      Alert.alert('Error', 'Connection error.');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleEndTrip = async (tripId: number) => {
    setActionBusyId(tripId);
    try {
      const res = await endTrip(tripId);
      if (res.ok) {
        setGpsError(null);
        Alert.alert('Trip Concluded', 'Trip concluded successfully.');
        await loadDriverData(true);
      } else {
        Alert.alert('Error', res.message || 'Could not end trip.');
      }
    } catch {
      Alert.alert('Error', 'Connection error.');
    } finally {
      setActionBusyId(null);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <SymbolView
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            size={22}
            tintColor={Brand.white}
          />
        </Pressable>
        <Text style={styles.headerTitle}>Driver Shift Console</Text>
        <Pressable
          onPress={() => setGpsRetry((retry) => retry + 1)}
          disabled={!activeTrip || gpsStatus === 'requesting'}
          style={styles.gpsBtn}
        >
          <SymbolView
            name={{ ios: 'antenna.radiowaves.left.and.right', android: 'wifi_tethering', web: 'wifi_tethering' }}
            size={18}
            tintColor="#4ADE80"
          />
          <Text style={styles.gpsBtnText}>
            {!activeTrip
              ? 'GPS Idle'
              : !appForeground
                ? 'GPS Paused'
                : gpsStatus === 'live'
                  ? 'GPS Live'
                  : gpsStatus === 'requesting'
                    ? 'GPS Starting'
                    : gpsStatus === 'denied'
                      ? 'GPS Denied'
                      : 'Retry GPS'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadDriverData(true)} tintColor="#4ADE80" />
        }
      >
        {loadError ? (
          <View style={styles.errorNotice}>
            <Text style={styles.errorNoticeText}>{loadError}</Text>
            <Pressable onPress={() => void loadDriverData(true)}>
              <Text style={styles.retryNoticeText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}
        {gpsError ? (
          <View style={styles.errorNotice}>
            <Text style={styles.errorNoticeText}>{gpsError}</Text>
          </View>
        ) : null}
        {/* Assigned Bus Banner */}
        <View style={styles.busBanner}>
          <View style={styles.busTop}>
            <View style={styles.busIconCircle}>
              <SymbolView
                name={{ ios: 'bus.fill', android: 'directions_bus', web: 'directions_bus' }}
                size={26}
                tintColor={Brand.white}
              />
            </View>
            <View style={styles.busInfo}>
              <Text style={styles.busLabel}>CURRENT ASSIGNED VEHICLE</Text>
              <Text style={styles.busNumber}>{bus?.bus_number || 'No bus assigned'}</Text>
              <Text style={styles.busReg}>
                {bus
                  ? `${bus.registration_number} · Cap: ${bus.capacity}`
                  : 'Vehicle details unavailable'}
              </Text>
              <Text style={styles.busReg}>
                {activeTrip ? `Active trip #${activeTrip.id}` : 'No active trip for this bus'}
              </Text>
            </View>
            <View style={styles.busStatusPill}>
              <Text style={styles.busStatusText}>{bus?.status?.toUpperCase() || 'ON DUTY'}</Text>
            </View>
          </View>
        </View>

        {/* Scan Passenger QR POS Button */}
        <View style={styles.driverActionsCard}>
          <Pressable
            onPress={() => router.push('/driver/qr' as any)}
            style={styles.scanQrPrimaryBtn}
          >
            <View style={styles.scanQrIconCircle}>
              <SymbolView
                name={{ ios: 'qrcode', android: 'qr_code', web: 'qr_code' }}
                size={26}
                tintColor="#0F172A"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.scanQrBtnTitle}>Show Fare QR</Text>
              <Text style={styles.scanQrBtnSub}>Let passengers scan and pay from their wallet</Text>
            </View>
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              size={20}
              tintColor="#4ADE80"
            />
          </Pressable>
          <Pressable
            onPress={() => router.push('/driver/scan' as any)}
            style={styles.scanQrPrimaryBtn}
          >
            <View style={styles.scanQrIconCircle}>
              <SymbolView
                name={{ ios: 'qrcode.viewfinder', android: 'qr_code_scanner', web: 'qr_code_scanner' }}
                size={26}
                tintColor="#0F172A"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.scanQrBtnTitle}>Scan Passenger QR</Text>
              <Text style={styles.scanQrBtnSub}>Collect bus fare & issue official transit ticket</Text>
            </View>
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              size={20}
              tintColor="#4ADE80"
            />
          </Pressable>
        </View>

        {/* Shift Trips List */}
        <View style={styles.tripsSection}>
          <Text style={styles.sectionTitle}>Shift Trips ({trips.length})</Text>

          {loading && !refreshing ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#4ADE80" />
              <Text style={styles.loadingText}>Fetching assigned trip shifts...</Text>
            </View>
          ) : trips.length > 0 ? (
            trips.map((trip) => {
              const isProgress = trip.status === 'in_progress';
              const isDone = trip.status === 'completed';
              const isScheduled = trip.status === 'scheduled';
              const isBusy = actionBusyId === trip.id;

              return (
                <View key={trip.id} style={styles.tripCard}>
                  <View style={styles.tripHeader}>
                    <View style={styles.routePill}>
                      <Text style={styles.routePillText}>{trip.route_code || 'Assigned route'}</Text>
                    </View>
                    <Text style={styles.routeTitle}>{trip.route_name || `Trip #${trip.id}`}</Text>
                    <View style={[
                      styles.tripStatusTag,
                      isProgress && styles.tagProgress,
                      isDone && styles.tagDone,
                      isScheduled && styles.tagScheduled,
                    ]}>
                      <Text style={styles.tripStatusText}>{trip.status.toUpperCase()}</Text>
                    </View>
                  </View>

                  <Text style={styles.tripTime}>
                    Bus: {trip.bus_number || bus?.bus_number || 'Assigned Bus'} · 
                    {trip.started_at ? ` Started: ${new Date(trip.started_at).toLocaleTimeString()}` : ' Not Started'}
                  </Text>

                  {/* Operational Controls */}
                  <View style={styles.tripActions}>
                    {isScheduled && (
                      <Pressable
                        disabled={isBusy}
                        onPress={() => handleStartTrip(trip.id)}
                        style={[styles.btnAction, styles.btnStart]}
                      >
                        <SymbolView name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }} size={16} tintColor={Brand.white} />
                        <Text style={styles.btnActionText}>Start Trip</Text>
                      </Pressable>
                    )}

                    {isProgress && (
                      <>
                        <Pressable
                          disabled={isBusy}
                          onPress={() => handleNextStop(trip.id)}
                          style={[styles.btnAction, styles.btnStop]}
                        >
                          <SymbolView name={{ ios: 'mappin.and.ellipse', android: 'pin_drop', web: 'pin_drop' }} size={16} tintColor={Brand.white} />
                          <Text style={styles.btnActionText}>Next Stop</Text>
                        </Pressable>

                        <Pressable
                          disabled={isBusy}
                          onPress={() => handleEndTrip(trip.id)}
                          style={[styles.btnAction, styles.btnEnd]}
                        >
                          <SymbolView name={{ ios: 'stop.fill', android: 'stop', web: 'stop' }} size={16} tintColor={Brand.white} />
                          <Text style={styles.btnActionText}>End Trip</Text>
                        </Pressable>
                      </>
                    )}

                    {isDone && (
                      <View style={styles.completedNotice}>
                        <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} size={16} tintColor="#4ADE80" />
                        <Text style={styles.completedNoticeText}>Trip concluded</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <SymbolView
                name={{ ios: 'steeringwheel', android: 'drive_eta', web: 'drive_eta' }}
                size={40}
                tintColor="#64748B"
              />
              <Text style={styles.emptyTitle}>No Trips Assigned for Shift</Text>
              <Text style={styles.emptySub}>Your company dispatcher will assign transit trips to this bus.</Text>
            </View>
          )}
        </View>
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
  },
  backBtn: {
    padding: Spacing.one,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Brand.white,
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  gpsBtnText: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.four,
  },
  errorNotice: {
    backgroundColor: '#7F1D1D',
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  errorNoticeText: {
    color: '#FEE2E2',
    fontSize: 13,
  },
  retryNoticeText: {
    color: '#86EFAC',
    fontWeight: '700',
  },
  busBanner: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: '#334155',
  },
  driverActionsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  scanQrPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: 'rgba(74, 222, 128, 0.12)',
    padding: Spacing.three,
    borderRadius: 12,
  },
  scanQrIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4ADE80',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanQrBtnTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Brand.white,
  },
  scanQrBtnSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  busTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  busIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busInfo: {
    flex: 1,
  },
  busLabel: {
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '700',
    color: '#94A3B8',
  },
  busNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: Brand.white,
    marginTop: 2,
  },
  busReg: {
    fontSize: 12,
    color: '#CBD5E1',
    marginTop: 2,
  },
  busStatusPill: {
    backgroundColor: '#166534',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  busStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: Brand.white,
  },
  tripsSection: {
    gap: Spacing.three,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Brand.white,
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
  tripCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: Spacing.four,
    gap: Spacing.three,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  routePill: {
    backgroundColor: '#0369A1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  routePillText: {
    fontSize: 12,
    fontWeight: '800',
    color: Brand.white,
  },
  routeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.white,
    flex: 1,
  },
  tripStatusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagProgress: {
    backgroundColor: '#0284C7',
  },
  tagDone: {
    backgroundColor: '#166534',
  },
  tagScheduled: {
    backgroundColor: '#64748B',
  },
  tripStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: Brand.white,
  },
  tripTime: {
    fontSize: 12,
    color: '#94A3B8',
  },
  tripActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  btnAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnStart: {
    backgroundColor: '#16A34A',
  },
  btnStop: {
    backgroundColor: '#0284C7',
  },
  btnEnd: {
    backgroundColor: '#DC2626',
  },
  btnActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.white,
  },
  completedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  completedNoticeText: {
    fontSize: 13,
    color: '#4ADE80',
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: Spacing.six,
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.white,
  },
  emptySub: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },
});
