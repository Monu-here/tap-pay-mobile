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
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { PrimaryButton } from '@/components/ui/primary-button';
import { Brand, Spacing } from '@/constants/theme';
import {
  getCompanyBuses,
  getCompanyDashboard,
  getCompanyDrivers,
  getCompanyRoutes,
  getCompanySettlements,
  getLiveCompanyBuses,
  storeCompanyBus,
  storeCompanyDriver,
  storeCompanyRoute,
  type CompanyBus,
  type CompanyDashboardData,
  type CompanyDriver,
  type CompanyRoute,
  type CompanySettlement,
} from '@/features/admin/services/adminApi';

export default function CompanyPortalScreen() {
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'buses' | 'drivers' | 'routes' | 'settlements'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [dashboard, setDashboard] = useState<CompanyDashboardData | null>(null);
  const [buses, setBuses] = useState<CompanyBus[]>([]);
  const [drivers, setDrivers] = useState<CompanyDriver[]>([]);
  const [routes, setRoutes] = useState<CompanyRoute[]>([]);
  const [settlements, setSettlements] = useState<CompanySettlement[]>([]);

  // Add Bus Modal
  const [busModalVisible, setBusModalVisible] = useState(false);
  const [busNumber, setBusNumber] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [capacity, setCapacity] = useState('45');
  const [addingBus, setAddingBus] = useState(false);

  // Add Driver Modal
  const [driverModalVisible, setDriverModalVisible] = useState(false);
  const [driverName, setDriverName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [addingDriver, setAddingDriver] = useState(false);

  // Add Route Modal
  const [routeModalVisible, setRouteModalVisible] = useState(false);
  const [routeCode, setRouteCode] = useState('');
  const [routeName, setRouteName] = useState('');
  const [distanceKm, setDistanceKm] = useState('15');
  const [estMinutes, setEstMinutes] = useState('45');
  const [addingRoute, setAddingRoute] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [dashRes, busesRes, driversRes, routesRes, setsRes] = await Promise.all([
        getCompanyDashboard(),
        getCompanyBuses(),
        getCompanyDrivers(),
        getCompanyRoutes(),
        getCompanySettlements(),
      ]);

      if (dashRes.ok && dashRes.data) setDashboard(dashRes.data);
      if (busesRes.ok && busesRes.data) setBuses(busesRes.data.buses || []);
      if (driversRes.ok && driversRes.data) setDrivers(driversRes.data.drivers || []);
      if (routesRes.ok && routesRes.data) setRoutes(routesRes.data.routes || []);
      if (setsRes.ok && setsRes.data) setSettlements(setsRes.data.settlements || []);
    } catch {
      // Ignored
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddBus = async () => {
    if (!busNumber || !regNumber) {
      Alert.alert('Validation', 'Bus number and registration number required.');
      return;
    }
    setAddingBus(true);
    try {
      const res = await storeCompanyBus({
        bus_number: busNumber.trim(),
        registration_number: regNumber.trim(),
        capacity: parseInt(capacity, 10) || 40,
        vehicle_type: 'bus',
      });
      if (res.ok) {
        setBusNumber('');
        setRegNumber('');
        setBusModalVisible(false);
        await loadData(true);
      } else {
        Alert.alert('Error', res.message || 'Could not register bus.');
      }
    } catch {
      Alert.alert('Error', 'Connection failure.');
    } finally {
      setAddingBus(false);
    }
  };

  const handleAddDriver = async () => {
    if (!driverName || !licenseNumber || !driverPhone) {
      Alert.alert('Validation', 'Driver name, license and phone required.');
      return;
    }
    setAddingDriver(true);
    try {
      const res = await storeCompanyDriver({
        name: driverName.trim(),
        license_number: licenseNumber.trim(),
        phone: driverPhone.trim(),
      });
      if (res.ok) {
        setDriverName('');
        setLicenseNumber('');
        setDriverPhone('');
        setDriverModalVisible(false);
        await loadData(true);
      } else {
        Alert.alert('Error', res.message || 'Could not add driver.');
      }
    } catch {
      Alert.alert('Error', 'Connection failure.');
    } finally {
      setAddingDriver(false);
    }
  };

  const handleAddRoute = async () => {
    if (!routeCode || !routeName) {
      Alert.alert('Validation', 'Route code and name required.');
      return;
    }
    setAddingRoute(true);
    try {
      const res = await storeCompanyRoute({
        code: routeCode.trim().toUpperCase(),
        name: routeName.trim(),
        origin_stop_id: 1,
        destination_stop_id: 2,
        distance_km: parseFloat(distanceKm) || 10,
        estimated_minutes: parseInt(estMinutes, 10) || 30,
      });
      if (res.ok) {
        setRouteCode('');
        setRouteName('');
        setRouteModalVisible(false);
        await loadData(true);
      } else {
        Alert.alert('Error', res.message || 'Could not create route.');
      }
    } catch {
      Alert.alert('Error', 'Connection failure.');
    } finally {
      setAddingRoute(false);
    }
  };

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
        <Text style={styles.headerTitle}>Transport Fleet Portal</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Segment Navigation */}
      <View style={styles.segmentBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segmentScroll}>
          <Pressable onPress={() => setActiveTab('dashboard')} style={[styles.tabBtn, activeTab === 'dashboard' && styles.tabBtnActive]}>
            <Text style={[styles.tabText, activeTab === 'dashboard' && styles.tabTextActive]}>Overview</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab('buses')} style={[styles.tabBtn, activeTab === 'buses' && styles.tabBtnActive]}>
            <Text style={[styles.tabText, activeTab === 'buses' && styles.tabTextActive]}>Fleet Buses ({buses.length})</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab('drivers')} style={[styles.tabBtn, activeTab === 'drivers' && styles.tabBtnActive]}>
            <Text style={[styles.tabText, activeTab === 'drivers' && styles.tabTextActive]}>Drivers ({drivers.length})</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab('routes')} style={[styles.tabBtn, activeTab === 'routes' && styles.tabBtnActive]}>
            <Text style={[styles.tabText, activeTab === 'routes' && styles.tabTextActive]}>Routes ({routes.length})</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab('settlements')} style={[styles.tabBtn, activeTab === 'settlements' && styles.tabBtnActive]}>
            <Text style={[styles.tabText, activeTab === 'settlements' && styles.tabTextActive]}>Settlements</Text>
          </Pressable>
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={Brand.teal.primary} />
        }
      >
        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Brand.teal.primary} />
            <Text style={styles.loadingText}>Fetching company operations...</Text>
          </View>
        ) : null}

        {/* --- Tab 1: Overview Dashboard --- */}
        {activeTab === 'dashboard' && dashboard && (
          <View style={styles.kpiContainer}>
            <View style={styles.metricGrid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Total Buses</Text>
                <Text style={styles.metricValue}>{dashboard.total_buses}</Text>
                <Text style={styles.metricSub}>{dashboard.active_buses} Active in Transit</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Roster Drivers</Text>
                <Text style={styles.metricValue}>{dashboard.total_drivers}</Text>
                <Text style={styles.metricSub}>Licensed Staff</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Today's Trips</Text>
                <Text style={styles.metricValue}>{dashboard.today_trips}</Text>
                <Text style={styles.metricSub}>Scheduled Journeys</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Total Taps</Text>
                <Text style={styles.metricValue}>{dashboard.today_taps_count}</Text>
                <Text style={styles.metricSub}>Passenger NFC Validations</Text>
              </View>
            </View>

            <View style={styles.revenueCard}>
              <Text style={styles.revTitle}>Today's Ticket Revenue</Text>
              <Text style={styles.revAmount}>
                {dashboard.today_revenue_formatted || `Rs. ${(dashboard.today_revenue_minor / 100).toFixed(2)}`}
              </Text>
              <Text style={styles.revSub}>Aggregated from bus NFC validator taps</Text>
            </View>
          </View>
        )}

        {/* --- Tab 2: Fleet Buses --- */}
        {activeTab === 'buses' && (
          <View style={styles.listSection}>
            <View style={styles.actionHeader}>
              <Text style={styles.sectionTitle}>Fleet Vehicles</Text>
              <Pressable onPress={() => setBusModalVisible(true)} style={styles.addBtn}>
                <Text style={styles.addBtnText}>+ Add Bus</Text>
              </Pressable>
            </View>

            {buses.map((bus) => (
              <View key={bus.id} style={styles.busRowCard}>
                <View style={styles.busTop}>
                  <View style={styles.busIconBox}>
                    <SymbolView
                      name={{ ios: 'bus.fill', android: 'directions_bus', web: 'directions_bus' }}
                      size={20}
                      tintColor="#0284C7"
                    />
                  </View>
                  <View style={styles.busInfo}>
                    <Text style={styles.busNumber}>{bus.bus_number}</Text>
                    <Text style={styles.regNumber}>{bus.registration_number}</Text>
                    <Text style={styles.busType}>Type: {bus.vehicle_type} · Cap: {bus.capacity}</Text>
                  </View>
                  <View style={[styles.statusTag, bus.status === 'active' ? styles.statusActive : styles.statusInactive]}>
                    <Text style={styles.statusTagText}>{bus.status.toUpperCase()}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* --- Tab 3: Drivers --- */}
        {activeTab === 'drivers' && (
          <View style={styles.listSection}>
            <View style={styles.actionHeader}>
              <Text style={styles.sectionTitle}>Authorized Drivers</Text>
              <Pressable onPress={() => setDriverModalVisible(true)} style={styles.addBtn}>
                <Text style={styles.addBtnText}>+ Add Driver</Text>
              </Pressable>
            </View>

            {drivers.map((d) => (
              <View key={d.id} style={styles.driverCard}>
                <View style={styles.driverTop}>
                  <View style={styles.driverAvatar}>
                    <Text style={styles.driverAvatarText}>{d.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.driverInfo}>
                    <Text style={styles.driverName}>{d.name}</Text>
                    <Text style={styles.driverLicense}>License: {d.license_number}</Text>
                    <Text style={styles.driverPhone}>Phone: {d.phone}</Text>
                  </View>
                  <View style={[styles.statusTag, d.status === 'active' ? styles.statusActive : styles.statusInactive]}>
                    <Text style={styles.statusTagText}>{d.status.toUpperCase()}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* --- Tab 4: Routes --- */}
        {activeTab === 'routes' && (
          <View style={styles.listSection}>
            <View style={styles.actionHeader}>
              <Text style={styles.sectionTitle}>Company Routes</Text>
              <Pressable onPress={() => setRouteModalVisible(true)} style={styles.addBtn}>
                <Text style={styles.addBtnText}>+ New Route</Text>
              </Pressable>
            </View>

            {routes.map((rt) => (
              <View key={rt.id} style={styles.routeItemCard}>
                <View style={styles.routeHeader}>
                  <View style={styles.codePill}>
                    <Text style={styles.codePillText}>{rt.code}</Text>
                  </View>
                  <Text style={styles.routeTitle}>{rt.name}</Text>
                </View>
                <Text style={styles.routeMetrics}>
                  {rt.distance_km} km · ~{rt.estimated_minutes} minutes duration
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* --- Tab 5: Settlements --- */}
        {activeTab === 'settlements' && (
          <View style={styles.listSection}>
            <Text style={styles.sectionTitle}>Payout Settlements</Text>
            {settlements.length > 0 ? (
              settlements.map((s) => (
                <View key={s.id} style={styles.settlementCard}>
                  <View style={styles.settlementTop}>
                    <Text style={styles.settleRef}>{s.reference}</Text>
                    <Text style={styles.settleStatus}>{s.status.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.settleAmount}>
                    Net: Rs. {(s.net_amount_minor / 100).toFixed(2)} (Gross: Rs. {(s.gross_amount_minor / 100).toFixed(2)})
                  </Text>
                  <Text style={styles.settleDate}>
                    Period: {new Date(s.period_start).toLocaleDateString()} - {new Date(s.period_end).toLocaleDateString()}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No settlement records generated yet</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Add Bus Modal */}
      <Modal visible={busModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Fleet Bus</Text>
              <Pressable onPress={() => setBusModalVisible(false)} hitSlop={8}>
                <SymbolView
                  name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                  size={24}
                  tintColor={Brand.textSecondary}
                />
              </Pressable>
            </View>

            <View style={styles.modalForm}>
              <TextInput
                style={styles.modalInput}
                value={busNumber}
                onChangeText={setBusNumber}
                placeholder="Bus Number (e.g. BA 2 KHA 1234)"
                placeholderTextColor={Brand.textSecondary}
              />
              <TextInput
                style={styles.modalInput}
                value={regNumber}
                onChangeText={setRegNumber}
                placeholder="Registration (e.g. BA-2-KHA-1234)"
                placeholderTextColor={Brand.textSecondary}
              />
              <TextInput
                style={styles.modalInput}
                value={capacity}
                onChangeText={setCapacity}
                placeholder="Passenger Capacity"
                placeholderTextColor={Brand.textSecondary}
                keyboardType="numeric"
              />

              <PrimaryButton
                title={addingBus ? 'Adding Bus...' : 'Add to Fleet'}
                onPress={handleAddBus}
                disabled={addingBus}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Driver Modal */}
      <Modal visible={driverModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Register Fleet Driver</Text>
              <Pressable onPress={() => setDriverModalVisible(false)} hitSlop={8}>
                <SymbolView
                  name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                  size={24}
                  tintColor={Brand.textSecondary}
                />
              </Pressable>
            </View>

            <View style={styles.modalForm}>
              <TextInput
                style={styles.modalInput}
                value={driverName}
                onChangeText={setDriverName}
                placeholder="Driver Full Name"
                placeholderTextColor={Brand.textSecondary}
              />
              <TextInput
                style={styles.modalInput}
                value={licenseNumber}
                onChangeText={setLicenseNumber}
                placeholder="Driving License Number"
                placeholderTextColor={Brand.textSecondary}
              />
              <TextInput
                style={styles.modalInput}
                value={driverPhone}
                onChangeText={setDriverPhone}
                placeholder="Phone (98XXXXXXXX)"
                placeholderTextColor={Brand.textSecondary}
                keyboardType="phone-pad"
              />

              <PrimaryButton
                title={addingDriver ? 'Registering...' : 'Register Driver'}
                onPress={handleAddDriver}
                disabled={addingDriver}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Route Modal */}
      <Modal visible={routeModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Transit Route</Text>
              <Pressable onPress={() => setRouteModalVisible(false)} hitSlop={8}>
                <SymbolView
                  name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                  size={24}
                  tintColor={Brand.textSecondary}
                />
              </Pressable>
            </View>

            <View style={styles.modalForm}>
              <TextInput
                style={styles.modalInput}
                value={routeCode}
                onChangeText={setRouteCode}
                placeholder="Route Code (e.g. R-105)"
                placeholderTextColor={Brand.textSecondary}
                autoCapitalize="characters"
              />
              <TextInput
                style={styles.modalInput}
                value={routeName}
                onChangeText={setRouteName}
                placeholder="Route Name (e.g. Ring Road Express)"
                placeholderTextColor={Brand.textSecondary}
              />
              <TextInput
                style={styles.modalInput}
                value={distanceKm}
                onChangeText={setDistanceKm}
                placeholder="Total Distance (km)"
                placeholderTextColor={Brand.textSecondary}
                keyboardType="numeric"
              />
              <TextInput
                style={styles.modalInput}
                value={estMinutes}
                onChangeText={setEstMinutes}
                placeholder="Estimated Duration (minutes)"
                placeholderTextColor={Brand.textSecondary}
                keyboardType="numeric"
              />

              <PrimaryButton
                title={addingRoute ? 'Creating...' : 'Create Route'}
                onPress={handleAddRoute}
                disabled={addingRoute}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>
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
  segmentBar: {
    backgroundColor: Brand.white,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  segmentScroll: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  tabBtnActive: {
    backgroundColor: Brand.teal.primary,
  },
  tabText: {
    fontSize: 13,
    color: Brand.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: Brand.white,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.four,
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
  kpiContainer: {
    gap: Spacing.four,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  metricCard: {
    width: '48%',
    backgroundColor: Brand.white,
    borderRadius: 16,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: Brand.textSecondary,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 26,
    fontWeight: '800',
    color: Brand.text,
  },
  metricSub: {
    fontSize: 11,
    color: Brand.teal.text,
    marginTop: 2,
  },
  revenueCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: Spacing.five,
    gap: Spacing.two,
  },
  revTitle: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
  },
  revAmount: {
    fontSize: 34,
    fontWeight: '800',
    color: '#4ADE80',
    marginVertical: 4,
  },
  revSub: {
    fontSize: 12,
    color: '#94A3B8',
  },
  listSection: {
    gap: Spacing.three,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Brand.text,
  },
  addBtn: {
    backgroundColor: Brand.teal.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnText: {
    color: Brand.white,
    fontSize: 13,
    fontWeight: '700',
  },
  busRowCard: {
    backgroundColor: Brand.white,
    borderRadius: 14,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  busTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  busIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  busInfo: {
    flex: 1,
  },
  busNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.text,
  },
  regNumber: {
    fontSize: 12,
    color: Brand.textSecondary,
    marginTop: 2,
  },
  busType: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    textTransform: 'capitalize',
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
  driverCard: {
    backgroundColor: Brand.white,
    borderRadius: 14,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  driverTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Brand.teal.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.teal.text,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.text,
  },
  driverLicense: {
    fontSize: 12,
    color: Brand.textSecondary,
    marginTop: 2,
  },
  driverPhone: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  routeItemCard: {
    backgroundColor: Brand.white,
    borderRadius: 14,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  codePill: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  codePillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0284C7',
  },
  routeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.text,
    flex: 1,
  },
  routeMetrics: {
    fontSize: 12,
    color: Brand.textSecondary,
  },
  settlementCard: {
    backgroundColor: Brand.white,
    borderRadius: 14,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  settlementTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  settleRef: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.text,
  },
  settleStatus: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  settleAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.teal.text,
  },
  settleDate: {
    fontSize: 11,
    color: Brand.textSecondary,
  },
  emptyCard: {
    backgroundColor: Brand.white,
    borderRadius: 14,
    padding: Spacing.five,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyText: {
    fontSize: 13,
    color: Brand.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: Brand.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.text,
  },
  modalForm: {
    gap: Spacing.three,
  },
  modalInput: {
    backgroundColor: Brand.inputBackground,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    height: 48,
    fontSize: 15,
    color: Brand.text,
  },
  modalBtn: {
    marginTop: Spacing.two,
  },
});
