import {AppText, AppTextInput } from '@/components/typography/app-text';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import * as Location from 'expo-location';

import { Monochrome, Spacing } from '@/constants/theme';
import { logout } from '@/features/auth/services/auth';
import { getSession } from '@/features/auth/session';
import { useNotificationCount } from '@/features/notifications/useNotificationCount';
import {
  endTrip,
  getCurrentDriverBus,
  getDriverProfile,
  getDriverOperationalReports,
  getDriverFuelExpenses,
  getDriverRoute,
  getDriverTickets,
  getDriverTrips,
  reportDriverLocation,
  createDriverOperationalReport,
  createDriverFuelExpense,
  startTrip,
  updateTripProgress,
  type DriverBusInfo,
  type DriverRouteInfo,
  type DriverTicket,
  type DriverTripInfo,
  type DriverOperationalReport,
  type DriverOperationalReportPayload,
  type DriverFuelExpense,
} from '@/features/driver/services/driverApi';

type DriverTab = 'console' | 'route' | 'tickets' | 'account';

export default function DriverConsoleScreen() {
  const insets = useSafeAreaInsets();
  const session = getSession();
  const { unreadCount } = useNotificationCount();

  const [currentTab, setCurrentTab] = useState<DriverTab>('console');
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
  const [reports, setReports] = useState<DriverOperationalReport[]>([]);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportType, setReportType] = useState<DriverOperationalReportPayload['type']>('incident');
  const [reportCategory, setReportCategory] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportOdometer, setReportOdometer] = useState('');
  const [reportChecklist, setReportChecklist] = useState<Record<string, boolean>>({
    brakes: true,
    tires: true,
    lights: true,
    horn: true,
    mirrors: true,
    emergency_equipment: true,
  });
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [fuelExpenses, setFuelExpenses] = useState<DriverFuelExpense[]>([]);
  const [fuelModalVisible, setFuelModalVisible] = useState(false);
  const [fuelAmount, setFuelAmount] = useState('');
  const [fuelLiters, setFuelLiters] = useState('');
  const [fuelOdometer, setFuelOdometer] = useState('');
  const [fuelStation, setFuelStation] = useState('');
  const [fuelSubmitting, setFuelSubmitting] = useState(false);
  const [fuelError, setFuelError] = useState<string | null>(null);

  // Tickets state
  const [tickets, setTickets] = useState<DriverTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  // Route state
  const [routeInfo, setRouteInfo] = useState<DriverRouteInfo | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // Profile state
  const [driverProfile, setDriverProfile] = useState<Record<string, unknown> | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadDriverData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    try {
      const [busRes, tripsRes, reportsRes, fuelRes] = await Promise.all([
        getCurrentDriverBus(),
        getDriverTrips(),
        getDriverOperationalReports(),
        getDriverFuelExpenses(),
      ]);

      const errors: string[] = [];
      if (busRes.ok && busRes.data) setBus(busRes.data.bus);
      else if (!busRes.ok) errors.push(busRes.message || 'Could not load your assigned bus.');
      if (tripsRes.ok && tripsRes.data) setTrips(tripsRes.data.trips);
      else if (!tripsRes.ok) errors.push(tripsRes.message || 'Could not load your assigned trips.');
      if (reportsRes.ok && reportsRes.data) setReports(reportsRes.data.reports);
      else if (!reportsRes.ok) errors.push(reportsRes.message || 'Could not load operational reports.');
      if (fuelRes.ok && fuelRes.data) setFuelExpenses(fuelRes.data.expenses);
      else if (!fuelRes.ok) errors.push(fuelRes.message || 'Could not load fuel expenses.');
      setLoadError(errors[0] ?? null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load driver data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const submitFuelExpense = async () => {
    const amount = fuelAmount.trim();
    const match = /^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(amount);
    const amountMinor = match ? Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0')) : 0;
    const litersValue = Number(fuelLiters);
    const odometerValue = Number(fuelOdometer);
    if (amountMinor <= 0 || !Number.isFinite(litersValue) || litersValue <= 0
      || !Number.isFinite(odometerValue) || odometerValue < 0) {
      setFuelError('Enter a valid amount, fuel quantity, and odometer reading.');
      return;
    }
    setFuelSubmitting(true);
    setFuelError(null);
    try {
      const result = await createDriverFuelExpense({
        amount_minor: amountMinor,
        liters: litersValue,
        odometer_km: odometerValue,
        ...(fuelStation.trim() ? { station: fuelStation.trim() } : {}),
        occurred_at: new Date().toISOString(),
      });
      if (!result.ok || !result.data) {
        setFuelError(result.message || 'Could not record this fuel expense.');
        return;
      }
      setFuelExpenses((current) => [result.data.expense, ...current]);
      setFuelModalVisible(false);
      setFuelAmount('');
      setFuelLiters('');
      setFuelOdometer('');
      setFuelStation('');
      Alert.alert('Fuel recorded', 'The expense was saved against your active assigned vehicle.');
    } catch (error) {
      setFuelError(error instanceof Error ? error.message : 'Network error recording fuel expense.');
    } finally {
      setFuelSubmitting(false);
    }
  };

  const submitOperationalReport = async () => {
    setReportError(null);
    const inspection = reportType === 'inspection';
    if (!inspection && (reportCategory.trim().length < 2 || reportDescription.trim().length < 5)) {
      setReportError('Choose a category and describe the issue in at least 5 characters.');
      return;
    }
    const odometer = reportOdometer.trim() === '' ? undefined : Number(reportOdometer);
    if (odometer !== undefined && (!Number.isFinite(odometer) || odometer < 0)) {
      setReportError('Enter a valid non-negative odometer reading.');
      return;
    }

    const payload: DriverOperationalReportPayload = {
      type: reportType,
      ...(inspection ? { checklist: reportChecklist } : { category: reportCategory.trim(), description: reportDescription.trim() }),
      ...(inspection && reportDescription.trim() ? { description: reportDescription.trim() } : {}),
      ...(odometer !== undefined ? { odometer_km: odometer } : {}),
    };

    setReportSubmitting(true);
    try {
      const result = await createDriverOperationalReport(payload);
      if (!result.ok || !result.data) {
        setReportError(result.message || 'Could not submit the operational report.');
        return;
      }
      setReports((current) => [result.data.report, ...current]);
      setReportModalVisible(false);
      setReportCategory('');
      setReportDescription('');
      setReportOdometer('');
      Alert.alert('Report submitted', 'Your company can now review this operational report.');
    } catch (error) {
      setReportError(error instanceof Error ? error.message : 'Network error submitting report.');
    } finally {
      setReportSubmitting(false);
    }
  };

  const loadTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const res = await getDriverTickets();
      if (res.ok && res.data) {
        setTickets(res.data.tickets || []);
      }
    } catch {
      // Ignored
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  const loadRoute = useCallback(async () => {
    setRouteLoading(true);
    try {
      const res = await getDriverRoute();
      if (res.ok && res.data) {
        setRouteInfo(res.data);
      }
    } catch {
      // Ignored
    } finally {
      setRouteLoading(false);
    }
  }, []);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const res = await getDriverProfile();
      if (res.ok && res.data) {
        const u = (res.data as any).user || res.data;
        setDriverProfile(u);
      }
    } catch {
      // Ignored
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadDriverData();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadDriverData]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (currentTab === 'tickets') void loadTickets();
      if (currentTab === 'route') void loadRoute();
      if (currentTab === 'account') void loadProfile();
    });
    return () => cancelAnimationFrame(frame);
  }, [currentTab, loadTickets, loadRoute, loadProfile]);

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
        setGpsStatus('requesting');
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
              // The platform reports -1 for a measurement it could not take:
              // an invalid course over ground, a missing compass bearing, an
              // unresolved accuracy radius. "Not measured" must not be sent as
              // a number — the server treats a negative heading as invalid and
              // would reject the whole position, losing a good fix because the
              // compass was unavailable.
              const speedKmh = speed === null || speed < 0 ? undefined : Math.max(0, speed * 3.6);
              const headingDegrees = heading === null || heading < 0 ? undefined : heading;
              const accuracyMetres = accuracy === null || accuracy < 0 ? undefined : accuracy;
              const result = await reportDriverLocation(
                latitude,
                longitude,
                speedKmh,
                headingDegrees,
                accuracyMetres,
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
                setGpsError(error instanceof Error ? error.message : 'Could not report driver location.');
              }
            } finally {
              locationRequestInFlight.current = false;
            }
          },
        );
      } catch (error) {
        if (active) {
          setGpsStatus('error');
          setGpsError(error instanceof Error ? error.message : 'Location services failed.');
        }
      }
    })();

    return () => {
      active = false;
      subscription?.remove();
    };
    // `gpsRetry` is the manual retry handle: bumping it re-runs this effect, so
    // the "Retry" pill can re-request permission and re-subscribe after a
    // denial or a device-side location failure.
  }, [activeTripId, appForeground, gpsRetry]);

  const handleStartTrip = async (tripId: number) => {
    setActionBusyId(tripId);
    try {
      const res = await startTrip(tripId);
      if (res.ok) {
        Alert.alert('Trip Started', 'Assigned trip is now in progress.');
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
    setActionBusyId(tripId);
    try {
      const current = trips.find((t) => t.id === tripId)?.current_stop_sequence ?? 0;
      const res = await updateTripProgress(tripId, { stop_sequence: current + 1 });
      if (res.ok) {
        Alert.alert('Stop Updated', `Arrived at stop #${current + 1}.`);
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

  const handleLogout = () => {
    Alert.alert(
      'Sign Out of Driver Console',
      'Are you sure you want to sign out? Your active shift session will be concluded on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } finally {
              router.replace('/login');
            }
          },
        },
      ],
    );
  };

  const driverName = (driverProfile as any)?.name || session.user?.name || 'Driver';
  const driverEmail = (driverProfile as any)?.email || session.user?.email || '';
  const driverPhone = (driverProfile as any)?.phone || session.user?.phone || '—';
  const licenseNumber = (driverProfile as any)?.driver?.license_number || 'TAP-DRV-001';
  const companyName = bus?.company_name || ((driverProfile as any)?.company_memberships?.[0]?.company?.name) || 'Transport Partner';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.appBadge}>
            <SymbolView
              name={{ ios: 'steeringwheel', android: 'drive_eta', web: 'drive_eta' }}
              size={18}
              tintColor={Monochrome.textPrimary}
            />
          </View>
          <View>
            <AppText style={styles.headerTitle}>Driver Console</AppText>
            <AppText style={styles.headerSubtitle}>{bus?.bus_number ? `Bus: ${bus.bus_number}` : companyName}</AppText>
          </View>
        </View>

        <View style={styles.headerRight}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
            onPress={() => router.push('/notifications')}
            style={styles.notificationButton}
          >
            <SymbolView
              name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
              size={19}
              tintColor={Monochrome.textPrimary}
            />
            {unreadCount > 0 ? (
              <View style={styles.notificationBadge}>
                <AppText style={styles.notificationBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</AppText>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            onPress={() => setGpsRetry((retry) => retry + 1)}
            disabled={!activeTrip || gpsStatus === 'requesting'}
            style={[styles.gpsPill, gpsStatus === 'live' && styles.gpsPillLive]}
          >
            <View style={[styles.gpsDot, gpsStatus === 'live' && styles.gpsDotLive]} />
            <AppText style={styles.gpsPillText}>
              {!activeTrip
                ? 'GPS Idle'
                : !appForeground
                  ? 'Paused'
                  : gpsStatus === 'live'
                    ? 'GPS Live'
                    : gpsStatus === 'requesting'
                      ? 'Starting'
                      : gpsStatus === 'denied'
                        ? 'Denied'
                        : 'Retry'}
            </AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Driver account menu"
            onPress={() => setCurrentTab('account')}
            style={styles.avatarButton}
          >
            <AppText style={styles.avatarText}>
              {driverName.slice(0, 2).toUpperCase()}
            </AppText>
          </Pressable>
        </View>
      </View>

      {/* Main Tab Content */}
      <View style={styles.contentArea}>
        {currentTab === 'console' && (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => loadDriverData(true)} tintColor={Monochrome.textPrimary} />
            }
          >
            {loadError ? (
              <View style={styles.errorNotice}>
                <AppText style={styles.errorNoticeText}>{loadError}</AppText>
                <Pressable onPress={() => void loadDriverData(true)}>
                  <AppText style={styles.retryNoticeText}>Retry</AppText>
                </Pressable>
              </View>
            ) : null}
            {gpsError ? (
              <View style={styles.errorNotice}>
                <AppText style={styles.errorNoticeText}>{gpsError}</AppText>
              </View>
            ) : null}

            {/* Assigned Bus Banner */}
            <View style={styles.busBanner}>
              <View style={styles.busTop}>
                <View style={styles.busIconCircle}>
                  <SymbolView
                    name={{ ios: 'bus.fill', android: 'directions_bus', web: 'directions_bus' }}
                    size={22}
                    tintColor={Monochrome.textPrimary}
                  />
                </View>
                <View style={styles.busInfo}>
                  <AppText style={styles.busLabel}>CURRENT ASSIGNED VEHICLE</AppText>
                  <AppText style={styles.busNumber}>{bus?.bus_number || 'No bus assigned'}</AppText>
                  <AppText style={styles.busReg}>
                    {bus
                      ? `${bus.registration_number} · Cap: ${bus.capacity} seats`
                      : 'Vehicle details unavailable'}
                  </AppText>
                  <AppText style={styles.busReg}>
                    {activeTrip ? `Active trip #${activeTrip.id}` : 'No active trip for this bus'}
                  </AppText>
                </View>
                <View style={styles.busStatusPill}>
                  <AppText style={styles.busStatusText}>{bus?.status?.toUpperCase() || 'ON DUTY'}</AppText>
                </View>
              </View>
            </View>

            {/* POS Actions: Show Fare QR & Scan Passenger QR */}
            <View style={styles.driverActionsCard}>
              <Pressable
                onPress={() => router.push('/driver/qr' as any)}
                style={styles.scanQrPrimaryBtn}
              >
                <View style={styles.scanQrIconCircle}>
                  <SymbolView
                    name={{ ios: 'qrcode', android: 'qr_code', web: 'qr_code' }}
                    size={24}
                    tintColor={Monochrome.actionPrimaryText}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={styles.scanQrBtnTitle}>Show Fare QR</AppText>
                  <AppText style={styles.scanQrBtnSub}>Let passengers scan and pay with mobile wallet</AppText>
                </View>
                <SymbolView
                  name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                  size={18}
                  tintColor={Monochrome.textPrimary}
                />
              </Pressable>

              <Pressable
                onPress={() => router.push('/driver/scan' as any)}
                style={styles.scanQrPrimaryBtn}
              >
                <View style={styles.scanQrIconCircle}>
                  <SymbolView
                    name={{ ios: 'qrcode.viewfinder', android: 'qr_code_scanner', web: 'qr_code_scanner' }}
                    size={24}
                    tintColor={Monochrome.actionPrimaryText}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={styles.scanQrBtnTitle}>Scan Passenger QR</AppText>
                  <AppText style={styles.scanQrBtnSub}>Collect bus fare & issue official transit ticket</AppText>
                </View>
                <SymbolView
                  name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                  size={18}
                  tintColor={Monochrome.textPrimary}
                />
              </Pressable>
            </View>

            <View style={styles.reportActionsCard}>
              <AppText style={styles.sectionTitle}>Vehicle Operations</AppText>
              <View style={styles.reportActionRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setReportType('inspection');
                    setReportError(null);
                    setReportModalVisible(true);
                  }}
                  style={styles.reportActionButton}
                >
                  <AppText style={styles.reportActionTitle}>Vehicle inspection</AppText>
                  <AppText style={styles.reportActionSubtitle}>Submit required safety checklist</AppText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setReportType('incident');
                    setReportError(null);
                    setReportModalVisible(true);
                  }}
                  style={styles.reportActionButton}
                >
                  <AppText style={styles.reportActionTitle}>Report an issue</AppText>
                  <AppText style={styles.reportActionSubtitle}>Incident, vehicle, or route issue</AppText>
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setFuelError(null);
                  setFuelModalVisible(true);
                }}
                style={styles.reportActionButton}
              >
                <AppText style={styles.reportActionTitle}>Record fuel expense</AppText>
                <AppText style={styles.reportActionSubtitle}>Saved to your server-verified assigned vehicle</AppText>
              </Pressable>
            </View>

            {fuelExpenses.length > 0 && (
              <View style={styles.tripsSection}>
                <AppText style={styles.sectionTitle}>Recent fuel expenses</AppText>
                {fuelExpenses.slice(0, 5).map((expense) => (
                  <View key={expense.id} style={styles.tripCard}>
                    <AppText style={styles.routeTitle}>
                      {expense.bus_number || bus?.bus_number || 'Assigned bus'} · Rs. {(expense.amount_minor / 100).toFixed(2)}
                    </AppText>
                    <AppText style={styles.tripTime}>
                      {expense.liters} L · {expense.odometer_km} km · {new Date(expense.occurred_at).toLocaleString()}
                    </AppText>
                  </View>
                ))}
              </View>
            )}

            {/* Shift Trips List */}
            <View style={styles.tripsSection}>
              <View style={styles.sectionHeaderRow}>
                <AppText style={styles.sectionTitle}>Shift Trips ({trips.length})</AppText>
                <Pressable onPress={() => void loadDriverData(true)} hitSlop={8}>
                  <AppText style={styles.refreshLink}>Refresh</AppText>
                </Pressable>
              </View>

              {loading && !refreshing ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color={Monochrome.textPrimary} />
                  <AppText style={styles.loadingText}>Fetching assigned trip shifts...</AppText>
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
                          <AppText style={styles.routePillText}>{trip.route_code || 'Route'}</AppText>
                        </View>
                        <AppText style={styles.routeTitle}>{trip.route_name || `Trip #${trip.id}`}</AppText>
                        <View style={styles.tripStatusTag}>
                          <AppText style={styles.tripStatusText}>{trip.status.toUpperCase()}</AppText>
                        </View>
                      </View>

                      <AppText style={styles.tripTime}>
                        Bus: {trip.bus_number || bus?.bus_number || 'Assigned Bus'} · 
                        {trip.started_at ? ` Started: ${new Date(trip.started_at).toLocaleTimeString()}` : ' Scheduled'}
                      </AppText>

                      {/* Operational Controls */}
                      <View style={styles.tripActions}>
                        {isScheduled && (
                          <Pressable
                            disabled={isBusy}
                            onPress={() => handleStartTrip(trip.id)}
                            style={[styles.btnAction, styles.btnStart]}
                          >
                            <SymbolView name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }} size={16} tintColor={Monochrome.actionPrimaryText} />
                            <AppText style={styles.btnActionStartText}>Start Trip</AppText>
                          </Pressable>
                        )}

                        {isProgress && (
                          <>
                            <Pressable
                              disabled={isBusy}
                              onPress={() => handleNextStop(trip.id)}
                              style={[styles.btnAction, styles.btnSecondaryAction]}
                            >
                              <SymbolView name={{ ios: 'mappin.and.ellipse', android: 'pin_drop', web: 'pin_drop' }} size={16} tintColor={Monochrome.textPrimary} />
                              <AppText style={styles.btnActionText}>Next Stop</AppText>
                            </Pressable>

                            <Pressable
                              disabled={isBusy}
                              onPress={() => handleEndTrip(trip.id)}
                              style={[styles.btnAction, styles.btnSecondaryAction]}
                            >
                              <SymbolView name={{ ios: 'stop.fill', android: 'stop', web: 'stop' }} size={16} tintColor={Monochrome.textPrimary} />
                              <AppText style={styles.btnActionText}>End Trip</AppText>
                            </Pressable>
                          </>
                        )}

                        {isDone && (
                          <View style={styles.completedNotice}>
                            <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} size={16} tintColor={Monochrome.textSecondary} />
                            <AppText style={styles.completedNoticeText}>Trip concluded</AppText>
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
                    tintColor={Monochrome.textMuted}
                  />
                  <AppText style={styles.emptyTitle}>No Trips Assigned</AppText>
                  <AppText style={styles.emptySub}>
                    Contact your transport company administrator to assign scheduled shifts.
                  </AppText>
                </View>
              )}
            </View>

            <View style={styles.tripsSection}>
              <AppText style={styles.sectionTitle}>My Operational Reports</AppText>
              {reports.length > 0 ? reports.slice(0, 10).map((report) => (
                <View key={report.id} style={styles.reportHistoryCard}>
                  <View style={styles.sectionHeaderRow}>
                    <AppText style={styles.reportHistoryTitle}>
                      {report.type.replaceAll('_', ' ').toUpperCase()}
                    </AppText>
                    <AppText style={styles.reportHistoryStatus}>{report.status.toUpperCase()}</AppText>
                  </View>
                  <AppText style={styles.reportHistoryMeta}>
                    {report.bus_number || bus?.bus_number || 'Assigned vehicle'}
                    {report.created_at ? ` · ${new Date(report.created_at).toLocaleString()}` : ''}
                  </AppText>
                  {report.description ? (
                    <AppText style={styles.reportHistoryMeta}>{report.description}</AppText>
                  ) : null}
                </View>
              )) : (
                <View style={styles.emptyCard}>
                  <AppText style={styles.emptySub}>No inspections or operational reports submitted yet.</AppText>
                </View>
              )}
            </View>
          </ScrollView>
        )}

        {currentTab === 'route' && (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={routeLoading} onRefresh={() => void loadRoute()} tintColor={Monochrome.textPrimary} />
            }
          >
            <View style={styles.sectionHeaderRow}>
              <AppText style={styles.sectionTitle}>Assigned Route &amp; Stops</AppText>
            </View>

            {routeLoading && !routeInfo ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={Monochrome.textPrimary} />
                <AppText style={styles.loadingText}>Loading assigned route details...</AppText>
              </View>
            ) : routeInfo?.route ? (
              <>
                <View style={styles.routeHeaderCard}>
                  <AppText style={styles.routeHeaderName}>{routeInfo.route.name}</AppText>
                  {routeInfo.route.code ? (
                    <AppText style={styles.routeHeaderCode}>Code: {routeInfo.route.code}</AppText>
                  ) : null}
                  <AppText style={styles.routeHeaderBus}>
                    Operating on Bus: {routeInfo.bus.bus_number} ({routeInfo.bus.registration_number})
                  </AppText>
                </View>

                <View style={styles.stopsListCard}>
                  <AppText style={styles.stopsListTitle}>Ordered Stops ({routeInfo.route.stops.length})</AppText>
                  {routeInfo.route.stops.map((stop, idx) => (
                    <View key={stop.id} style={styles.stopItem}>
                      <View style={styles.stopSequenceCircle}>
                        <AppText style={styles.stopSequenceText}>{stop.sequence ?? idx + 1}</AppText>
                      </View>
                      <View style={{ flex: 1 }}>
                        <AppText style={styles.stopName}>{stop.name}</AppText>
                        {stop.latitude && stop.longitude ? (
                          <AppText style={styles.stopCoords}>
                            {stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}
                          </AppText>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <View style={styles.emptyCard}>
                <SymbolView
                  name={{ ios: 'map', android: 'map', web: 'map' }}
                  size={40}
                  tintColor={Monochrome.textMuted}
                />
                <AppText style={styles.emptyTitle}>No Route Assigned</AppText>
                <AppText style={styles.emptySub}>
                  Assigned route information will appear here once scheduled by your company.
                </AppText>
              </View>
            )}
          </ScrollView>
        )}

        {currentTab === 'tickets' && (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={ticketsLoading} onRefresh={() => void loadTickets()} tintColor={Monochrome.textPrimary} />
            }
          >
            <View style={styles.sectionHeaderRow}>
              <AppText style={styles.sectionTitle}>Validated Fare Tickets ({tickets.length})</AppText>
              <Pressable onPress={() => void loadTickets()} hitSlop={8}>
                <AppText style={styles.refreshLink}>Refresh</AppText>
              </Pressable>
            </View>

            {ticketsLoading && tickets.length === 0 ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={Monochrome.textPrimary} />
                <AppText style={styles.loadingText}>Fetching fare tickets...</AppText>
              </View>
            ) : tickets.length > 0 ? (
              tickets.map((tkt) => (
                <View key={tkt.id} style={styles.ticketCard}>
                  <View style={styles.ticketCardHeader}>
                    <AppText style={styles.ticketNumber}>{tkt.ticket_number}</AppText>
                    <View style={styles.ticketStatusBadge}>
                      <AppText style={styles.ticketStatusBadgeText}>PAID</AppText>
                    </View>
                  </View>
                  <View style={styles.ticketCardBody}>
                    <AppText style={styles.ticketPassenger}>Passenger: {tkt.passenger_name}</AppText>
                    <AppText style={styles.ticketFare}>{tkt.fare_formatted}</AppText>
                  </View>
                  <View style={styles.ticketCardFooter}>
                    <AppText style={styles.ticketMeta}>Route: {tkt.route_name}</AppText>
                    <AppText style={styles.ticketMeta}>
                      {tkt.tapped_at ? new Date(tkt.tapped_at).toLocaleTimeString() : ''}
                    </AppText>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <SymbolView
                  name={{ ios: 'ticket', android: 'receipt', web: 'receipt' }}
                  size={40}
                  tintColor={Monochrome.textMuted}
                />
                <AppText style={styles.emptyTitle}>No Fare Tickets Yet</AppText>
                <AppText style={styles.emptySub}>
                  Passenger tickets collected on your shift will appear here.
                </AppText>
              </View>
            )}
          </ScrollView>
        )}

        {currentTab === 'account' && (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={profileLoading} onRefresh={() => void loadProfile()} tintColor={Monochrome.textPrimary} />
            }
          >
            <View style={styles.profileHeaderCard}>
              <View style={styles.profileAvatarLarge}>
                <AppText style={styles.profileAvatarText}>
                  {driverName.slice(0, 2).toUpperCase()}
                </AppText>
              </View>
              <AppText style={styles.profileName}>{driverName}</AppText>
              <AppText style={styles.profileRole}>Authorized Bus Driver</AppText>
              <View style={styles.companyTagPill}>
                <AppText style={styles.companyTagText}>{companyName}</AppText>
              </View>
            </View>

            {/* Account Details */}
            <View style={styles.detailsCard}>
              <AppText style={styles.detailsCardTitle}>Driver Credentials</AppText>
              
              <View style={styles.detailRow}>
                <AppText style={styles.detailLabel}>Email</AppText>
                <AppText style={styles.detailValue}>{driverEmail || '—'}</AppText>
              </View>
              <View style={styles.detailRow}>
                <AppText style={styles.detailLabel}>Phone</AppText>
                <AppText style={styles.detailValue}>{driverPhone}</AppText>
              </View>
              <View style={styles.detailRow}>
                <AppText style={styles.detailLabel}>License Number</AppText>
                <AppText style={styles.detailValue}>{licenseNumber}</AppText>
              </View>
              <View style={styles.detailRow}>
                <AppText style={styles.detailLabel}>Assigned Bus</AppText>
                <AppText style={styles.detailValue}>{bus?.bus_number || 'None'}</AppText>
              </View>
              <View style={styles.detailRow}>
                <AppText style={styles.detailLabel}>Registration</AppText>
                <AppText style={styles.detailValue}>{bus?.registration_number || '—'}</AppText>
              </View>
              <View style={styles.detailRow}>
                <AppText style={styles.detailLabel}>Account Status</AppText>
                <AppText style={styles.detailValue}>ACTIVE</AppText>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/security/mpin' as never)}
              style={styles.securitySettingsButton}
            >
              <View style={styles.securitySettingsIcon}>
                <SymbolView
                  name={{ ios: 'lock.shield.fill', android: 'security', web: 'security' }}
                  size={18}
                  tintColor={Monochrome.textPrimary}
                />
              </View>
              <View style={styles.securitySettingsCopy}>
                <AppText style={styles.securitySettingsTitle}>Security &amp; MPIN</AppText>
                <AppText style={styles.securitySettingsDescription}>Set or update the MPIN used to authorize future eligible wallet actions.</AppText>
              </View>
              <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={15} tintColor={Monochrome.textMuted} />
            </Pressable>

            {/* Sign Out Button */}
            <Pressable
              accessibilityRole="button"
              onPress={handleLogout}
              style={styles.logoutButton}
            >
              <SymbolView
                name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }}
                size={18}
                tintColor={Monochrome.textPrimary}
              />
              <AppText style={styles.logoutButtonText}>Sign Out of Driver Console</AppText>
            </Pressable>
          </ScrollView>
        )}
      </View>

      {/* Bottom Navigation */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          onPress={() => setCurrentTab('console')}
          style={[styles.bottomTabItem, currentTab === 'console' && styles.bottomTabActive]}
        >
          <SymbolView
            name={{ ios: 'steeringwheel', android: 'drive_eta', web: 'drive_eta' }}
            size={22}
            tintColor={currentTab === 'console' ? Monochrome.textPrimary : Monochrome.textMuted}
          />
          <AppText style={[styles.bottomTabText, currentTab === 'console' && styles.bottomTabTextActive]}>
            Shift
          </AppText>
        </Pressable>

        <Pressable
          onPress={() => setCurrentTab('route')}
          style={[styles.bottomTabItem, currentTab === 'route' && styles.bottomTabActive]}
        >
          <SymbolView
            name={{ ios: 'map.fill', android: 'map', web: 'map' }}
            size={22}
            tintColor={currentTab === 'route' ? Monochrome.textPrimary : Monochrome.textMuted}
          />
          <AppText style={[styles.bottomTabText, currentTab === 'route' && styles.bottomTabTextActive]}>
            Route
          </AppText>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show passenger fare QR"
          onPress={() => router.push('/driver/qr' as any)}
          style={styles.bottomTabItem}
        >
          <View style={styles.bottomQrIcon}>
            <SymbolView
              name={{ ios: 'qrcode.viewfinder', android: 'qr_code_scanner', web: 'qr_code_scanner' }}
              size={22}
              tintColor={Monochrome.actionPrimaryText}
            />
          </View>
          <AppText style={styles.bottomTabText}>QR</AppText>
        </Pressable>

        <Pressable
          onPress={() => setCurrentTab('tickets')}
          style={[styles.bottomTabItem, currentTab === 'tickets' && styles.bottomTabActive]}
        >
          <SymbolView
            name={{ ios: 'ticket.fill', android: 'receipt', web: 'receipt' }}
            size={22}
            tintColor={currentTab === 'tickets' ? Monochrome.textPrimary : Monochrome.textMuted}
          />
          <AppText style={[styles.bottomTabText, currentTab === 'tickets' && styles.bottomTabTextActive]}>
            Tickets
          </AppText>
        </Pressable>

        <Pressable
          onPress={() => setCurrentTab('account')}
          style={[styles.bottomTabItem, currentTab === 'account' && styles.bottomTabActive]}
        >
          <SymbolView
            name={{ ios: 'person.crop.circle.fill', android: 'account_circle', web: 'account_circle' }}
            size={22}
            tintColor={currentTab === 'account' ? Monochrome.textPrimary : Monochrome.textMuted}
          />
          <AppText style={[styles.bottomTabText, currentTab === 'account' && styles.bottomTabTextActive]}>
            Account
          </AppText>
        </Pressable>
      </View>

      <Modal
        visible={reportModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.reportModalOverlay}>
          <ScrollView
            contentContainerStyle={[styles.reportModalContent, { paddingBottom: insets.bottom + Spacing.lg }]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.sectionHeaderRow}>
              <AppText style={styles.reportModalTitle}>
                {reportType === 'inspection' ? 'Vehicle inspection' : 'Operational report'}
              </AppText>
              <Pressable accessibilityRole="button" onPress={() => setReportModalVisible(false)}>
                <AppText style={styles.refreshLink}>Close</AppText>
              </Pressable>
            </View>

            <View style={styles.reportTypeChoices}>
              {([
                ['incident', 'Incident'],
                ['vehicle_issue', 'Vehicle issue'],
                ['route_disruption', 'Route disruption'],
              ] as const).map(([type, label]) => (
                <Pressable
                  key={type}
                  onPress={() => setReportType(type)}
                  style={[styles.reportTypeChoice, reportType === type && styles.reportTypeChoiceActive]}
                >
                  <AppText style={styles.reportTypeChoiceText}>{label}</AppText>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setReportType('inspection')}
                style={[styles.reportTypeChoice, reportType === 'inspection' && styles.reportTypeChoiceActive]}
              >
                <AppText style={styles.reportTypeChoiceText}>Inspection</AppText>
              </Pressable>
            </View>

            {reportType === 'inspection' ? (
              <View style={styles.checklistCard}>
                {Object.entries(reportChecklist).map(([key, checked]) => (
                  <View key={key} style={styles.checklistRow}>
                    <AppText style={styles.checklistLabel}>{key.replaceAll('_', ' ')}</AppText>
                    <Switch
                      value={checked}
                      onValueChange={(value) => setReportChecklist((current) => ({ ...current, [key]: value }))}
                      accessibilityLabel={`${key.replaceAll('_', ' ')} inspection result`}
                    />
                  </View>
                ))}
              </View>
            ) : (
              <>
                <AppTextInput
                  style={styles.reportInput}
                  placeholder="Issue category (e.g. breakdown, safety)"
                  placeholderTextColor={Monochrome.textMuted}
                  value={reportCategory}
                  onChangeText={setReportCategory}
                  accessibilityLabel="Operational report category"
                />
                <AppTextInput
                  style={[styles.reportInput, styles.reportDescriptionInput]}
                  placeholder="Describe what happened and where"
                  placeholderTextColor={Monochrome.textMuted}
                  value={reportDescription}
                  onChangeText={setReportDescription}
                  multiline
                  accessibilityLabel="Operational report description"
                />
              </>
            )}
            {reportType === 'inspection' && (
              <AppTextInput
                style={[styles.reportInput, styles.reportDescriptionInput]}
                placeholder="Inspection notes or defects (optional)"
                placeholderTextColor={Monochrome.textMuted}
                value={reportDescription}
                onChangeText={setReportDescription}
                multiline
                accessibilityLabel="Inspection notes"
              />
            )}
            <AppTextInput
              style={styles.reportInput}
              placeholder="Odometer reading in km (optional)"
              placeholderTextColor={Monochrome.textMuted}
              value={reportOdometer}
              onChangeText={setReportOdometer}
              keyboardType="decimal-pad"
              accessibilityLabel="Odometer reading in kilometres"
            />
            {reportError ? <AppText style={styles.reportError}>{reportError}</AppText> : null}
            <Pressable
              accessibilityRole="button"
              disabled={reportSubmitting}
              onPress={() => void submitOperationalReport()}
              style={styles.reportSubmitButton}
            >
              {reportSubmitting
                ? <ActivityIndicator color={Monochrome.actionPrimaryText} />
                : <AppText style={styles.reportSubmitText}>Submit report</AppText>}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={fuelModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setFuelModalVisible(false)}
      >
        <View style={styles.reportModalOverlay}>
          <View style={[styles.reportModalContent, { paddingBottom: insets.bottom + Spacing.lg }]}>
            <View style={styles.sectionHeaderRow}>
              <AppText style={styles.reportModalTitle}>Record fuel expense</AppText>
              <Pressable accessibilityRole="button" onPress={() => setFuelModalVisible(false)}>
                <AppText style={styles.refreshLink}>Close</AppText>
              </Pressable>
            </View>
            <AppText style={styles.reportModalHint}>
              The server assigns this to your active vehicle and checks the odometer history.
            </AppText>
            <AppTextInput
              style={styles.reportInput}
              placeholder="Amount in NPR"
              placeholderTextColor={Monochrome.textMuted}
              value={fuelAmount}
              onChangeText={setFuelAmount}
              keyboardType="decimal-pad"
              accessibilityLabel="Fuel expense amount in rupees"
            />
            <AppTextInput
              style={styles.reportInput}
              placeholder="Fuel quantity in litres"
              placeholderTextColor={Monochrome.textMuted}
              value={fuelLiters}
              onChangeText={setFuelLiters}
              keyboardType="decimal-pad"
              accessibilityLabel="Fuel quantity in litres"
            />
            <AppTextInput
              style={styles.reportInput}
              placeholder="Odometer in km"
              placeholderTextColor={Monochrome.textMuted}
              value={fuelOdometer}
              onChangeText={setFuelOdometer}
              keyboardType="decimal-pad"
              accessibilityLabel="Fuel odometer in kilometres"
            />
            <AppTextInput
              style={styles.reportInput}
              placeholder="Fuel station (optional)"
              placeholderTextColor={Monochrome.textMuted}
              value={fuelStation}
              onChangeText={setFuelStation}
              accessibilityLabel="Fuel station name"
            />
            {fuelError ? <AppText style={styles.reportError}>{fuelError}</AppText> : null}
            <Pressable
              accessibilityRole="button"
              disabled={fuelSubmitting}
              onPress={() => void submitFuelExpense()}
              style={styles.reportSubmitButton}
            >
              {fuelSubmitting
                ? <ActivityIndicator color={Monochrome.actionPrimaryText} />
                : <AppText style={styles.reportSubmitText}>Save fuel expense</AppText>}
            </Pressable>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Monochrome.border,
    backgroundColor: Monochrome.background,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  appBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Monochrome.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Monochrome.textSecondary,
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notificationButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Monochrome.surfaceSecondary,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Monochrome.actionPrimary,
  },
  notificationBadgeText: {
    color: Monochrome.actionPrimaryText,
    fontSize: 9,
    fontWeight: '700',
  },
  gpsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  gpsPillLive: {
    backgroundColor: Monochrome.surfaceElevated,
    borderColor: Monochrome.border,
  },
  gpsDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Monochrome.textMuted,
  },
  gpsDotLive: {
    backgroundColor: Monochrome.textPrimary,
  },
  gpsPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: Monochrome.textPrimary,
  },
  avatarButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Monochrome.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  contentArea: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  errorNotice: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
    padding: Spacing.md,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorNoticeText: {
    color: Monochrome.textPrimary,
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  retryNoticeText: {
    color: Monochrome.textSecondary,
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 10,
  },
  busBanner: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 18,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  busTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  busIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busInfo: {
    flex: 1,
    gap: 2,
  },
  busLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Monochrome.textMuted,
    letterSpacing: 0.5,
  },
  busNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  busReg: {
    fontSize: 12,
    color: Monochrome.textSecondary,
  },
  busStatusPill: {
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  busStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  driverActionsCard: {
    gap: 12,
  },
  reportActionsCard: {
    gap: 10,
    padding: Spacing.lg,
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
    borderRadius: 18,
  },
  reportActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  reportActionButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: 12,
    backgroundColor: Monochrome.surfaceElevated,
    gap: 5,
  },
  reportActionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  reportActionSubtitle: {
    fontSize: 11,
    color: Monochrome.textSecondary,
  },
  reportHistoryCard: {
    padding: Spacing.md,
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
    borderRadius: 14,
    gap: 6,
  },
  reportHistoryTitle: {
    color: Monochrome.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  reportHistoryStatus: {
    color: Monochrome.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  reportHistoryMeta: {
    color: Monochrome.textMuted,
    fontSize: 11,
  },
  scanQrPrimaryBtn: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 18,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  scanQrIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Monochrome.actionPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanQrBtnTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  scanQrBtnSub: {
    fontSize: 12,
    color: Monochrome.textSecondary,
    marginTop: 2,
  },
  tripsSection: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  refreshLink: {
    fontSize: 13,
    color: Monochrome.textSecondary,
    fontWeight: '600',
  },
  loadingBox: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: 14,
    color: Monochrome.textSecondary,
  },
  tripCard: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 18,
    padding: Spacing.lg,
    gap: 12,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routePill: {
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  routePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  routeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Monochrome.textPrimary,
    flex: 1,
  },
  tripStatusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  tripStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  tripTime: {
    fontSize: 12,
    color: Monochrome.textMuted,
  },
  tripActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  btnAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnStart: {
    backgroundColor: Monochrome.actionPrimary,
  },
  btnActionStartText: {
    fontSize: 13,
    fontWeight: '700',
    color: Monochrome.actionPrimaryText,
  },
  btnSecondaryAction: {
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  btnActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Monochrome.textPrimary,
  },
  reportModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  reportModalContent: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: Monochrome.background,
  },
  reportModalTitle: {
    color: Monochrome.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  reportModalHint: {
    color: Monochrome.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  reportTypeChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reportTypeChoice: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Monochrome.border,
    backgroundColor: Monochrome.surfaceSecondary,
  },
  reportTypeChoiceActive: {
    backgroundColor: Monochrome.surfaceElevated,
  },
  reportTypeChoiceText: {
    color: Monochrome.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  checklistCard: {
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Monochrome.border,
    borderRadius: 12,
    backgroundColor: Monochrome.surfaceSecondary,
  },
  checklistRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Monochrome.border,
  },
  checklistLabel: {
    color: Monochrome.textPrimary,
    fontSize: 13,
    textTransform: 'capitalize',
  },
  reportInput: {
    minHeight: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Monochrome.border,
    color: Monochrome.textPrimary,
    backgroundColor: Monochrome.surfaceSecondary,
  },
  reportDescriptionInput: {
    minHeight: 92,
    paddingTop: Spacing.md,
    textAlignVertical: 'top',
  },
  reportError: {
    color: Monochrome.textPrimary,
    fontSize: 12,
  },
  reportSubmitButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: Monochrome.actionPrimary,
  },
  reportSubmitText: {
    color: Monochrome.actionPrimaryText,
    fontSize: 14,
    fontWeight: '700',
  },
  completedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  completedNoticeText: {
    fontSize: 13,
    color: Monochrome.textSecondary,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 18,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  emptySub: {
    fontSize: 13,
    color: Monochrome.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  routeHeaderCard: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 18,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Monochrome.border,
    gap: 4,
  },
  routeHeaderName: {
    fontSize: 18,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  routeHeaderCode: {
    fontSize: 13,
    color: Monochrome.textSecondary,
    fontWeight: '600',
  },
  routeHeaderBus: {
    fontSize: 12,
    color: Monochrome.textMuted,
    marginTop: 4,
  },
  stopsListCard: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 18,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Monochrome.border,
    gap: 12,
  },
  stopsListTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  stopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Monochrome.border,
  },
  stopSequenceCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopSequenceText: {
    fontSize: 11,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  stopName: {
    fontSize: 14,
    fontWeight: '600',
    color: Monochrome.textPrimary,
  },
  stopCoords: {
    fontSize: 11,
    color: Monochrome.textMuted,
  },
  ticketCard: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Monochrome.border,
    gap: 6,
  },
  ticketCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  ticketStatusBadge: {
    backgroundColor: Monochrome.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  ticketStatusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  ticketCardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  ticketPassenger: {
    fontSize: 14,
    fontWeight: '600',
    color: Monochrome.textSecondary,
  },
  ticketFare: {
    fontSize: 16,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  ticketCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  ticketMeta: {
    fontSize: 11,
    color: Monochrome.textMuted,
  },
  profileHeaderCard: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 18,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Monochrome.border,
    gap: 6,
  },
  profileAvatarLarge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Monochrome.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Monochrome.border,
    marginBottom: 4,
  },
  profileAvatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  profileRole: {
    fontSize: 13,
    color: Monochrome.textSecondary,
  },
  companyTagPill: {
    backgroundColor: Monochrome.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Monochrome.border,
    marginTop: 4,
  },
  companyTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: Monochrome.textSecondary,
  },
  detailsCard: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 18,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Monochrome.border,
    gap: 12,
  },
  detailsCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Monochrome.textPrimary,
    marginBottom: 4,
  },
  securitySettingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    marginTop: 14,
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  securitySettingsIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Monochrome.surfaceElevated,
  },
  securitySettingsCopy: { flex: 1, gap: 3 },
  securitySettingsTitle: { color: Monochrome.textPrimary, fontSize: 14, fontWeight: '700' },
  securitySettingsDescription: { color: Monochrome.textSecondary, fontSize: 12, lineHeight: 16 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: Monochrome.border,
  },
  detailLabel: {
    fontSize: 13,
    color: Monochrome.textMuted,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Monochrome.textPrimary,
  },
  logoutButton: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
    borderRadius: 14,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: Monochrome.surfacePrimary,
    borderTopWidth: 1,
    borderTopColor: Monochrome.border,
    paddingTop: 10,
    paddingHorizontal: 8,
  },
  bottomTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  bottomTabActive: {},
  bottomQrIcon: {
    width: 48,
    height: 48,
    marginTop: -22,
    borderRadius: 24,
    backgroundColor: '#0F766E',
    borderWidth: 4,
    borderColor: '#F5F7F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomTabText: {
    fontSize: 11,
    fontWeight: '500',
    color: Monochrome.textMuted,
  },
  bottomTabTextActive: {
    color: Monochrome.textPrimary,
    fontWeight: '700',
  },
});
