import {AppText, AppTextInput } from '@/components/typography/app-text';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { Brand } from '@/constants/theme';
import {
  activateCompanyFareRule,
  cancelCompanyTrip,
  deleteCompanyFareRule,
  getCompanyAssignments,
  getCompanyBuses,
  getCompanyDashboard,
  getCompanyDriverReports,
  getCompanyDrivers,
  getCompanyFares,
  getCompanyNotifications,
  getCompanyProfile,
  getCompanyReports,
  getCompanyRoutes,
  getCompanySettlements,
  getCompanyTaps,
  getCompanyTrips,
  getLiveCompanyBuses,
  storeCompanyAssignment,
  storeCompanyBus,
  storeCompanyDriver,
  storeCompanyFareRule,
  storeCompanyRoute,
  storeCompanyTrip,
  updateCompanyDriverStatus,
  updateCompanyDriverReportStatus,
  updateCompanyProfile,
  type CompanyAssignment,
  type CompanyBus,
  type CompanyDashboardData,
  type CompanyDriver,
  type CompanyDriverReport,
  type CompanyLiveBus,
  type CompanyNotification,
  type CompanyProfile,
  type CompanyReportsData,
  type CompanyRoute,
  type CompanySettlement,
  type CompanyTap,
  type CompanyTrip,
  type PlatformListQuery,
} from '@/features/admin/services/adminApi';
import { getMe, logout } from '@/features/auth/services/auth';
import { getSession, setSession, type SessionUser } from '@/features/auth/session';
import { useNotificationCount } from '@/features/notifications/useNotificationCount';
import { searchStops, type PublicStop } from '@/features/transit/services/transitApi';

type DashboardPeriod = 'today' | '7d' | '30d';
type MainTab = 'home' | 'operations' | 'fleet' | 'reports' | 'account';

function dateForApi(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function companyDateRange(period: DashboardPeriod) {
  const to = new Date();
  const from = new Date(to);
  from.setHours(0, 0, 0, 0);
  if (period === '7d') from.setDate(from.getDate() - 6);
  if (period === '30d') from.setDate(from.getDate() - 29);
  return { date_from: dateForApi(from), date_to: dateForApi(to) };
}

function nextCursor(meta?: Record<string, unknown>): string | null {
  return typeof meta?.next_cursor === 'string' ? meta.next_cursor : null;
}

export default function CompanyPortalScreen() {
  const insets = useSafeAreaInsets();
  const { unreadCount: accountUnreadCount } = useNotificationCount();
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(() => getSession().user);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);

  // Main navigation & sub-navigation state
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('home');
  const [operationsSubTab, setOperationsSubTab] = useState<'trips' | 'live' | 'fares'>('trips');
  const [fleetSubTab, setFleetSubTab] = useState<'buses' | 'drivers' | 'assignments' | 'routes'>('buses');
  const [reportsSubTab, setReportsSubTab] = useState<'summary' | 'taps' | 'settlements' | 'driver-reports'>('summary');

  // Loading & error states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [period, setPeriod] = useState<DashboardPeriod>('today');

  // Core data states
  const [dashboard, setDashboard] = useState<CompanyDashboardData | null>(null);
  const [buses, setBuses] = useState<CompanyBus[]>([]);
  const [drivers, setDrivers] = useState<CompanyDriver[]>([]);
  const [assignments, setAssignments] = useState<CompanyAssignment[]>([]);
  const [routes, setRoutes] = useState<CompanyRoute[]>([]);
  const [settlements, setSettlements] = useState<CompanySettlement[]>([]);
  const [liveBuses, setLiveBuses] = useState<CompanyLiveBus[]>([]);
  const [trips, setTrips] = useState<CompanyTrip[]>([]);
  const [taps, setTaps] = useState<CompanyTap[]>([]);
  const [fares, setFares] = useState<Record<string, unknown>[]>([]);
  const [notifications, setNotifications] = useState<CompanyNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [reportsData, setReportsData] = useState<CompanyReportsData | null>(null);
  const [driverReports, setDriverReports] = useState<CompanyDriverReport[]>([]);
  const [driverReportsError, setDriverReportsError] = useState<string | null>(null);
  const [driverReportBusyId, setDriverReportBusyId] = useState<number | null>(null);

  // Pagination cursors
  const [tripCursor, setTripCursor] = useState<string | null>(null);
  const [tapCursor, setTapCursor] = useState<string | null>(null);
  const [moreBusy, setMoreBusy] = useState(false);

  // Filters
  const [tripStatusFilter, setTripStatusFilter] = useState<'all' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled'>('all');
  const [tapStatusFilter, setTapStatusFilter] = useState<'all' | 'success' | 'failed'>('all');

  // Notification Sheet Modal
  const [notificationsVisible, setNotificationsVisible] = useState(false);

  // Company Contact Editing
  const [editingCompany, setEditingCompany] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');

  // Modals
  // 1. Add Bus Modal
  const [busModalVisible, setBusModalVisible] = useState(false);
  const [busNumber, setBusNumber] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [capacity, setCapacity] = useState('45');
  const [vehicleType, setVehicleType] = useState('bus');
  const [addingBus, setAddingBus] = useState(false);

  // 2. Add Driver Modal
  const [driverModalVisible, setDriverModalVisible] = useState(false);
  const [driverUserId, setDriverUserId] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [addingDriver, setAddingDriver] = useState(false);

  // 3. Assign Driver to Bus Modal
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignBusId, setAssignBusId] = useState<number | null>(null);
  const [assignDriverId, setAssignDriverId] = useState<number | null>(null);
  const [assignRole, setAssignRole] = useState<'primary' | 'relief'>('primary');
  const [assigning, setAssigning] = useState(false);

  // 4. Schedule Trip Modal
  const [tripModalVisible, setTripModalVisible] = useState(false);
  const [tripBusId, setTripBusId] = useState<number | null>(null);
  const [tripRouteId, setTripRouteId] = useState<number | null>(null);
  const [tripDriverId, setTripDriverId] = useState<number | null>(null);
  const [tripDirection, setTripDirection] = useState<'outbound' | 'inbound' | 'circular'>('outbound');
  const [tripTime, setTripTime] = useState('');
  const [schedulingTrip, setSchedulingTrip] = useState(false);

  // 5. Add Route Modal
  const [routeModalVisible, setRouteModalVisible] = useState(false);
  const [routeCode, setRouteCode] = useState('');
  const [routeName, setRouteName] = useState('');
  const [distanceKm, setDistanceKm] = useState('15');
  const [estMinutes, setEstMinutes] = useState('45');
  const [addingRoute, setAddingRoute] = useState(false);
  const [originStopQuery, setOriginStopQuery] = useState('');
  const [destinationStopQuery, setDestinationStopQuery] = useState('');
  const [originStop, setOriginStop] = useState<PublicStop | null>(null);
  const [destinationStop, setDestinationStop] = useState<PublicStop | null>(null);
  const [originStopMatches, setOriginStopMatches] = useState<PublicStop[]>([]);
  const [destinationStopMatches, setDestinationStopMatches] = useState<PublicStop[]>([]);
  const [stopSearchBusy, setStopSearchBusy] = useState(false);

  // 6. Add Fare Rule Modal
  const [fareModalVisible, setFareModalVisible] = useState(false);
  const [fareName, setFareName] = useState('');
  const [fareType, setFareType] = useState('flat');
  const [fareAmount, setFareAmount] = useState('25');
  const [fareRouteId, setFareRouteId] = useState<number | null>(null);
  const [addingFare, setAddingFare] = useState(false);

  // Data loading
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);

    try {
      const range = companyDateRange(period);
      const dateQuery: PlatformListQuery = { dateFrom: range.date_from, dateTo: range.date_to };

      const [
        dashRes,
        compRes,
        userRes,
        busesRes,
        driversRes,
        assignRes,
        routesRes,
        setsRes,
        liveRes,
        tripsRes,
        tapsRes,
        faresRes,
        notifsRes,
        reportsRes,
        driverReportsRes,
      ] = await Promise.all([
        getCompanyDashboard(range),
        getCompanyProfile(),
        getMe(),
        getCompanyBuses(),
        getCompanyDrivers(),
        getCompanyAssignments(),
        getCompanyRoutes(),
        getCompanySettlements(),
        getLiveCompanyBuses(),
        getCompanyTrips(dateQuery),
        getCompanyTaps(dateQuery),
        getCompanyFares(),
        getCompanyNotifications(),
        getCompanyReports(range),
        getCompanyDriverReports({ perPage: 100 }),
      ]);

      if (dashRes.ok && dashRes.data) setDashboard(dashRes.data);
      else if (!dashRes.ok) setLoadError(dashRes.message || 'Could not load company dashboard.');

      if (compRes.ok && compRes.data) {
        setCompanyProfile(compRes.data);
        setCompanyEmail(compRes.data.contact.email ?? '');
        setCompanyPhone(compRes.data.contact.phone ?? '');
        setCompanyAddress(compRes.data.contact.address ?? '');
      }

      if (userRes.ok && userRes.data) {
        setCurrentUser(userRes.data);
        await setSession({ user: userRes.data });
      }

      if (busesRes.ok && busesRes.data) setBuses(busesRes.data.buses || []);
      if (driversRes.ok && driversRes.data) setDrivers(driversRes.data.drivers || []);
      if (assignRes.ok && assignRes.data) setAssignments(assignRes.data.assignments || []);
      if (routesRes.ok && routesRes.data) setRoutes(routesRes.data.routes || []);
      if (setsRes.ok && setsRes.data) setSettlements(setsRes.data.settlements || []);
      if (liveRes.ok && liveRes.data) setLiveBuses(liveRes.data.buses || []);

      if (tripsRes.ok && tripsRes.data) {
        setTrips(tripsRes.data.trips || []);
        setTripCursor(nextCursor(tripsRes.meta));
      }

      if (tapsRes.ok && tapsRes.data) {
        setTaps(tapsRes.data.taps || []);
        setTapCursor(nextCursor(tapsRes.meta));
      }

      if (faresRes.ok && faresRes.data) setFares(faresRes.data.fares || []);

      if (notifsRes.ok && notifsRes.data) {
        setNotifications(notifsRes.data.notifications || []);
        setUnreadCount(notifsRes.data.unread_count || 0);
      }

      if (reportsRes.ok && reportsRes.data) {
        setReportsData(reportsRes.data);
      }
      if (driverReportsRes.ok && driverReportsRes.data) {
        setDriverReports(driverReportsRes.data.reports);
        setDriverReportsError(null);
      } else if (!driverReportsRes.ok) {
        setDriverReportsError(driverReportsRes.message || 'Could not load driver reports.');
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load company operations.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadData();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadData]);

  // Load more pagination
  const loadMore = async (kind: 'trips' | 'taps') => {
    const cursor = kind === 'trips' ? tripCursor : tapCursor;
    if (!cursor || moreBusy) return;
    setMoreBusy(true);
    try {
      const range = companyDateRange(period);
      const query: PlatformListQuery = {
        cursor,
        dateFrom: range.date_from,
        dateTo: range.date_to,
        status: kind === 'trips' && tripStatusFilter !== 'all' ? tripStatusFilter : undefined,
      };

      if (kind === 'trips') {
        const result = await getCompanyTrips(query);
        if (result.ok && result.data) {
          setTrips((prev) => [...prev, ...result.data.trips]);
          setTripCursor(nextCursor(result.meta));
        }
      } else {
        const result = await getCompanyTaps(query);
        if (result.ok && result.data) {
          setTaps((prev) => [...prev, ...result.data.taps]);
          setTapCursor(nextCursor(result.meta));
        }
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load more.');
    } finally {
      setMoreBusy(false);
    }
  };

  const handleDriverReportStatus = async (report: CompanyDriverReport, status: 'acknowledged' | 'resolved') => {
    setDriverReportBusyId(report.id);
    try {
      const result = await updateCompanyDriverReportStatus(report.id, status);
      if (!result.ok || !result.data) {
        Alert.alert('Report not updated', result.message || 'Please try again.');
        return;
      }
      setDriverReports((current) => current.map((item) => item.id === report.id ? result.data.report : item));
    } catch (error) {
      Alert.alert('Report not updated', error instanceof Error ? error.message : 'Network error.');
    } finally {
      setDriverReportBusyId(null);
    }
  };

  // Logout implementation with confirmation
  const confirmLogout = useCallback(() => {
    Alert.alert(
      'Sign Out of Tap & Pay',
      'Are you sure you want to sign out of this Company Admin account? Your local session will be securely cleared.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await logout();
            } catch {
              router.replace('/login');
            }
          },
        },
      ],
    );
  }, []);

  // Save Company Contacts
  const handleSaveCompanyContact = async () => {
    setSavingCompany(true);
    try {
      const result = await updateCompanyProfile({
        contact_email: companyEmail.trim() || null,
        contact_phone: companyPhone.trim() || null,
        address: companyAddress.trim() || null,
      });
      if (result.ok && result.data) {
        setCompanyProfile(result.data);
        setEditingCompany(false);
        Alert.alert('Company profile updated', 'Your company contact details were saved successfully.');
      } else {
        Alert.alert('Update failed', result.message || 'Could not update company details.');
      }
    } catch {
      Alert.alert('Error', 'Unable to update company details.');
    } finally {
      setSavingCompany(false);
    }
  };

  // Add Bus
  const handleAddBus = async () => {
    if (!busNumber.trim() || !regNumber.trim() || !capacity.trim()) {
      Alert.alert('Validation Error', 'Please enter bus number, registration number and capacity.');
      return;
    }
    const capNum = parseInt(capacity, 10);
    if (isNaN(capNum) || capNum < 1 || capNum > 150) {
      Alert.alert('Validation Error', 'Capacity must be a number between 1 and 150.');
      return;
    }

    setAddingBus(true);
    try {
      const res = await storeCompanyBus({
        bus_number: busNumber.trim(),
        registration_number: regNumber.trim().toUpperCase(),
        capacity: capNum,
        vehicle_type: vehicleType,
      });
      if (res.ok) {
        setBusNumber('');
        setRegNumber('');
        setCapacity('45');
        setBusModalVisible(false);
        Alert.alert('Success', 'Bus registered successfully.');
        await loadData(true);
      } else {
        Alert.alert('Registration Failed', res.message || 'Could not register bus.');
      }
    } catch {
      Alert.alert('Error', 'Connection failure while adding bus.');
    } finally {
      setAddingBus(false);
    }
  };

  // Add Driver
  const handleAddDriver = async () => {
    if (!driverUserId.trim() || !licenseNumber.trim()) {
      Alert.alert('Validation Error', 'Please enter driver User ID and License Number.');
      return;
    }
    const uId = parseInt(driverUserId, 10);
    if (isNaN(uId)) {
      Alert.alert('Validation Error', 'User ID must be an integer.');
      return;
    }

    setAddingDriver(true);
    try {
      const res = await storeCompanyDriver({
        user_id: uId,
        license_number: licenseNumber.trim().toUpperCase(),
      });
      if (res.ok) {
        setDriverUserId('');
        setLicenseNumber('');
        setDriverModalVisible(false);
        Alert.alert('Driver Added', 'Driver account assigned to company successfully.');
        await loadData(true);
      } else {
        Alert.alert('Assignment Failed', res.message || 'Could not assign driver.');
      }
    } catch {
      Alert.alert('Error', 'Connection failure while assigning driver.');
    } finally {
      setAddingDriver(false);
    }
  };

  // Toggle Driver Status (Active/Suspended)
  const handleToggleDriverStatus = (driver: CompanyDriver) => {
    const nextStatus = driver.status === 'active' ? 'suspended' : 'active';
    Alert.alert(
      `${nextStatus === 'suspended' ? 'Suspend' : 'Activate'} Driver`,
      `Are you sure you want to ${nextStatus === 'suspended' ? 'suspend' : 'activate'} ${driver.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: nextStatus === 'suspended' ? 'Suspend Driver' : 'Activate Driver',
          style: nextStatus === 'suspended' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const res = await updateCompanyDriverStatus(driver.id, nextStatus as any);
              if (res.ok) {
                Alert.alert('Status Updated', `Driver is now ${nextStatus}.`);
                await loadData(true);
              } else {
                Alert.alert('Update Failed', res.message || 'Could not update driver status.');
              }
            } catch {
              Alert.alert('Error', 'Connection failure while updating driver status.');
            }
          },
        },
      ],
    );
  };

  // Assign Driver to Bus
  const handleAssignDriver = async () => {
    if (!assignBusId || !assignDriverId) {
      Alert.alert('Validation Error', 'Please select both a bus and a driver.');
      return;
    }

    setAssigning(true);
    try {
      const res = await storeCompanyAssignment({
        bus_id: assignBusId,
        driver_id: assignDriverId,
        role: assignRole,
      });
      if (res.ok) {
        setAssignBusId(null);
        setAssignDriverId(null);
        setAssignModalVisible(false);
        Alert.alert('Assignment Saved', 'Driver has been assigned to the bus roster.');
        await loadData(true);
      } else {
        Alert.alert('Assignment Failed', res.message || 'Could not assign driver to bus.');
      }
    } catch {
      Alert.alert('Error', 'Connection failure while assigning driver.');
    } finally {
      setAssigning(false);
    }
  };

  // Schedule Trip
  const handleScheduleTrip = async () => {
    if (!tripBusId || !tripRouteId || !tripDriverId) {
      Alert.alert('Validation Error', 'Please select a bus, route, and driver.');
      return;
    }
    const departure = tripTime.trim() || new Date().toISOString();

    setSchedulingTrip(true);
    try {
      const res = await storeCompanyTrip({
        bus_id: tripBusId,
        route_id: tripRouteId,
        driver_id: tripDriverId,
        direction: tripDirection,
        scheduled_departure: departure,
      });
      if (res.ok) {
        setTripBusId(null);
        setTripRouteId(null);
        setTripDriverId(null);
        setTripTime('');
        setTripModalVisible(false);
        Alert.alert('Trip Scheduled', 'Trip has been added to operational dispatch.');
        await loadData(true);
      } else {
        Alert.alert('Scheduling Failed', res.message || 'Could not schedule trip.');
      }
    } catch {
      Alert.alert('Error', 'Connection failure while scheduling trip.');
    } finally {
      setSchedulingTrip(false);
    }
  };

  // Cancel Trip
  const handleCancelTrip = (trip: CompanyTrip) => {
    Alert.alert(
      'Cancel Trip',
      `Are you sure you want to cancel trip ${trip.reference}?`,
      [
        { text: 'No, Keep Trip', style: 'cancel' },
        {
          text: 'Cancel Trip',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await cancelCompanyTrip(trip.id);
              if (res.ok) {
                Alert.alert('Trip Cancelled', 'The trip has been cancelled.');
                await loadData(true);
              } else {
                Alert.alert('Cancellation Failed', res.message || 'Could not cancel trip.');
              }
            } catch {
              Alert.alert('Error', 'Connection failure while cancelling trip.');
            }
          },
        },
      ],
    );
  };

  // Stop Search for Route creation
  const findStops = async (query: string, field: 'origin' | 'destination') => {
    const term = query.trim();
    if (term.length < 2) {
      Alert.alert('Stop Search', 'Enter at least 2 characters to search stops.');
      return;
    }
    setStopSearchBusy(true);
    try {
      const res = await searchStops(term);
      if (res.ok && res.data) {
        if (field === 'origin') setOriginStopMatches(res.data.stops);
        else setDestinationStopMatches(res.data.stops);
      } else {
        Alert.alert('No Stops Found', res.message || 'Try a different stop name.');
      }
    } catch {
      Alert.alert('Error', 'Failed to search stops.');
    } finally {
      setStopSearchBusy(false);
    }
  };

  // Add Route
  const handleAddRoute = async () => {
    if (!routeCode.trim() || !routeName.trim()) {
      Alert.alert('Validation Error', 'Please enter route code and route name.');
      return;
    }
    if (!originStop || !destinationStop) {
      Alert.alert('Validation Error', 'Please select both origin and destination stops.');
      return;
    }
    if (originStop.id === destinationStop.id) {
      Alert.alert('Validation Error', 'Origin and destination stops must be different.');
      return;
    }

    setAddingRoute(true);
    try {
      const res = await storeCompanyRoute({
        code: routeCode.trim().toUpperCase(),
        name: routeName.trim(),
        origin_stop_id: originStop.id,
        destination_stop_id: destinationStop.id,
        distance_km: parseFloat(distanceKm) || 10,
        estimated_minutes: parseInt(estMinutes, 10) || 30,
      });
      if (res.ok) {
        setRouteCode('');
        setRouteName('');
        setOriginStop(null);
        setDestinationStop(null);
        setOriginStopQuery('');
        setDestinationStopQuery('');
        setRouteModalVisible(false);
        Alert.alert('Route Created', 'New route added to company network.');
        await loadData(true);
      } else {
        Alert.alert('Creation Failed', res.message || 'Could not create route.');
      }
    } catch {
      Alert.alert('Error', 'Connection failure while creating route.');
    } finally {
      setAddingRoute(false);
    }
  };

  // Add Fare Rule
  const handleAddFareRule = async () => {
    if (!fareName.trim()) {
      Alert.alert('Validation Error', 'Please enter a fare rule name.');
      return;
    }
    const amt = parseFloat(fareAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid fare amount.');
      return;
    }

    setAddingFare(true);
    try {
      const res = await storeCompanyFareRule({
        name: fareName.trim(),
        type: fareType,
        amount_minor: Math.round(amt * 100),
        route_id: fareRouteId,
      });
      if (res.ok) {
        setFareName('');
        setFareAmount('25');
        setFareRouteId(null);
        setFareModalVisible(false);
        Alert.alert('Fare Rule Created', 'New fare policy created.');
        await loadData(true);
      } else {
        Alert.alert('Creation Failed', res.message || 'Could not create fare rule.');
      }
    } catch {
      Alert.alert('Error', 'Connection failure while creating fare rule.');
    } finally {
      setAddingFare(false);
    }
  };

  // Activate / Delete Fare Rule
  const handleActivateFare = async (fareId: number) => {
    try {
      const res = await activateCompanyFareRule(fareId);
      if (res.ok) {
        Alert.alert('Rule Activated', 'Fare rule is now active.');
        await loadData(true);
      } else {
        Alert.alert('Activation Failed', res.message || 'Could not activate fare rule.');
      }
    } catch {
      Alert.alert('Error', 'Connection failure.');
    }
  };

  const handleDeleteFare = (fareId: number) => {
    Alert.alert('Delete Fare Rule', 'Are you sure you want to delete this fare rule?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await deleteCompanyFareRule(fareId);
            if (res.ok) {
              Alert.alert('Deleted', 'Fare rule removed.');
              await loadData(true);
            } else {
              Alert.alert('Delete Failed', res.message || 'Could not delete rule.');
            }
          } catch {
            Alert.alert('Error', 'Connection failure.');
          }
        },
      },
    ]);
  };

  // Filtered trips
  const filteredTrips = useMemo(() => {
    if (tripStatusFilter === 'all') return trips;
    return trips.filter((t) => t.status === tripStatusFilter);
  }, [trips, tripStatusFilter]);

  // Filtered taps
  const filteredTaps = useMemo(() => {
    if (tapStatusFilter === 'all') return taps;
    return taps.filter((t) => t.status === tapStatusFilter);
  }, [taps, tapStatusFilter]);

  // Company and user display info
  const companyDisplayName = companyProfile?.name || 'Transport Company';
  const companyDisplayCode = companyProfile?.code || 'FLEET';
  const userInitials = (currentUser?.name || 'CA').slice(0, 2).toUpperCase();

  return (
    <View style={[styles.rootContainer, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* ---------------- PERSISTENT HEADER ---------------- */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.brandBadge}>
            <SymbolView
              name={{ ios: 'bus.fill', android: 'directions_bus', web: 'directions_bus' }}
              size={18}
              tintColor={Brand.teal.primary}
            />
          </View>
          <View style={styles.headerTitles}>
            <View style={styles.titleRow}>
              <AppText style={styles.headerAppName}>TAP &amp; PAY</AppText>
              <View style={styles.portalTag}>
                <AppText style={styles.portalTagText}>COMPANY ADMIN</AppText>
              </View>
            </View>
            <AppText style={styles.headerCompanyName} numberOfLines={1}>
              {companyDisplayName} ({companyDisplayCode})
            </AppText>
          </View>
        </View>

        <View style={styles.headerRight}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Account notifications${accountUnreadCount > 0 ? `, ${accountUnreadCount} unread` : ''}`}
            onPress={() => router.push('/notifications' as Href)}
            style={styles.headerIconButton}
            hitSlop={8}
          >
            <SymbolView
              name={{ ios: 'bell.badge.fill', android: 'notifications_active', web: 'notifications_active' }}
              size={20}
              tintColor={Brand.teal.primary}
            />
            {accountUnreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <AppText style={styles.unreadBadgeText}>
                  {accountUnreadCount > 9 ? '9+' : accountUnreadCount}
                </AppText>
              </View>
            )}
          </Pressable>
          {/* Notifications Button with Red Badge */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            onPress={() => setNotificationsVisible(true)}
            style={styles.headerIconButton}
            hitSlop={8}
          >
            <SymbolView
              name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
              size={20}
              tintColor={Brand.teal.primary}
            />
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <AppText style={styles.unreadBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</AppText>
              </View>
            )}
          </Pressable>

          {/* Profile Avatar Button -> opens Account tab */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="My Account"
            onPress={() => setActiveMainTab('account')}
            style={[styles.avatarButton, activeMainTab === 'account' && styles.avatarButtonActive]}
            hitSlop={8}
          >
            <AppText style={styles.avatarButtonText}>{userInitials}</AppText>
          </Pressable>
        </View>
      </View>

      {/* ---------------- MAIN CONTENT AREA ---------------- */}
      <ScrollView
        contentContainerStyle={[styles.mainScroll, { paddingBottom: insets.bottom + 85 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={Brand.teal.primary} />
        }
      >
        {loadError && (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <SymbolView
              name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
              size={20}
              tintColor={Brand.teal.primary}
            />
            <View style={styles.errorTextContainer}>
              <AppText style={styles.errorBannerTitle}>Unable to sync company data</AppText>
              <AppText style={styles.errorBannerMessage}>{loadError}</AppText>
            </View>
            <Pressable onPress={() => void loadData(true)} style={styles.retryBtn}>
              <AppText style={styles.retryBtnText}>Retry</AppText>
            </Pressable>
          </View>
        )}

        {loading && !refreshing && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Brand.textSecondary} />
            <AppText style={styles.loadingMessage}>Loading fleet operations...</AppText>
          </View>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: HOME (OPERATIONAL DASHBOARD)                                       */}
        {/* ========================================================================= */}
        {activeMainTab === 'home' && dashboard && (
          <View style={styles.tabContent}>
            {/* Top Period Selector */}
            <View style={styles.sectionHeaderRow}>
              <View>
                <AppText style={styles.pageTitle}>Fleet Overview</AppText>
                <AppText style={styles.pageSubtitle}>Live operations &amp; fare aggregates</AppText>
              </View>
              <View style={styles.periodPicker}>
                {(['today', '7d', '30d'] as const).map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => setPeriod(p)}
                    style={[styles.periodOption, period === p && styles.periodOptionActive]}
                  >
                    <AppText style={[styles.periodOptionText, period === p && styles.periodOptionTextActive]}>
                      {p === 'today' ? 'Today' : p === '7d' ? '7 Days' : '30 Days'}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Stale GPS Warning Banner */}
            {(dashboard.fleet.buses.stale ?? 0) > 0 && (
              <Pressable
                onPress={() => {
                  setActiveMainTab('operations');
                  setOperationsSubTab('live');
                }}
                style={styles.staleAlertCard}
              >
                <View style={styles.staleAlertIcon}>
                  <SymbolView
                    name={{ ios: 'location.slash.fill', android: 'location_off', web: 'location_off' }}
                    size={20}
                    tintColor={Brand.teal.primary}
                  />
                </View>
                <View style={styles.staleAlertContent}>
                  <AppText style={styles.staleAlertTitle}>
                    {dashboard.fleet.buses.stale} Bus(es) with Stale GPS
                  </AppText>
                  <AppText style={styles.staleAlertSub}>
                    GPS locations have not refreshed within the configured platform threshold. Tap to view live fleet.
                  </AppText>
                </View>
              </Pressable>
            )}

            {/* Quick Action Buttons */}
            <View style={styles.quickActionsRow}>
              <Pressable
                onPress={() => setTripModalVisible(true)}
                style={styles.quickActionButton}
              >
                <SymbolView
                  name={{ ios: 'clock.badge.checkmark.fill', android: 'schedule', web: 'schedule' }}
                  size={18}
                  tintColor={Brand.teal.primary}
                />
                <AppText style={styles.quickActionLabel}>Schedule Trip</AppText>
              </Pressable>

              <Pressable
                onPress={() => setBusModalVisible(true)}
                style={styles.quickActionButton}
              >
                <SymbolView
                  name={{ ios: 'bus.fill', android: 'directions_bus', web: 'directions_bus' }}
                  size={18}
                  tintColor={Brand.teal.primary}
                />
                <AppText style={styles.quickActionLabel}>Add Bus</AppText>
              </Pressable>

              <Pressable
                onPress={() => setAssignModalVisible(true)}
                style={styles.quickActionButton}
              >
                <SymbolView
                  name={{ ios: 'person.badge.plus', android: 'person_add', web: 'person_add' }}
                  size={18}
                  tintColor={Brand.teal.primary}
                />
                <AppText style={styles.quickActionLabel}>Assign Driver</AppText>
              </Pressable>

              <Pressable
                onPress={() => setRouteModalVisible(true)}
                style={styles.quickActionButton}
              >
                <SymbolView
                  name={{ ios: 'map.fill', android: 'map', web: 'map' }}
                  size={18}
                  tintColor={Brand.teal.primary}
                />
                <AppText style={styles.quickActionLabel}>New Route</AppText>
              </Pressable>
            </View>

            {/* KPI Metric Cards Grid */}
            <View style={styles.kpiGrid}>
              {/* Total Buses */}
              <Pressable
                onPress={() => {
                  setActiveMainTab('fleet');
                  setFleetSubTab('buses');
                }}
                style={styles.kpiCard}
              >
                <View style={styles.kpiCardHeader}>
                  <AppText style={styles.kpiLabel}>Fleet Buses</AppText>
                  <SymbolView
                    name={{ ios: 'bus.fill', android: 'directions_bus', web: 'directions_bus' }}
                    size={16}
                    tintColor={Brand.teal.primary}
                  />
                </View>
                <AppText style={styles.kpiValue}>{dashboard.fleet.buses.total}</AppText>
                <AppText style={styles.kpiSub}>
                  {dashboard.fleet.buses.active} active · {dashboard.fleet.buses.live_now} live now
                </AppText>
              </Pressable>

              {/* Roster Drivers */}
              <Pressable
                onPress={() => {
                  setActiveMainTab('fleet');
                  setFleetSubTab('drivers');
                }}
                style={styles.kpiCard}
              >
                <View style={styles.kpiCardHeader}>
                  <AppText style={styles.kpiLabel}>Drivers</AppText>
                  <SymbolView
                    name={{ ios: 'person.2.fill', android: 'people', web: 'people' }}
                    size={16}
                    tintColor={Brand.teal.primary}
                  />
                </View>
                <AppText style={styles.kpiValue}>{dashboard.fleet.drivers.total}</AppText>
                <AppText style={styles.kpiSub}>
                  {dashboard.fleet.drivers.active} active roster drivers
                </AppText>
              </Pressable>

              {/* Operational Trips */}
              <Pressable
                onPress={() => {
                  setActiveMainTab('operations');
                  setOperationsSubTab('trips');
                }}
                style={styles.kpiCard}
              >
                <View style={styles.kpiCardHeader}>
                  <AppText style={styles.kpiLabel}>Trips in Period</AppText>
                  <SymbolView
                    name={{ ios: 'arrow.triangle.swap', android: 'compare_arrows', web: 'compare_arrows' }}
                    size={16}
                    tintColor={Brand.teal.primary}
                  />
                </View>
                <AppText style={styles.kpiValue}>{dashboard.trips.total}</AppText>
                <AppText style={styles.kpiSub}>
                  {dashboard.trips.in_progress} active · {dashboard.trips.completed} completed
                </AppText>
              </Pressable>

              {/* Fare Taps */}
              <Pressable
                onPress={() => {
                  setActiveMainTab('reports');
                  setReportsSubTab('taps');
                }}
                style={styles.kpiCard}
              >
                <View style={styles.kpiCardHeader}>
                  <AppText style={styles.kpiLabel}>Fare Taps</AppText>
                  <SymbolView
                    name={{ ios: 'creditcard.fill', android: 'credit_card', web: 'credit_card' }}
                    size={16}
                    tintColor={Brand.teal.primary}
                  />
                </View>
                <AppText style={styles.kpiValue}>{dashboard.taps.successful}</AppText>
                <AppText style={styles.kpiSub}>
                  {dashboard.taps.failed} failed · {dashboard.taps.success_rate}% success
                </AppText>
              </Pressable>
            </View>

            {/* Collected Volume Banner */}
            <View style={styles.financialBanner}>
              <View>
                <AppText style={styles.finLabel}>Fare Amount Received</AppText>
                <AppText style={styles.finValue}>{dashboard.taps.collected.formatted}</AppText>
                <AppText style={styles.finSub}>
                  {dashboard.taps.successful} successful fare payments in the selected period
                </AppText>
              </View>
              <Pressable
                onPress={() => {
                  setActiveMainTab('reports');
                  setReportsSubTab('summary');
                }}
                style={styles.finButton}
              >
                <AppText style={styles.finButtonText}>View Reports →</AppText>
              </Pressable>
            </View>

            {/* Live Fleet Snapshot Preview */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <AppText style={styles.sectionTitle}>Live Fleet Tracking</AppText>
                <Pressable
                  onPress={() => {
                    setActiveMainTab('operations');
                    setOperationsSubTab('live');
                  }}
                >
                  <AppText style={styles.seeAllText}>View All ({liveBuses.length})</AppText>
                </Pressable>
              </View>

              {liveBuses.length === 0 ? (
                <View style={styles.emptyCard}>
                  <AppText style={styles.emptyText}>No company buses currently reporting live GPS coordinates.</AppText>
                </View>
              ) : (
                liveBuses.slice(0, 3).map((bus) => (
                  <View key={bus.bus_id} style={styles.liveBusItem}>
                    <View style={styles.livePulse} />
                    <View style={styles.liveBusInfo}>
                      <AppText style={styles.liveBusTitle}>{bus.bus_number}</AppText>
                      <AppText style={styles.liveBusRoute}>
                        {bus.route?.name ?? 'En Route'}{bus.route?.destination ? ` → ${bus.route.destination}` : ''}
                      </AppText>
                      <AppText style={styles.liveBusMeta}>
                        Speed: {Math.round(bus.speed_kmh ?? bus.speed ?? 0)} km/h · {bus.registration_number}
                      </AppText>
                    </View>
                    <View style={styles.liveBadge}>
                      <AppText style={styles.liveBadgeText}>LIVE</AppText>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Recent Company Activity (Trips & Fares) */}
            <View style={styles.sectionContainer}>
              <AppText style={styles.sectionTitle}>Recent Trip Operations</AppText>
              {trips.length === 0 ? (
                <View style={styles.emptyCard}>
                  <AppText style={styles.emptyText}>No recent trips found for the selected period.</AppText>
                </View>
              ) : (
                trips.slice(0, 4).map((trip) => (
                  <View key={trip.id} style={styles.tripItemCard}>
                    <View style={styles.tripItemTop}>
                      <AppText style={styles.tripRef}>Ref: {trip.reference}</AppText>
                      <View
                        style={[
                          styles.statusBadge,
                          trip.status === 'in_progress'
                            ? styles.statusActive
                            : trip.status === 'completed'
                              ? styles.statusCompleted
                              : trip.status === 'scheduled'
                                ? styles.statusScheduled
                                : styles.statusCancelled,
                        ]}
                      >
                        <AppText style={styles.statusBadgeText}>{trip.status.toUpperCase()}</AppText>
                      </View>
                    </View>
                    <AppText style={styles.tripRouteName}>{trip.route?.name ?? 'Standard Route'}</AppText>
                    <View style={styles.tripItemMeta}>
                      <AppText style={styles.tripMetaText}>
                        Bus: {trip.bus?.bus_number ?? 'N/A'} · Driver: {trip.driver?.user?.name ?? 'Assigned'}
                      </AppText>
                      <AppText style={styles.tripRevenueText}>{trip.revenue.formatted}</AppText>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: OPERATIONS (TRIPS, LIVE GPS, FARES)                                */}
        {/* ========================================================================= */}
        {activeMainTab === 'operations' && (
          <View style={styles.tabContent}>
            {/* Sub-tab Switcher */}
            <View style={styles.subTabRow}>
              {(['trips', 'live', 'fares'] as const).map((tab) => (
                <Pressable
                  key={tab}
                  onPress={() => setOperationsSubTab(tab)}
                  style={[styles.subTabButton, operationsSubTab === tab && styles.subTabButtonActive]}
                >
                  <AppText style={[styles.subTabText, operationsSubTab === tab && styles.subTabTextActive]}>
                    {tab === 'trips' ? `Trips (${trips.length})` : tab === 'live' ? `Live Fleet (${liveBuses.length})` : `Fare Rules (${fares.length})`}
                  </AppText>
                </Pressable>
              ))}
            </View>

            {/* --- Trips Sub-tab --- */}
            {operationsSubTab === 'trips' && (
              <View>
                <View style={styles.sectionHeaderRow}>
                  <AppText style={styles.pageTitle}>Trip Operations</AppText>
                  <Pressable onPress={() => setTripModalVisible(true)} style={styles.primaryActionBtn}>
                    <AppText style={styles.primaryActionBtnText}>+ Schedule Trip</AppText>
                  </Pressable>
                </View>

                {/* Status filter bar */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                  {(['all', 'scheduled', 'in_progress', 'completed', 'cancelled'] as const).map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setTripStatusFilter(s)}
                      style={[styles.filterChip, tripStatusFilter === s && styles.filterChipActive]}
                    >
                      <AppText style={[styles.filterChipText, tripStatusFilter === s && styles.filterChipTextActive]}>
                        {s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}
                      </AppText>
                    </Pressable>
                  ))}
                </ScrollView>

                {filteredTrips.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <AppText style={styles.emptyText}>No trips match the current filter.</AppText>
                  </View>
                ) : (
                  filteredTrips.map((trip) => (
                    <View key={trip.id} style={styles.tripCard}>
                      <View style={styles.tripItemTop}>
                        <View>
                          <AppText style={styles.tripRef}>{trip.reference}</AppText>
                          <AppText style={styles.tripRouteName}>{trip.route?.name ?? 'Assigned Route'}</AppText>
                        </View>
                        <View
                          style={[
                            styles.statusBadge,
                            trip.status === 'in_progress'
                              ? styles.statusActive
                              : trip.status === 'completed'
                                ? styles.statusCompleted
                                : trip.status === 'scheduled'
                                  ? styles.statusScheduled
                                  : styles.statusCancelled,
                          ]}
                        >
                          <AppText style={styles.statusBadgeText}>{trip.status.toUpperCase()}</AppText>
                        </View>
                      </View>

                      <View style={styles.tripDetailsGrid}>
                        <View style={styles.tripDetailItem}>
                          <AppText style={styles.tripDetailLabel}>Bus</AppText>
                          <AppText style={styles.tripDetailVal}>{trip.bus?.bus_number ?? 'Unassigned'}</AppText>
                        </View>
                        <View style={styles.tripDetailItem}>
                          <AppText style={styles.tripDetailLabel}>Driver</AppText>
                          <AppText style={styles.tripDetailVal}>{trip.driver?.user?.name ?? 'Unassigned'}</AppText>
                        </View>
                        <View style={styles.tripDetailItem}>
                          <AppText style={styles.tripDetailLabel}>Passengers</AppText>
                          <AppText style={styles.tripDetailVal}>{trip.passenger_count}</AppText>
                        </View>
                        <View style={styles.tripDetailItem}>
                          <AppText style={styles.tripDetailLabel}>Revenue</AppText>
                          <AppText style={styles.tripDetailVal}>{trip.revenue.formatted}</AppText>
                        </View>
                      </View>

                      {/* Cancel Action for Active/Scheduled trips */}
                      {(trip.status === 'scheduled' || trip.status === 'in_progress') && (
                        <View style={styles.tripActionsRow}>
                          <Pressable
                            onPress={() => handleCancelTrip(trip)}
                            style={styles.cancelTripBtn}
                          >
                            <AppText style={styles.cancelTripBtnText}>Cancel Trip</AppText>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  ))
                )}

                {tripCursor && (
                  <Pressable
                    disabled={moreBusy}
                    onPress={() => void loadMore('trips')}
                    style={styles.loadMoreBtn}
                  >
                    {moreBusy ? (
                      <ActivityIndicator color={Brand.textSecondary} />
                    ) : (
                      <AppText style={styles.loadMoreBtnText}>Load More Trips</AppText>
                    )}
                  </Pressable>
                )}
              </View>
            )}

            {/* --- Live Fleet GPS Sub-tab --- */}
            {operationsSubTab === 'live' && (
              <View>
                <View style={styles.sectionHeaderRow}>
                  <AppText style={styles.pageTitle}>Live Bus Tracking</AppText>
                  <AppText style={styles.badgeCount}>{liveBuses.length} online</AppText>
                </View>
                <AppText style={styles.subNote}>
                  Real-time broadcast from active validator devices. Coordinates older than 90s are excluded.
                </AppText>

                {liveBuses.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <AppText style={styles.emptyText}>No buses currently sending live GPS updates.</AppText>
                  </View>
                ) : (
                  liveBuses.map((bus) => (
                    <View key={bus.bus_id} style={styles.liveCardFull}>
                      <View style={styles.liveCardHeader}>
                        <View style={styles.busIconSquare}>
                          <SymbolView
                            name={{ ios: 'bus.fill', android: 'directions_bus', web: 'directions_bus' }}
                            size={20}
                            tintColor={Brand.teal.primary}
                          />
                        </View>
                        <View style={styles.liveCardTitleBox}>
                          <AppText style={styles.liveBusNumber}>{bus.bus_number}</AppText>
                          <AppText style={styles.liveBusPlate}>{bus.registration_number}</AppText>
                        </View>
                        <View style={styles.livePill}>
                          <View style={styles.livePulseDot} />
                          <AppText style={styles.livePillText}>REPORTING</AppText>
                        </View>
                      </View>

                      <View style={styles.liveMetaGrid}>
                        <View style={styles.liveMetaItem}>
                          <AppText style={styles.liveMetaLabel}>Assigned Route</AppText>
                          <AppText style={styles.liveMetaValue}>
                            {bus.route?.name ?? 'No active route'}
                          </AppText>
                        </View>
                        <View style={styles.liveMetaItem}>
                          <AppText style={styles.liveMetaLabel}>Current Speed</AppText>
                          <AppText style={styles.liveMetaValue}>
                            {Math.round(bus.speed_kmh ?? bus.speed ?? 0)} km/h
                          </AppText>
                        </View>
                        <View style={styles.liveMetaItem}>
                          <AppText style={styles.liveMetaLabel}>Coordinates</AppText>
                          <AppText style={styles.liveMetaValue}>
                            {bus.latitude?.toFixed(4)}, {bus.longitude?.toFixed(4)}
                          </AppText>
                        </View>
                        <View style={styles.liveMetaItem}>
                          <AppText style={styles.liveMetaLabel}>Last Update</AppText>
                          <AppText style={styles.liveMetaValue}>
                            {bus.last_seen_at ? new Date(bus.last_seen_at).toLocaleTimeString() : 'N/A'}
                          </AppText>
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* --- Fare Rules Sub-tab --- */}
            {operationsSubTab === 'fares' && (
              <View>
                <View style={styles.sectionHeaderRow}>
                  <AppText style={styles.pageTitle}>Company Fare Policies</AppText>
                  <Pressable onPress={() => setFareModalVisible(true)} style={styles.primaryActionBtn}>
                    <AppText style={styles.primaryActionBtnText}>+ New Fare</AppText>
                  </Pressable>
                </View>
                <AppText style={styles.subNote}>
                  Configured pricing tiers for bus routes. All fares enforce platform upper-bounds.
                </AppText>

                {fares.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <AppText style={styles.emptyText}>No fare rules configured for this transport company.</AppText>
                  </View>
                ) : (
                  fares.map((fare: any) => (
                    <View key={fare.id} style={styles.fareCard}>
                      <View style={styles.tripItemTop}>
                        <View>
                          <AppText style={styles.fareName}>{fare.name}</AppText>
                          <AppText style={styles.fareRoute}>{fare.route?.name ? `Route: ${fare.route.name}` : 'All Routes'}</AppText>
                        </View>
                        <View style={[styles.statusBadge, fare.status === 'active' ? styles.statusActive : styles.statusCompleted]}>
                          <AppText style={styles.statusBadgeText}>{(fare.status ?? 'active').toUpperCase()}</AppText>
                        </View>
                      </View>

                      <View style={styles.farePricingRow}>
                        <AppText style={styles.farePrice}>
                          {fare.amount?.formatted ?? `Rs. ${((fare.amount_minor ?? 2500) / 100).toFixed(2)}`}
                        </AppText>
                        <AppText style={styles.fareTypeLabel}>Type: {fare.type ?? 'flat'}</AppText>
                      </View>

                      <View style={styles.fareActionsRow}>
                        {fare.status !== 'active' && (
                          <Pressable onPress={() => handleActivateFare(fare.id)} style={styles.fareActionBtn}>
                            <AppText style={styles.fareActionText}>Activate</AppText>
                          </Pressable>
                        )}
                        <Pressable onPress={() => handleDeleteFare(fare.id)} style={styles.fareDeleteBtn}>
                          <AppText style={styles.fareDeleteText}>Delete</AppText>
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: FLEET (BUSES, DRIVERS, ASSIGNMENTS, ROUTES)                         */}
        {/* ========================================================================= */}
        {activeMainTab === 'fleet' && (
          <View style={styles.tabContent}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/portal/company-fleet-logs' as Href)}
              style={styles.companyReportStatusButton}
            >
              <AppText style={styles.companyReportStatusButtonText}>Vehicle maintenance &amp; fuel records</AppText>
            </Pressable>
            {/* Sub-tab Switcher */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subTabRow}>
              {(['buses', 'drivers', 'assignments', 'routes'] as const).map((tab) => (
                <Pressable
                  key={tab}
                  onPress={() => setFleetSubTab(tab)}
                  style={[styles.subTabButton, fleetSubTab === tab && styles.subTabButtonActive]}
                >
                  <AppText style={[styles.subTabText, fleetSubTab === tab && styles.subTabTextActive]}>
                    {tab === 'buses'
                      ? `Buses (${buses.length})`
                      : tab === 'drivers'
                        ? `Drivers (${drivers.length})`
                        : tab === 'assignments'
                          ? `Duty Roster (${assignments.length})`
                          : `Routes (${routes.length})`}
                  </AppText>
                </Pressable>
              ))}
            </ScrollView>

            {/* --- Buses Sub-tab --- */}
            {fleetSubTab === 'buses' && (
              <View>
                <View style={styles.sectionHeaderRow}>
                  <AppText style={styles.pageTitle}>Authorized Fleet</AppText>
                  <Pressable onPress={() => setBusModalVisible(true)} style={styles.primaryActionBtn}>
                    <AppText style={styles.primaryActionBtnText}>+ Add Bus</AppText>
                  </Pressable>
                </View>

                {buses.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <AppText style={styles.emptyText}>No buses registered to your company.</AppText>
                  </View>
                ) : (
                  buses.map((bus) => (
                    <View key={bus.id} style={styles.fleetCard}>
                      <View style={styles.fleetCardHeader}>
                        <View style={styles.busIconSquare}>
                          <SymbolView
                            name={{ ios: 'bus.fill', android: 'directions_bus', web: 'directions_bus' }}
                            size={20}
                            tintColor={Brand.teal.primary}
                          />
                        </View>
                        <View style={styles.fleetCardTitles}>
                          <AppText style={styles.fleetTitle}>{bus.bus_number}</AppText>
                          <AppText style={styles.fleetPlate}>{bus.registration_number}</AppText>
                        </View>
                        <View style={[styles.statusBadge, bus.status === 'active' ? styles.statusActive : styles.statusCompleted]}>
                          <AppText style={styles.statusBadgeText}>{bus.status.toUpperCase()}</AppText>
                        </View>
                      </View>
                      <View style={styles.fleetDetailsRow}>
                        <AppText style={styles.fleetDetailText}>Type: {bus.vehicle_type}</AppText>
                        <AppText style={styles.fleetDetailText}>Capacity: {bus.capacity} seats</AppText>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* --- Drivers Sub-tab --- */}
            {fleetSubTab === 'drivers' && (
              <View>
                <View style={styles.sectionHeaderRow}>
                  <AppText style={styles.pageTitle}>Company Drivers</AppText>
                  <Pressable onPress={() => setDriverModalVisible(true)} style={styles.primaryActionBtn}>
                    <AppText style={styles.primaryActionBtnText}>+ Add Driver</AppText>
                  </Pressable>
                </View>

                {drivers.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <AppText style={styles.emptyText}>No drivers assigned to your transport company.</AppText>
                  </View>
                ) : (
                  drivers.map((d) => (
                    <View key={d.id} style={styles.fleetCard}>
                      <View style={styles.fleetCardHeader}>
                        <View style={styles.driverAvatarSquare}>
                          <AppText style={styles.driverAvatarLetter}>{d.name.charAt(0).toUpperCase()}</AppText>
                        </View>
                        <View style={styles.fleetCardTitles}>
                          <AppText style={styles.fleetTitle}>{d.name}</AppText>
                          <AppText style={styles.fleetPlate}>License: {d.license_number}</AppText>
                        </View>
                        <View style={[styles.statusBadge, d.status === 'active' ? styles.statusActive : styles.statusCancelled]}>
                          <AppText style={styles.statusBadgeText}>{d.status.toUpperCase()}</AppText>
                        </View>
                      </View>

                      <View style={styles.fleetDetailsRow}>
                        <AppText style={styles.fleetDetailText}>Phone: {d.phone || 'N/A'}</AppText>
                        <AppText style={styles.fleetDetailText}>
                          Bus: {d.assigned_bus_number ? d.assigned_bus_number : 'Unassigned'}
                        </AppText>
                      </View>

                      <View style={styles.driverActionsRow}>
                        <Pressable
                          onPress={() => handleToggleDriverStatus(d)}
                          style={[styles.statusToggleBtn, d.status === 'active' ? styles.suspendBtn : styles.activateBtn]}
                        >
                          <AppText style={styles.statusToggleText}>
                            {d.status === 'active' ? 'Suspend Driver' : 'Reactivate Driver'}
                          </AppText>
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* --- Assignments Sub-tab --- */}
            {fleetSubTab === 'assignments' && (
              <View>
                <View style={styles.sectionHeaderRow}>
                  <AppText style={styles.pageTitle}>Duty Assignments</AppText>
                  <Pressable onPress={() => setAssignModalVisible(true)} style={styles.primaryActionBtn}>
                    <AppText style={styles.primaryActionBtnText}>+ Assign Driver</AppText>
                  </Pressable>
                </View>
                <AppText style={styles.subNote}>
                  Binds authorized drivers to specific company buses, avoiding scheduling conflicts.
                </AppText>

                {assignments.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <AppText style={styles.emptyText}>No active bus-driver assignments found.</AppText>
                  </View>
                ) : (
                  assignments.map((asgn) => (
                    <View key={asgn.id} style={styles.fleetCard}>
                      <View style={styles.fleetCardHeader}>
                        <View style={styles.fleetCardTitles}>
                          <AppText style={styles.fleetTitle}>
                            Bus: {asgn.bus?.bus_number ?? `ID ${asgn.bus_id}`}
                          </AppText>
                          <AppText style={styles.fleetPlate}>
                            Driver: {asgn.driver?.user?.name ?? `ID ${asgn.driver_id}`} ({asgn.role})
                          </AppText>
                        </View>
                        <View style={[styles.statusBadge, asgn.status === 'active' ? styles.statusActive : styles.statusCompleted]}>
                          <AppText style={styles.statusBadgeText}>{asgn.status.toUpperCase()}</AppText>
                        </View>
                      </View>
                      <View style={styles.fleetDetailsRow}>
                        <AppText style={styles.fleetDetailText}>
                          Started: {asgn.starts_at ? new Date(asgn.starts_at).toLocaleDateString() : 'N/A'}
                        </AppText>
                        <AppText style={styles.fleetDetailText}>
                          {asgn.ends_at ? `Ended: ${new Date(asgn.ends_at).toLocaleDateString()}` : 'Open duty'}
                        </AppText>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* --- Routes Sub-tab --- */}
            {fleetSubTab === 'routes' && (
              <View>
                <View style={styles.sectionHeaderRow}>
                  <AppText style={styles.pageTitle}>Transit Routes</AppText>
                  <Pressable onPress={() => setRouteModalVisible(true)} style={styles.primaryActionBtn}>
                    <AppText style={styles.primaryActionBtnText}>+ New Route</AppText>
                  </Pressable>
                </View>

                {routes.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <AppText style={styles.emptyText}>No routes established for this company.</AppText>
                  </View>
                ) : (
                  routes.map((rt) => (
                    <View key={rt.id} style={styles.fleetCard}>
                      <View style={styles.fleetCardHeader}>
                        <View style={styles.routeCodeBox}>
                          <AppText style={styles.routeCodeText}>{rt.code}</AppText>
                        </View>
                        <View style={styles.fleetCardTitles}>
                          <AppText style={styles.fleetTitle}>{rt.name}</AppText>
                          <AppText style={styles.fleetPlate}>
                            {rt.distance_km} km · ~{rt.estimated_minutes} minutes
                          </AppText>
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: REPORTS (OPERATIONAL SUMMARY, TRANSACTIONS/TAPS, SETTLEMENTS)      */}
        {/* ========================================================================= */}
        {activeMainTab === 'reports' && (
          <View style={styles.tabContent}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/portal/company-notices' as Href)}
              style={styles.companyReportStatusButton}
            >
              <AppText style={styles.companyReportStatusButtonText}>Publish &amp; manage passenger service notices</AppText>
            </Pressable>
            {/* Sub-tab Switcher */}
            <View style={styles.subTabRow}>
              {(['summary', 'taps', 'settlements', 'driver-reports'] as const).map((tab) => (
                <Pressable
                  key={tab}
                  onPress={() => setReportsSubTab(tab)}
                  style={[styles.subTabButton, reportsSubTab === tab && styles.subTabButtonActive]}
                >
                  <AppText style={[styles.subTabText, reportsSubTab === tab && styles.subTabTextActive]}>
                    {tab === 'summary'
                      ? 'Summary'
                      : tab === 'taps'
                        ? `Taps (${taps.length})`
                        : tab === 'settlements'
                          ? `Settlements (${settlements.length})`
                          : `Driver Reports (${driverReports.length})`}
                  </AppText>
                </Pressable>
              ))}
            </View>

            {/* --- Summary Reports Sub-tab --- */}
            {reportsSubTab === 'summary' && reportsData && (
              <View>
                <AppText style={styles.pageTitle}>Operational Analytics</AppText>
                <AppText style={styles.subNote}>
                  Verified performance aggregates for {reportsData.period.from} to {reportsData.period.to}.
                </AppText>

                {/* Fleet Utilization Stats */}
                <View style={styles.reportSectionCard}>
                  <AppText style={styles.reportSectionTitle}>Fleet Utilization</AppText>
                  <View style={styles.reportGrid}>
                    <View style={styles.reportItem}>
                      <AppText style={styles.reportItemVal}>{reportsData.fleet.buses.total}</AppText>
                      <AppText style={styles.reportItemLbl}>Total Buses</AppText>
                    </View>
                    <View style={styles.reportItem}>
                      <AppText style={styles.reportItemVal}>{reportsData.fleet.buses.active}</AppText>
                      <AppText style={styles.reportItemLbl}>Active</AppText>
                    </View>
                    <View style={styles.reportItem}>
                      <AppText style={styles.reportItemVal}>{reportsData.fleet.buses.live_now}</AppText>
                      <AppText style={styles.reportItemLbl}>Reporting Live</AppText>
                    </View>
                    <View style={styles.reportItem}>
                      <AppText style={styles.reportItemVal}>{reportsData.fleet.buses.stale ?? 0}</AppText>
                      <AppText style={styles.reportItemLbl}>Stale GPS</AppText>
                    </View>
                  </View>
                </View>

                {/* Trip Performance Stats */}
                <View style={styles.reportSectionCard}>
                  <AppText style={styles.reportSectionTitle}>Trip Completion &amp; Reliability</AppText>
                  <View style={styles.reportGrid}>
                    <View style={styles.reportItem}>
                      <AppText style={styles.reportItemVal}>{reportsData.trips.total}</AppText>
                      <AppText style={styles.reportItemLbl}>Total Trips</AppText>
                    </View>
                    <View style={styles.reportItem}>
                      <AppText style={styles.reportItemVal}>{reportsData.trips.completed}</AppText>
                      <AppText style={styles.reportItemLbl}>Completed</AppText>
                    </View>
                    <View style={styles.reportItem}>
                      <AppText style={styles.reportItemVal}>{reportsData.trips.cancelled}</AppText>
                      <AppText style={styles.reportItemLbl}>Cancelled</AppText>
                    </View>
                    <View style={styles.reportItem}>
                      <AppText style={styles.reportItemVal}>{reportsData.trips.passengers_carried}</AppText>
                      <AppText style={styles.reportItemLbl}>Passengers</AppText>
                    </View>
                  </View>
                </View>

                {/* Top Routes by Volume */}
                <View style={styles.reportSectionCard}>
                  <AppText style={styles.reportSectionTitle}>Top Transit Routes</AppText>
                  {reportsData.routes.length === 0 ? (
                    <AppText style={styles.emptySubText}>No route trip activity recorded in this period.</AppText>
                  ) : (
                    reportsData.routes.map((rt) => (
                      <View key={rt.route_id} style={styles.routeUsageRow}>
                        <View style={styles.routeUsageLeft}>
                          <AppText style={styles.routeUsageName}>{rt.route_name}</AppText>
                          <AppText style={styles.routeUsageMeta}>{rt.trips_count} trips · {rt.passengers} riders</AppText>
                        </View>
                        <AppText style={styles.routeUsageRevenue}>{rt.revenue.formatted}</AppText>
                      </View>
                    ))
                  )}
                </View>

                {/* Driver Roster Activity */}
                <View style={styles.reportSectionCard}>
                  <AppText style={styles.reportSectionTitle}>Driver Activity Summary</AppText>
                  {reportsData.drivers.length === 0 ? (
                    <AppText style={styles.emptySubText}>No driver trip records in this period.</AppText>
                  ) : (
                    reportsData.drivers.map((d) => (
                      <View key={d.driver_id} style={styles.routeUsageRow}>
                        <View style={styles.routeUsageLeft}>
                          <AppText style={styles.routeUsageName}>{d.driver_name}</AppText>
                          <AppText style={styles.routeUsageMeta}>{d.completed_count} completed trips</AppText>
                        </View>
                        <AppText style={styles.driverPassText}>{d.passengers} passengers</AppText>
                      </View>
                    ))
                  )}
                </View>
              </View>
            )}

            {/* --- Fare Transactions (Taps) Sub-tab --- */}
            {reportsSubTab === 'taps' && (
              <View>
                <View style={styles.sectionHeaderRow}>
                  <AppText style={styles.pageTitle}>Fare Transactions</AppText>
                </View>

                {/* Filter Chip Row */}
                <View style={styles.filterChipRow}>
                  {(['all', 'success', 'failed'] as const).map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setTapStatusFilter(s)}
                      style={[styles.filterChip, tapStatusFilter === s && styles.filterChipActive]}
                    >
                      <AppText style={[styles.filterChipText, tapStatusFilter === s && styles.filterChipTextActive]}>
                        {s === 'all' ? 'All Taps' : s === 'success' ? 'Successful' : 'Failed'}
                      </AppText>
                    </Pressable>
                  ))}
                </View>

                {filteredTaps.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <AppText style={styles.emptyText}>No tap transactions found.</AppText>
                  </View>
                ) : (
                  filteredTaps.map((t) => (
                    <View key={t.id} style={styles.tapCard}>
                      <View style={styles.tripItemTop}>
                        <View>
                          <AppText style={styles.tapRef}>{t.transaction_reference || t.tap_uid}</AppText>
                          <AppText style={styles.tapBus}>{t.bus?.bus_number ? `Bus: ${t.bus.bus_number}` : 'Fleet validator'}</AppText>
                        </View>
                        <View style={[styles.statusBadge, t.status === 'success' ? styles.statusActive : styles.statusCancelled]}>
                          <AppText style={styles.statusBadgeText}>{t.status.toUpperCase()}</AppText>
                        </View>
                      </View>
                      <View style={styles.tapBottomRow}>
                        <AppText style={styles.tapTime}>
                          {t.tapped_at ? new Date(t.tapped_at).toLocaleString() : 'N/A'}
                        </AppText>
                        {t.failure_reason && (
                          <AppText style={styles.tapFailReason}>Reason: {t.failure_reason}</AppText>
                        )}
                      </View>
                    </View>
                  ))
                )}

                {tapCursor && (
                  <Pressable
                    disabled={moreBusy}
                    onPress={() => void loadMore('taps')}
                    style={styles.loadMoreBtn}
                  >
                    {moreBusy ? (
                      <ActivityIndicator color={Brand.textSecondary} />
                    ) : (
                      <AppText style={styles.loadMoreBtnText}>Load More Taps</AppText>
                    )}
                  </Pressable>
                )}
              </View>
            )}

            {/* --- Settlements Sub-tab --- */}
            {reportsSubTab === 'settlements' && (
              <View>
                <AppText style={styles.pageTitle}>Settlement Periods</AppText>
                <AppText style={styles.subNote}>
                  Financial reconciliations and platform payout records.
                </AppText>

                {settlements.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <AppText style={styles.emptyText}>No settlement periods recorded for your company yet.</AppText>
                  </View>
                ) : (
                  settlements.map((set) => (
                    <View key={set.id} style={styles.settlementCard}>
                      <View style={styles.tripItemTop}>
                        <AppText style={styles.settlePeriod}>
                          {set.period.start} to {set.period.end}
                        </AppText>
                        <View style={[styles.statusBadge, set.status === 'settled' ? styles.statusActive : styles.statusScheduled]}>
                          <AppText style={styles.statusBadgeText}>{set.status.toUpperCase()}</AppText>
                        </View>
                      </View>

                      <View style={styles.settleAmountsRow}>
                        <View>
                          <AppText style={styles.settleLabel}>Gross Fares</AppText>
                          <AppText style={styles.settleVal}>{set.gross_fares.formatted}</AppText>
                        </View>
                        <View>
                          <AppText style={styles.settleLabel}>Refunds</AppText>
                          <AppText style={styles.settleVal}>{set.refunds.formatted}</AppText>
                        </View>
                        <View>
                          <AppText style={styles.settleLabel}>Net Payout</AppText>
                          <AppText style={[styles.settleVal, styles.settleNetVal]}>{set.net.formatted}</AppText>
                        </View>
                      </View>
                      <AppText style={styles.settleMeta}>Taps: {set.tap_count} total journeys reconciled</AppText>
                    </View>
                  ))
                )}
              </View>
            )}

            {reportsSubTab === 'driver-reports' && (
              <View style={styles.reportSectionCard}>
                <AppText style={styles.reportSectionTitle}>Driver Inspections &amp; Incidents</AppText>
                <AppText style={styles.subNote}>
                  Reports are restricted to this company. Acknowledgement and resolution changes are audited.
                </AppText>
                {driverReportsError ? (
                  <View style={styles.errorBanner}>
                    <View style={styles.errorTextContainer}>
                      <AppText style={styles.errorBannerTitle}>Unable to load driver reports</AppText>
                      <AppText style={styles.errorBannerMessage}>{driverReportsError}</AppText>
                    </View>
                    <Pressable onPress={() => void loadData(true)} style={styles.retryBtn}>
                      <AppText style={styles.retryBtnText}>Retry</AppText>
                    </Pressable>
                  </View>
                ) : driverReports.length === 0 ? (
                  <AppText style={styles.emptySubText}>No driver inspections or operational reports are recorded.</AppText>
                ) : driverReports.map((report) => {
                  const failedChecks = Object.entries(report.checklist ?? {})
                    .filter(([, passed]) => !passed)
                    .map(([item]) => item.replaceAll('_', ' '));
                  const busy = driverReportBusyId === report.id;
                  return (
                    <View key={report.id} style={styles.reportHistoryCard}>
                      <View style={styles.sectionHeaderRow}>
                        <AppText style={styles.reportHistoryTitle}>
                          {report.type.replaceAll('_', ' ').toUpperCase()}
                        </AppText>
                        <AppText style={styles.reportHistoryStatus}>{report.status.toUpperCase()}</AppText>
                      </View>
                      <AppText style={styles.reportHistoryMeta}>
                        {report.driver_name || 'Driver'} · {report.bus_number || 'Vehicle'}
                        {report.created_at ? ` · ${new Date(report.created_at).toLocaleString()}` : ''}
                      </AppText>
                      {report.category ? <AppText style={styles.reportHistoryMeta}>Category: {report.category}</AppText> : null}
                      {report.description ? <AppText style={styles.reportHistoryMeta}>{report.description}</AppText> : null}
                      {failedChecks.length > 0 ? (
                        <AppText style={styles.reportHistoryMeta}>Inspection findings: {failedChecks.join(', ')}</AppText>
                      ) : null}
                      {report.status !== 'resolved' && (
                        <View style={styles.driverReportActions}>
                          {report.status === 'submitted' && (
                            <Pressable
                              disabled={busy}
                              onPress={() => void handleDriverReportStatus(report, 'acknowledged')}
                              style={styles.companyReportStatusButton}
                            >
                              <AppText style={styles.companyReportStatusButtonText}>{busy ? 'Saving…' : 'Acknowledge'}</AppText>
                            </Pressable>
                          )}
                          <Pressable
                            disabled={busy}
                            onPress={() => void handleDriverReportStatus(report, 'resolved')}
                            style={styles.companyReportStatusButton}
                          >
                            <AppText style={styles.companyReportStatusButtonText}>{busy ? 'Saving…' : 'Resolve'}</AppText>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: ACCOUNT & COMPANY PROFILE                                          */}
        {/* ========================================================================= */}
        {activeMainTab === 'account' && (
          <View style={styles.tabContent}>
            <AppText style={styles.pageTitle}>Account &amp; Organization</AppText>
            <AppText style={styles.pageSubtitle}>Authenticated credentials and transport company details</AppText>

            {/* Current Administrator Card */}
            <View style={styles.accountCard}>
              <View style={styles.accountCardHeader}>
                <View style={styles.accountBigAvatar}>
                  <AppText style={styles.accountBigAvatarText}>{userInitials}</AppText>
                </View>
                <View style={styles.accountHeaderInfo}>
                  <AppText style={styles.accountUserName}>{currentUser?.name || 'Administrator'}</AppText>
                  <AppText style={styles.accountUserRole}>Company Administrator</AppText>
                  <AppText style={styles.accountUserEmail}>{currentUser?.email}</AppText>
                </View>
              </View>

              <View style={styles.accountVerificationRow}>
                <View style={[styles.verificationPill, currentUser?.email_verified ? styles.verifiedPill : styles.unverifiedPill]}>
                  <AppText style={styles.verificationPillText}>
                    {currentUser?.email_verified ? '✓ Email Verified' : '⚠ Email Unverified'}
                  </AppText>
                </View>
                <View style={[styles.verificationPill, currentUser?.phone_verified ? styles.verifiedPill : styles.unverifiedPill]}>
                  <AppText style={styles.verificationPillText}>
                    {currentUser?.phone_verified ? '✓ Phone Verified' : '⚠ Phone Unverified'}
                  </AppText>
                </View>
              </View>
            </View>

            {/* Transport Company Details Card */}
            <View style={styles.accountCard}>
              <View style={styles.sectionHeaderRow}>
                <AppText style={styles.accountSectionTitle}>Transport Company</AppText>
                <Pressable
                  onPress={() => setEditingCompany(!editingCompany)}
                  style={styles.editToggleBtn}
                >
                  <AppText style={styles.editToggleBtnText}>{editingCompany ? 'Cancel' : 'Edit Contact'}</AppText>
                </Pressable>
              </View>

              <View style={styles.companyInfoGrid}>
                <View style={styles.companyInfoRow}>
                  <AppText style={styles.companyInfoLabel}>Company Name:</AppText>
                  <AppText style={styles.companyInfoVal}>{companyProfile?.name || 'N/A'}</AppText>
                </View>
                <View style={styles.companyInfoRow}>
                  <AppText style={styles.companyInfoLabel}>Company Code:</AppText>
                  <AppText style={styles.companyInfoVal}>{companyProfile?.code || 'N/A'}</AppText>
                </View>
                <View style={styles.companyInfoRow}>
                  <AppText style={styles.companyInfoLabel}>Reg. Number:</AppText>
                  <AppText style={styles.companyInfoVal}>{companyProfile?.registration_number || 'N/A'}</AppText>
                </View>
                <View style={styles.companyInfoRow}>
                  <AppText style={styles.companyInfoLabel}>Status:</AppText>
                  <View style={[styles.statusBadge, companyProfile?.status === 'active' ? styles.statusActive : styles.statusCompleted]}>
                    <AppText style={styles.statusBadgeText}>{(companyProfile?.status ?? 'active').toUpperCase()}</AppText>
                  </View>
                </View>
              </View>

              {/* Editable Contact Fields */}
              <View style={styles.editableFieldsSection}>
                <AppText style={styles.fieldLabel}>Contact Email</AppText>
                <AppTextInput
                  editable={editingCompany}
                  value={companyEmail}
                  onChangeText={setCompanyEmail}
                  placeholder="operator@company.com"
                  placeholderTextColor={Brand.textMuted}
                  style={[styles.textInput, !editingCompany && styles.textInputDisabled]}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <AppText style={styles.fieldLabel}>Contact Phone</AppText>
                <AppTextInput
                  editable={editingCompany}
                  value={companyPhone}
                  onChangeText={setCompanyPhone}
                  placeholder="+977-1-4XXXXXX"
                  placeholderTextColor={Brand.textMuted}
                  style={[styles.textInput, !editingCompany && styles.textInputDisabled]}
                  keyboardType="phone-pad"
                />

                <AppText style={styles.fieldLabel}>Headquarters Address</AppText>
                <AppTextInput
                  editable={editingCompany}
                  value={companyAddress}
                  onChangeText={setCompanyAddress}
                  placeholder="Kathmandu, Nepal"
                  placeholderTextColor={Brand.textMuted}
                  style={[styles.textInput, !editingCompany && styles.textInputDisabled]}
                />

                {editingCompany && (
                  <Pressable
                    disabled={savingCompany}
                    onPress={handleSaveCompanyContact}
                    style={styles.saveCompanyBtn}
                  >
                    {savingCompany ? (
                      <ActivityIndicator color={Brand.text} />
                    ) : (
                      <AppText style={styles.saveCompanyBtnText}>Save Contact Details</AppText>
                    )}
                  </Pressable>
                )}
              </View>
            </View>

            {/* Platform Governance & Policies Notice */}
            <View style={styles.governanceCard}>
              <View style={styles.govIcon}>
                <SymbolView
                  name={{ ios: 'lock.shield.fill', android: 'shield', web: 'shield' }}
                  size={20}
                  tintColor={Brand.teal.primary}
                />
              </View>
              <View style={styles.govTextContainer}>
                <AppText style={styles.govTitle}>Platform Security &amp; Tenant Isolation</AppText>
                <AppText style={styles.govDesc}>
                  Your operations are scoped to {companyProfile?.name}. Wallet balances and Super Admin policies cannot be modified from the Company Portal.
                </AppText>
              </View>
            </View>

            {/* Help & Support */}
            <View style={styles.supportCard}>
              <AppText style={styles.accountSectionTitle}>Help &amp; Operational Support</AppText>
              <AppText style={styles.supportDesc}>
                For dispute escalations, validator device provisioning, or tariff review, contact Tap &amp; Pay platform operations:
              </AppText>
              <AppText style={styles.supportContact}>Email: support@tappay.com.np</AppText>
              <AppText style={styles.supportContact}>Helpline: +977-1-5970000</AppText>
            </View>

            {/* Mandatory Sign Out Button */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              onPress={confirmLogout}
              style={styles.logoutButton}
            >
              <SymbolView
                name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }}
                size={20}
                tintColor={Brand.teal.primary}
              />
              <AppText style={styles.logoutButtonText}>Sign Out of Company Admin</AppText>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* ---------------- PERSISTENT BOTTOM NAVIGATION BAR ---------------- */}
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          onPress={() => setActiveMainTab('home')}
          style={[styles.navItem, activeMainTab === 'home' && styles.navItemActive]}
        >
          <SymbolView
            name={{ ios: 'square.grid.2x2.fill', android: 'dashboard', web: 'dashboard' }}
            size={22}
            tintColor={activeMainTab === 'home' ? Brand.teal.primary : Brand.textMuted}
          />
          <AppText style={[styles.navLabel, activeMainTab === 'home' && styles.navLabelActive]}>Home</AppText>
        </Pressable>

        <Pressable
          onPress={() => setActiveMainTab('operations')}
          style={[styles.navItem, activeMainTab === 'operations' && styles.navItemActive]}
        >
          <SymbolView
            name={{ ios: 'arrow.triangle.swap', android: 'compare_arrows', web: 'compare_arrows' }}
            size={22}
            tintColor={activeMainTab === 'operations' ? Brand.teal.primary : Brand.textMuted}
          />
          <AppText style={[styles.navLabel, activeMainTab === 'operations' && styles.navLabelActive]}>Operations</AppText>
        </Pressable>

        <Pressable
          onPress={() => setActiveMainTab('fleet')}
          style={[styles.navItem, activeMainTab === 'fleet' && styles.navItemActive]}
        >
          <SymbolView
            name={{ ios: 'bus.fill', android: 'directions_bus', web: 'directions_bus' }}
            size={22}
            tintColor={activeMainTab === 'fleet' ? Brand.teal.primary : Brand.textMuted}
          />
          <AppText style={[styles.navLabel, activeMainTab === 'fleet' && styles.navLabelActive]}>Fleet</AppText>
        </Pressable>

        <Pressable
          onPress={() => setActiveMainTab('reports')}
          style={[styles.navItem, activeMainTab === 'reports' && styles.navItemActive]}
        >
          <SymbolView
            name={{ ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' }}
            size={22}
            tintColor={activeMainTab === 'reports' ? Brand.teal.primary : Brand.textMuted}
          />
          <AppText style={[styles.navLabel, activeMainTab === 'reports' && styles.navLabelActive]}>Reports</AppText>
        </Pressable>

        <Pressable
          onPress={() => setActiveMainTab('account')}
          style={[styles.navItem, activeMainTab === 'account' && styles.navItemActive]}
        >
          <SymbolView
            name={{ ios: 'person.crop.circle.fill', android: 'account_circle', web: 'account_circle' }}
            size={22}
            tintColor={activeMainTab === 'account' ? Brand.teal.primary : Brand.textMuted}
          />
          <AppText style={[styles.navLabel, activeMainTab === 'account' && styles.navLabelActive]}>Account</AppText>
        </Pressable>
      </View>

      {/* ========================================================================= */}
      {/* NOTIFICATIONS MODAL SHEET                                                 */}
      {/* ========================================================================= */}
      <Modal visible={notificationsVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <View>
                <AppText style={styles.modalTitle}>Company Notifications</AppText>
                <AppText style={styles.modalSubtitle}>Operational alerts and fleet events</AppText>
              </View>
              <Pressable onPress={() => setNotificationsVisible(false)} style={styles.closeBtn}>
                <AppText style={styles.closeBtnText}>Done</AppText>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.notifScroll}>
              {notifications.length === 0 ? (
                <View style={styles.emptyCard}>
                  <AppText style={styles.emptyText}>No alerts currently active.</AppText>
                </View>
              ) : (
                notifications.map((n) => (
                  <View key={n.id} style={styles.notifCard}>
                    <View style={styles.notifHeader}>
                      <View style={[styles.notifTypePill, n.type === 'error' ? styles.statusCancelled : n.type === 'warning' ? styles.statusScheduled : styles.statusActive]}>
                        <AppText style={styles.notifTypeText}>{n.type.toUpperCase()}</AppText>
                      </View>
                      <AppText style={styles.notifDate}>
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </AppText>
                    </View>
                    <AppText style={styles.notifItemTitle}>{n.title}</AppText>
                    <AppText style={styles.notifItemMsg}>{n.message}</AppText>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* ADD BUS MODAL                                                             */}
      {/* ========================================================================= */}
      <Modal visible={busModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <AppText style={styles.modalTitle}>Register Fleet Bus</AppText>
              <Pressable onPress={() => setBusModalVisible(false)} style={styles.closeBtn}>
                <AppText style={styles.closeBtnText}>Cancel</AppText>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <AppText style={styles.fieldLabel}>Bus Fleet Identifier (e.g. BA-101)</AppText>
              <AppTextInput
                value={busNumber}
                onChangeText={setBusNumber}
                placeholder="Bus Number"
                placeholderTextColor={Brand.textMuted}
                style={styles.textInput}
              />

              <AppText style={styles.fieldLabel}>License / Registration Plate</AppText>
              <AppTextInput
                value={regNumber}
                onChangeText={setRegNumber}
                placeholder="BA 2 KHA 1234"
                placeholderTextColor={Brand.textMuted}
                style={styles.textInput}
                autoCapitalize="characters"
              />

              <AppText style={styles.fieldLabel}>Seating Capacity</AppText>
              <AppTextInput
                value={capacity}
                onChangeText={setCapacity}
                placeholder="45"
                placeholderTextColor={Brand.textMuted}
                style={styles.textInput}
                keyboardType="numeric"
              />

              <AppText style={styles.fieldLabel}>Vehicle Category</AppText>
              <View style={styles.typeSelectorRow}>
                {['bus', 'minibus', 'micro', 'electric'].map((vt) => (
                  <Pressable
                    key={vt}
                    onPress={() => setVehicleType(vt)}
                    style={[styles.typeOption, vehicleType === vt && styles.typeOptionActive]}
                  >
                    <AppText style={[styles.typeOptionText, vehicleType === vt && styles.typeOptionTextActive]}>
                      {vt.toUpperCase()}
                    </AppText>
                  </Pressable>
                ))}
              </View>

              <Pressable
                disabled={addingBus}
                onPress={handleAddBus}
                style={styles.submitModalBtn}
              >
                {addingBus ? (
                  <ActivityIndicator color={Brand.text} />
                ) : (
                  <AppText style={styles.submitModalBtnText}>Register Bus</AppText>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* ADD DRIVER MODAL                                                          */}
      {/* ========================================================================= */}
      <Modal visible={driverModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <AppText style={styles.modalTitle}>Assign Company Driver</AppText>
              <Pressable onPress={() => setDriverModalVisible(false)} style={styles.closeBtn}>
                <AppText style={styles.closeBtnText}>Cancel</AppText>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <AppText style={styles.fieldLabel}>Driver Account ID (Registered User ID)</AppText>
              <AppTextInput
                value={driverUserId}
                onChangeText={setDriverUserId}
                placeholder="e.g. 5"
                placeholderTextColor={Brand.textMuted}
                style={styles.textInput}
                keyboardType="numeric"
              />

              <AppText style={styles.fieldLabel}>Commercial Driving License Number</AppText>
              <AppTextInput
                value={licenseNumber}
                onChangeText={setLicenseNumber}
                placeholder="DL-01-234567"
                placeholderTextColor={Brand.textMuted}
                style={styles.textInput}
                autoCapitalize="characters"
              />

              <AppText style={styles.subNote}>
                The driver must hold an active account with the Driver role in the system.
              </AppText>

              <Pressable
                disabled={addingDriver}
                onPress={handleAddDriver}
                style={styles.submitModalBtn}
              >
                {addingDriver ? (
                  <ActivityIndicator color={Brand.text} />
                ) : (
                  <AppText style={styles.submitModalBtnText}>Assign Driver</AppText>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* ASSIGN DRIVER TO BUS MODAL                                                */}
      {/* ========================================================================= */}
      <Modal visible={assignModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <AppText style={styles.modalTitle}>Assign Driver to Bus</AppText>
              <Pressable onPress={() => setAssignModalVisible(false)} style={styles.closeBtn}>
                <AppText style={styles.closeBtnText}>Cancel</AppText>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <AppText style={styles.fieldLabel}>Select Bus</AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorScroll}>
                {buses.map((b) => (
                  <Pressable
                    key={b.id}
                    onPress={() => setAssignBusId(b.id)}
                    style={[styles.selectorChip, assignBusId === b.id && styles.selectorChipActive]}
                  >
                    <AppText style={[styles.selectorChipText, assignBusId === b.id && styles.selectorChipTextActive]}>
                      {b.bus_number}
                    </AppText>
                  </Pressable>
                ))}
              </ScrollView>

              <AppText style={styles.fieldLabel}>Select Driver</AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorScroll}>
                {drivers.map((d) => (
                  <Pressable
                    key={d.id}
                    onPress={() => setAssignDriverId(d.id)}
                    style={[styles.selectorChip, assignDriverId === d.id && styles.selectorChipActive]}
                  >
                    <AppText style={[styles.selectorChipText, assignDriverId === d.id && styles.selectorChipTextActive]}>
                      {d.name}
                    </AppText>
                  </Pressable>
                ))}
              </ScrollView>

              <AppText style={styles.fieldLabel}>Duty Assignment Role</AppText>
              <View style={styles.typeSelectorRow}>
                {(['primary', 'relief'] as const).map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => setAssignRole(r)}
                    style={[styles.typeOption, assignRole === r && styles.typeOptionActive]}
                  >
                    <AppText style={[styles.typeOptionText, assignRole === r && styles.typeOptionTextActive]}>
                      {r.toUpperCase()}
                    </AppText>
                  </Pressable>
                ))}
              </View>

              <Pressable
                disabled={assigning}
                onPress={handleAssignDriver}
                style={styles.submitModalBtn}
              >
                {assigning ? (
                  <ActivityIndicator color={Brand.text} />
                ) : (
                  <AppText style={styles.submitModalBtnText}>Confirm Assignment</AppText>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* SCHEDULE TRIP MODAL                                                       */}
      {/* ========================================================================= */}
      <Modal visible={tripModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <AppText style={styles.modalTitle}>Schedule Fleet Trip</AppText>
              <Pressable onPress={() => setTripModalVisible(false)} style={styles.closeBtn}>
                <AppText style={styles.closeBtnText}>Cancel</AppText>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <AppText style={styles.fieldLabel}>Select Bus</AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorScroll}>
                {buses.map((b) => (
                  <Pressable
                    key={b.id}
                    onPress={() => setTripBusId(b.id)}
                    style={[styles.selectorChip, tripBusId === b.id && styles.selectorChipActive]}
                  >
                    <AppText style={[styles.selectorChipText, tripBusId === b.id && styles.selectorChipTextActive]}>
                      {b.bus_number}
                    </AppText>
                  </Pressable>
                ))}
              </ScrollView>

              <AppText style={styles.fieldLabel}>Select Route</AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorScroll}>
                {routes.map((r) => (
                  <Pressable
                    key={r.id}
                    onPress={() => setTripRouteId(r.id)}
                    style={[styles.selectorChip, tripRouteId === r.id && styles.selectorChipActive]}
                  >
                    <AppText style={[styles.selectorChipText, tripRouteId === r.id && styles.selectorChipTextActive]}>
                      {r.code}: {r.name}
                    </AppText>
                  </Pressable>
                ))}
              </ScrollView>

              <AppText style={styles.fieldLabel}>Select Driver</AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorScroll}>
                {drivers.map((d) => (
                  <Pressable
                    key={d.id}
                    onPress={() => setTripDriverId(d.id)}
                    style={[styles.selectorChip, tripDriverId === d.id && styles.selectorChipActive]}
                  >
                    <AppText style={[styles.selectorChipText, tripDriverId === d.id && styles.selectorChipTextActive]}>
                      {d.name}
                    </AppText>
                  </Pressable>
                ))}
              </ScrollView>

              <AppText style={styles.fieldLabel}>Direction</AppText>
              <View style={styles.typeSelectorRow}>
                {(['outbound', 'inbound', 'circular'] as const).map((dir) => (
                  <Pressable
                    key={dir}
                    onPress={() => setTripDirection(dir)}
                    style={[styles.typeOption, tripDirection === dir && styles.typeOptionActive]}
                  >
                    <AppText style={[styles.typeOptionText, tripDirection === dir && styles.typeOptionTextActive]}>
                      {dir.toUpperCase()}
                    </AppText>
                  </Pressable>
                ))}
              </View>

              <AppText style={styles.fieldLabel}>Scheduled Departure (Optional YYYY-MM-DD HH:MM)</AppText>
              <AppTextInput
                value={tripTime}
                onChangeText={setTripTime}
                placeholder="Leave blank for now"
                placeholderTextColor={Brand.textMuted}
                style={styles.textInput}
              />

              <Pressable
                disabled={schedulingTrip}
                onPress={handleScheduleTrip}
                style={styles.submitModalBtn}
              >
                {schedulingTrip ? (
                  <ActivityIndicator color={Brand.text} />
                ) : (
                  <AppText style={styles.submitModalBtnText}>Schedule Trip</AppText>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* ADD ROUTE MODAL                                                           */}
      {/* ========================================================================= */}
      <Modal visible={routeModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <AppText style={styles.modalTitle}>Create Transit Route</AppText>
              <Pressable onPress={() => setRouteModalVisible(false)} style={styles.closeBtn}>
                <AppText style={styles.closeBtnText}>Cancel</AppText>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <AppText style={styles.fieldLabel}>Route Code (e.g. RT-01)</AppText>
              <AppTextInput
                value={routeCode}
                onChangeText={setRouteCode}
                placeholder="RT-01"
                placeholderTextColor={Brand.textMuted}
                style={styles.textInput}
                autoCapitalize="characters"
              />

              <AppText style={styles.fieldLabel}>Route Title / Name</AppText>
              <AppTextInput
                value={routeName}
                onChangeText={setRouteName}
                placeholder="e.g. Ratnapark - Lagankhel"
                placeholderTextColor={Brand.textMuted}
                style={styles.textInput}
              />

              {/* Origin Stop Search */}
              <AppText style={styles.fieldLabel}>Origin Stop</AppText>
              <View style={styles.searchRow}>
                <AppTextInput
                  value={originStopQuery}
                  onChangeText={setOriginStopQuery}
                  placeholder="Search origin stop..."
                  placeholderTextColor={Brand.textMuted}
                  style={[styles.textInput, { flex: 1 }]}
                />
                <Pressable
                  onPress={() => findStops(originStopQuery, 'origin')}
                  disabled={stopSearchBusy}
                  style={styles.searchBtn}
                >
                  <AppText style={styles.searchBtnText}>{stopSearchBusy ? 'Searching...' : 'Find'}</AppText>
                </Pressable>
              </View>
              {originStop && (
                <View style={styles.selectedStopPill}>
                  <AppText style={styles.selectedStopText}>Selected: {originStop.name}</AppText>
                </View>
              )}
              {originStopMatches.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    setOriginStop(s);
                    setOriginStopMatches([]);
                  }}
                  style={styles.matchItem}
                >
                  <AppText style={styles.matchItemText}>📍 {s.name}</AppText>
                </Pressable>
              ))}

              {/* Destination Stop Search */}
              <AppText style={styles.fieldLabel}>Destination Stop</AppText>
              <View style={styles.searchRow}>
                <AppTextInput
                  value={destinationStopQuery}
                  onChangeText={setDestinationStopQuery}
                  placeholder="Search destination stop..."
                  placeholderTextColor={Brand.textMuted}
                  style={[styles.textInput, { flex: 1 }]}
                />
                <Pressable
                  onPress={() => findStops(destinationStopQuery, 'destination')}
                  disabled={stopSearchBusy}
                  style={styles.searchBtn}
                >
                  <AppText style={styles.searchBtnText}>{stopSearchBusy ? 'Searching...' : 'Find'}</AppText>
                </Pressable>
              </View>
              {destinationStop && (
                <View style={styles.selectedStopPill}>
                  <AppText style={styles.selectedStopText}>Selected: {destinationStop.name}</AppText>
                </View>
              )}
              {destinationStopMatches.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    setDestinationStop(s);
                    setDestinationStopMatches([]);
                  }}
                  style={styles.matchItem}
                >
                  <AppText style={styles.matchItemText}>📍 {s.name}</AppText>
                </Pressable>
              ))}

              <AppText style={styles.fieldLabel}>Distance (KM)</AppText>
              <AppTextInput
                value={distanceKm}
                onChangeText={setDistanceKm}
                placeholder="15"
                placeholderTextColor={Brand.textMuted}
                style={styles.textInput}
                keyboardType="numeric"
              />

              <AppText style={styles.fieldLabel}>Estimated Duration (Minutes)</AppText>
              <AppTextInput
                value={estMinutes}
                onChangeText={setEstMinutes}
                placeholder="45"
                placeholderTextColor={Brand.textMuted}
                style={styles.textInput}
                keyboardType="numeric"
              />

              <Pressable
                disabled={addingRoute}
                onPress={handleAddRoute}
                style={styles.submitModalBtn}
              >
                {addingRoute ? (
                  <ActivityIndicator color={Brand.text} />
                ) : (
                  <AppText style={styles.submitModalBtnText}>Create Route</AppText>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* ADD FARE RULE MODAL                                                       */}
      {/* ========================================================================= */}
      <Modal visible={fareModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <AppText style={styles.modalTitle}>New Fare Rule</AppText>
              <Pressable onPress={() => setFareModalVisible(false)} style={styles.closeBtn}>
                <AppText style={styles.closeBtnText}>Cancel</AppText>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <AppText style={styles.fieldLabel}>Policy Name</AppText>
              <AppTextInput
                value={fareName}
                onChangeText={setFareName}
                placeholder="Standard City Fare"
                placeholderTextColor={Brand.textMuted}
                style={styles.textInput}
              />

              <AppText style={styles.fieldLabel}>Fare Amount (NPR)</AppText>
              <AppTextInput
                value={fareAmount}
                onChangeText={setFareAmount}
                placeholder="25.00"
                placeholderTextColor={Brand.textMuted}
                style={styles.textInput}
                keyboardType="numeric"
              />

              <AppText style={styles.fieldLabel}>Pricing Model</AppText>
              <View style={styles.typeSelectorRow}>
                {['flat', 'distance_based'].map((ft) => (
                  <Pressable
                    key={ft}
                    onPress={() => setFareType(ft)}
                    style={[styles.typeOption, fareType === ft && styles.typeOptionActive]}
                  >
                    <AppText style={[styles.typeOptionText, fareType === ft && styles.typeOptionTextActive]}>
                      {ft.replace('_', ' ').toUpperCase()}
                    </AppText>
                  </Pressable>
                ))}
              </View>

              <Pressable
                disabled={addingFare}
                onPress={handleAddFareRule}
                style={styles.submitModalBtn}
              >
                {addingFare ? (
                  <ActivityIndicator color={Brand.text} />
                ) : (
                  <AppText style={styles.submitModalBtnText}>Save Fare Policy</AppText>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: Brand.background,
  },
  mainScroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Brand.border,
    backgroundColor: Brand.surfaceSecondary,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  brandBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Brand.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTitles: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerAppName: {
    color: Brand.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  portalTag: {
    backgroundColor: Brand.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  portalTagText: {
    color: Brand.textSecondary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerCompanyName: {
    color: Brand.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Brand.teal.light,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: Brand.surfaceElevated,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  unreadBadgeText: {
    color: Brand.text,
    fontSize: 9,
    fontWeight: '800',
  },
  avatarButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Brand.teal.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarButtonActive: {
    borderWidth: 2,
    borderColor: Brand.border,
  },
  avatarButtonText: {
    color: Brand.text,
    fontSize: 13,
    fontWeight: '800',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FCEBEC',
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  errorTextContainer: {
    flex: 1,
  },
  errorBannerTitle: {
    color: Brand.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  errorBannerMessage: {
    color: Brand.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  retryBtn: {
    backgroundColor: Brand.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryBtnText: {
    color: Brand.text,
    fontSize: 12,
    fontWeight: '700',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  loadingMessage: {
    color: Brand.textSecondary,
    fontSize: 13,
    marginTop: 8,
  },
  tabContent: {
    paddingBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  pageTitle: {
    color: Brand.text,
    fontSize: 20,
    fontWeight: '800',
  },
  pageSubtitle: {
    color: Brand.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  periodPicker: {
    flexDirection: 'row',
    backgroundColor: Brand.surfaceElevated,
    borderRadius: 8,
    padding: 3,
  },
  periodOption: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  periodOptionActive: {
    backgroundColor: Brand.surfaceElevated,
  },
  periodOptionText: {
    color: Brand.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  periodOptionTextActive: {
    color: Brand.text,
    fontWeight: '700',
  },
  staleAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7E8',
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 12,
  },
  staleAlertIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F3D49A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  staleAlertContent: {
    flex: 1,
  },
  staleAlertTitle: {
    color: Brand.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  staleAlertSub: {
    color: Brand.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  quickActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  quickActionButton: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: Brand.surfaceElevated,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  quickActionLabel: {
    color: Brand.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: Brand.surfacePrimary,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  kpiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kpiLabel: {
    color: Brand.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  kpiValue: {
    color: Brand.text,
    fontSize: 24,
    fontWeight: '800',
    marginVertical: 4,
  },
  kpiSub: {
    color: Brand.textMuted,
    fontSize: 11,
  },
  financialBanner: {
    backgroundColor: Brand.primaryDark,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  finLabel: {
    color: '#D5F3EC',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  finValue: {
    color: Brand.white,
    fontSize: 22,
    fontWeight: '800',
    marginVertical: 2,
  },
  finSub: {
    color: '#D5F3EC',
    fontSize: 11,
  },
  finButton: {
    backgroundColor: Brand.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  finButtonText: {
    color: Brand.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: Brand.text,
    fontSize: 16,
    fontWeight: '700',
  },
  seeAllText: {
    color: Brand.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  liveBusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F4EF',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  livePulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Brand.surfaceElevated,
    marginRight: 10,
  },
  liveBusInfo: {
    flex: 1,
  },
  liveBusTitle: {
    color: Brand.text,
    fontSize: 14,
    fontWeight: '700',
  },
  liveBusRoute: {
    color: Brand.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  liveBusMeta: {
    color: Brand.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  liveBadge: {
    backgroundColor: '#E3F4EF',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  liveBadgeText: {
    color: Brand.textSecondary,
    fontSize: 9,
    fontWeight: '800',
  },
  tripItemCard: {
    backgroundColor: Brand.surfacePrimary,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  tripItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tripRef: {
    color: Brand.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  tripRouteName: {
    color: Brand.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  tripItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  tripMetaText: {
    color: Brand.textMuted,
    fontSize: 11,
  },
  tripRevenueText: {
    color: Brand.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusActive: {
    backgroundColor: '#E3F4EF',
  },
  statusCompleted: {
    backgroundColor: '#E3F4EF',
  },
  statusScheduled: {
    backgroundColor: '#FFF7E8',
  },
  statusCancelled: {
    backgroundColor: '#FCEBEC',
  },
  subTabRow: {
    flexDirection: 'row',
    backgroundColor: Brand.surfaceElevated,
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  subTabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  subTabButtonActive: {
    backgroundColor: Brand.surfaceElevated,
  },
  subTabText: {
    color: Brand.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  subTabTextActive: {
    color: Brand.text,
    fontWeight: '700',
  },
  primaryActionBtn: {
    backgroundColor: Brand.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  primaryActionBtnText: {
    color: Brand.primaryText,
    fontSize: 12,
    fontWeight: '700',
  },
  filterScroll: {
    marginBottom: 12,
  },
  filterChipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    backgroundColor: Brand.surfaceElevated,
    borderWidth: 1,
    borderColor: Brand.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: Brand.surfaceElevated,
    borderColor: Brand.border,
  },
  filterChipText: {
    color: Brand.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: Brand.text,
    fontWeight: '700',
  },
  tripCard: {
    backgroundColor: Brand.surfacePrimary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  tripDetailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Brand.surfaceElevated,
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  tripDetailItem: {
    alignItems: 'center',
  },
  tripDetailLabel: {
    color: Brand.textMuted,
    fontSize: 10,
  },
  tripDetailVal: {
    color: Brand.text,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  tripActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  cancelTripBtn: {
    backgroundColor: Brand.surfaceElevated,
    borderWidth: 1,
    borderColor: Brand.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  cancelTripBtnText: {
    color: Brand.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  loadMoreBtn: {
    backgroundColor: Brand.surfaceElevated,
    borderWidth: 1,
    borderColor: Brand.border,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 12,
  },
  loadMoreBtnText: {
    color: Brand.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  badgeCount: {
    color: Brand.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  subNote: {
    color: Brand.textMuted,
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 16,
  },
  liveCardFull: {
    backgroundColor: Brand.surfacePrimary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  liveCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  busIconSquare: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: Brand.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  liveCardTitleBox: {
    flex: 1,
  },
  liveBusNumber: {
    color: Brand.text,
    fontSize: 15,
    fontWeight: '700',
  },
  liveBusPlate: {
    color: Brand.textSecondary,
    fontSize: 12,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Brand.surfaceElevated,
  },
  livePillText: {
    color: Brand.textSecondary,
    fontSize: 10,
    fontWeight: '800',
  },
  liveMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
    backgroundColor: Brand.surfaceElevated,
    borderRadius: 8,
    padding: 10,
  },
  liveMetaItem: {
    width: '48%',
  },
  liveMetaLabel: {
    color: Brand.textMuted,
    fontSize: 10,
  },
  liveMetaValue: {
    color: Brand.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  fareCard: {
    backgroundColor: Brand.surfacePrimary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  fareName: {
    color: Brand.text,
    fontSize: 15,
    fontWeight: '700',
  },
  fareRoute: {
    color: Brand.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  farePricingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  farePrice: {
    color: Brand.textSecondary,
    fontSize: 18,
    fontWeight: '800',
  },
  fareTypeLabel: {
    color: Brand.textMuted,
    fontSize: 12,
  },
  fareActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  fareActionBtn: {
    backgroundColor: Brand.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  fareActionText: {
    color: Brand.primaryText,
    fontSize: 11,
    fontWeight: '700',
  },
  fareDeleteBtn: {
    backgroundColor: Brand.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  fareDeleteText: {
    color: Brand.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  fleetCard: {
    backgroundColor: Brand.surfacePrimary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  fleetCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fleetCardTitles: {
    flex: 1,
    marginLeft: 10,
  },
  fleetTitle: {
    color: Brand.text,
    fontSize: 15,
    fontWeight: '700',
  },
  fleetPlate: {
    color: Brand.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  fleetDetailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
    backgroundColor: Brand.surfaceElevated,
    borderRadius: 8,
    padding: 8,
  },
  fleetDetailText: {
    color: Brand.textSecondary,
    fontSize: 11,
  },
  driverAvatarSquare: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: Brand.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverAvatarLetter: {
    color: Brand.text,
    fontSize: 16,
    fontWeight: '800',
  },
  driverActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  statusToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  suspendBtn: {
    backgroundColor: Brand.surfaceElevated,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  activateBtn: {
    backgroundColor: Brand.surfaceElevated,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  statusToggleText: {
    color: Brand.text,
    fontSize: 11,
    fontWeight: '700',
  },
  routeCodeBox: {
    backgroundColor: Brand.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  routeCodeText: {
    color: Brand.text,
    fontSize: 12,
    fontWeight: '800',
  },
  reportSectionCard: {
    backgroundColor: Brand.surfacePrimary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  reportSectionTitle: {
    color: Brand.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  reportHistoryCard: {
    backgroundColor: Brand.surfaceElevated,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  reportHistoryTitle: {
    color: Brand.text,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  reportHistoryStatus: {
    color: Brand.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  reportHistoryMeta: {
    color: Brand.textSecondary,
    fontSize: 11,
  },
  driverReportActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 6,
  },
  companyReportStatusButton: {
    backgroundColor: Brand.surfacePrimary,
    borderWidth: 1,
    borderColor: Brand.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  companyReportStatusButtonText: {
    color: Brand.text,
    fontSize: 11,
    fontWeight: '700',
  },
  reportGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Brand.surfaceElevated,
    borderRadius: 8,
    padding: 10,
  },
  reportItem: {
    alignItems: 'center',
  },
  reportItemVal: {
    color: Brand.textSecondary,
    fontSize: 16,
    fontWeight: '800',
  },
  reportItemLbl: {
    color: Brand.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  emptySubText: {
    color: Brand.textMuted,
    fontSize: 12,
  },
  routeUsageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Brand.border,
  },
  routeUsageLeft: {
    flex: 1,
  },
  routeUsageName: {
    color: Brand.text,
    fontSize: 13,
    fontWeight: '600',
  },
  routeUsageMeta: {
    color: Brand.textMuted,
    fontSize: 11,
  },
  routeUsageRevenue: {
    color: Brand.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  driverPassText: {
    color: Brand.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  tapCard: {
    backgroundColor: Brand.surfacePrimary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  tapRef: {
    color: Brand.text,
    fontSize: 13,
    fontWeight: '700',
  },
  tapBus: {
    color: Brand.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  tapBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  tapTime: {
    color: Brand.textMuted,
    fontSize: 11,
  },
  tapFailReason: {
    color: Brand.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  settlementCard: {
    backgroundColor: Brand.surfacePrimary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  settlePeriod: {
    color: Brand.text,
    fontSize: 14,
    fontWeight: '700',
  },
  settleAmountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Brand.surfaceElevated,
    borderRadius: 8,
    padding: 10,
    marginVertical: 10,
  },
  settleLabel: {
    color: Brand.textMuted,
    fontSize: 10,
  },
  settleVal: {
    color: Brand.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  settleNetVal: {
    color: Brand.textSecondary,
    fontSize: 14,
  },
  settleMeta: {
    color: Brand.textMuted,
    fontSize: 11,
  },
  accountCard: {
    backgroundColor: Brand.surfacePrimary,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  accountCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  accountBigAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Brand.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  accountBigAvatarText: {
    color: Brand.text,
    fontSize: 20,
    fontWeight: '800',
  },
  accountHeaderInfo: {
    flex: 1,
  },
  accountUserName: {
    color: Brand.text,
    fontSize: 17,
    fontWeight: '800',
  },
  accountUserRole: {
    color: Brand.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
  },
  accountUserEmail: {
    color: Brand.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  accountVerificationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  verificationPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  verifiedPill: {
    backgroundColor: Brand.surfaceElevated,
  },
  unverifiedPill: {
    backgroundColor: Brand.surfaceElevated,
  },
  verificationPillText: {
    color: Brand.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  accountSectionTitle: {
    color: Brand.text,
    fontSize: 15,
    fontWeight: '700',
  },
  editToggleBtn: {
    backgroundColor: Brand.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  editToggleBtnText: {
    color: Brand.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  companyInfoGrid: {
    marginTop: 8,
    marginBottom: 12,
    gap: 6,
  },
  companyInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  companyInfoLabel: {
    color: Brand.textMuted,
    fontSize: 12,
  },
  companyInfoVal: {
    color: Brand.text,
    fontSize: 12,
    fontWeight: '600',
  },
  editableFieldsSection: {
    borderTopWidth: 1,
    borderTopColor: Brand.border,
    paddingTop: 10,
  },
  fieldLabel: {
    color: Brand.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: Brand.surfaceElevated,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Brand.text,
    fontSize: 13,
  },
  textInputDisabled: {
    opacity: 0.6,
  },
  saveCompanyBtn: {
    backgroundColor: Brand.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  saveCompanyBtnText: {
    color: Brand.primaryText,
    fontSize: 13,
    fontWeight: '700',
  },
  governanceCard: {
    flexDirection: 'row',
    backgroundColor: Brand.surfacePrimary,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  govIcon: {
    marginTop: 2,
  },
  govTextContainer: {
    flex: 1,
  },
  govTitle: {
    color: Brand.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  govDesc: {
    color: Brand.textSecondary,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  supportCard: {
    backgroundColor: Brand.surfacePrimary,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  supportDesc: {
    color: Brand.textSecondary,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  supportContact: {
    color: Brand.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.surfaceElevated,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    marginTop: 6,
    marginBottom: 20,
  },
  logoutButtonText: {
    color: Brand.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: Brand.surfaceSecondary,
    borderTopWidth: 1,
    borderTopColor: Brand.border,
    paddingTop: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  navItemActive: {
    backgroundColor: Brand.teal.light,
    borderRadius: 10,
  },
  navLabel: {
    color: Brand.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  navLabelActive: {
    color: Brand.teal.primaryDark,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: Brand.surfacePrimary,
    borderRadius: 10,
    padding: 18,
    alignItems: 'center',
    marginVertical: 8,
  },
  emptyText: {
    color: Brand.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Brand.surfaceSecondary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Brand.border,
    marginBottom: 12,
  },
  modalTitle: {
    color: Brand.text,
    fontSize: 17,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: Brand.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  closeBtnText: {
    color: Brand.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  notifScroll: {
    maxHeight: 400,
  },
  notifCard: {
    backgroundColor: Brand.surfaceElevated,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notifTypePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  notifTypeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  notifDate: {
    color: Brand.textMuted,
    fontSize: 10,
  },
  notifItemTitle: {
    color: Brand.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  notifItemMsg: {
    color: Brand.textSecondary,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 8,
  },
  typeOption: {
    flex: 1,
    backgroundColor: Brand.surfaceElevated,
    borderWidth: 1,
    borderColor: Brand.border,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  typeOptionActive: {
    backgroundColor: Brand.surfaceElevated,
    borderColor: Brand.border,
  },
  typeOptionText: {
    color: Brand.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  typeOptionTextActive: {
    color: Brand.text,
  },
  selectorScroll: {
    flexDirection: 'row',
    marginVertical: 6,
  },
  selectorChip: {
    backgroundColor: Brand.surfaceElevated,
    borderWidth: 1,
    borderColor: Brand.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  selectorChipActive: {
    backgroundColor: Brand.surfaceElevated,
    borderColor: Brand.border,
  },
  selectorChipText: {
    color: Brand.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  selectorChipTextActive: {
    color: Brand.text,
    fontWeight: '700',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  searchBtn: {
    backgroundColor: Brand.surfaceElevated,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  searchBtnText: {
    color: Brand.text,
    fontSize: 12,
    fontWeight: '700',
  },
  selectedStopPill: {
    backgroundColor: Brand.surfaceElevated,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 6,
    padding: 6,
    marginVertical: 4,
  },
  selectedStopText: {
    color: Brand.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  matchItem: {
    backgroundColor: Brand.surfaceElevated,
    padding: 10,
    borderRadius: 6,
    marginVertical: 2,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  matchItemText: {
    color: Brand.textSecondary,
    fontSize: 12,
  },
  submitModalBtn: {
    backgroundColor: Brand.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  submitModalBtnText: {
    color: Brand.primaryText,
    fontSize: 14,
    fontWeight: '700',
  },
});
