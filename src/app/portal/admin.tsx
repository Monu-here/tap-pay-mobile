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
  changeCompanyStatus,
  createPlatformCompany,
  getPlatformAuditLogs,
  getPlatformCompanies,
  getPlatformDashboard,
  getPlatformSettings,
  getPlatformUsers,
  reinstatePlatformUser,
  suspendPlatformUser,
  type AuditLogEntry,
  type PlatformCompany,
  type PlatformDashboardData,
  type PlatformSettings,
  type PlatformUser,
} from '@/features/admin/services/adminApi';

export default function AdminPortalScreen() {
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'kpi' | 'companies' | 'users' | 'audit' | 'settings'>('kpi');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data
  const [dashboard, setDashboard] = useState<PlatformDashboardData | null>(null);
  const [companies, setCompanies] = useState<PlatformCompany[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);

  // Create Company Modal
  const [companyModalVisible, setCompanyModalVisible] = useState(false);
  const [compName, setCompName] = useState('');
  const [compCode, setCompCode] = useState('');
  const [compEmail, setCompEmail] = useState('');
  const [compPhone, setCompPhone] = useState('');
  const [compAddress, setCompAddress] = useState('');
  const [creatingComp, setCreatingComp] = useState(false);

  const loadAdminData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [dashRes, compsRes, usersRes, logsRes, setsRes] = await Promise.all([
        getPlatformDashboard(),
        getPlatformCompanies(1),
        getPlatformUsers(1),
        getPlatformAuditLogs(1),
        getPlatformSettings(),
      ]);

      if (dashRes.ok && dashRes.data) setDashboard(dashRes.data);
      if (compsRes.ok && compsRes.data) setCompanies(compsRes.data.companies || []);
      if (usersRes.ok && usersRes.data) setUsers(usersRes.data.users || []);
      if (logsRes.ok && logsRes.data) setLogs(logsRes.data.logs || []);
      if (setsRes.ok && setsRes.data) setSettings(setsRes.data);
    } catch {
      // Ignored
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const handleCreateCompany = async () => {
    if (!compName || !compCode || !compEmail || !compPhone) {
      Alert.alert('Validation', 'Please fill in company name, code, email and phone.');
      return;
    }

    setCreatingComp(true);
    try {
      const res = await createPlatformCompany({
        name: compName.trim(),
        code: compCode.trim().toUpperCase(),
        email: compEmail.trim(),
        phone: compPhone.trim(),
        address: compAddress.trim() || undefined,
      });

      if (res.ok) {
        setCompName('');
        setCompCode('');
        setCompEmail('');
        setCompPhone('');
        setCompAddress('');
        setCompanyModalVisible(false);
        await loadAdminData(true);
      } else {
        Alert.alert('Error', res.message || 'Could not register company.');
      }
    } catch {
      Alert.alert('Error', 'Connection failure.');
    } finally {
      setCreatingComp(false);
    }
  };

  const handleToggleCompanyStatus = async (comp: PlatformCompany) => {
    const newStatus = comp.status === 'active' ? 'suspended' : 'active';
    try {
      const res = await changeCompanyStatus(comp.id, newStatus);
      if (res.ok) {
        await loadAdminData(true);
      } else {
        Alert.alert('Error', res.message || 'Failed to update status.');
      }
    } catch {
      Alert.alert('Error', 'Network error.');
    }
  };

  const handleToggleUserStatus = async (u: PlatformUser) => {
    try {
      let res;
      if (u.status === 'suspended') {
        res = await reinstatePlatformUser(u.id);
      } else {
        res = await suspendPlatformUser(u.id);
      }
      if (res.ok) {
        await loadAdminData(true);
      } else {
        Alert.alert('Error', res.message || 'Failed to update user status.');
      }
    } catch {
      Alert.alert('Error', 'Network error.');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Top Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <SymbolView
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            size={22}
            tintColor={Brand.white}
          />
        </Pressable>
        <Text style={styles.headerTitle}>Super-Admin Platform</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Segment Navigation */}
      <View style={styles.segmentBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segmentScroll}>
          <Pressable onPress={() => setActiveTab('kpi')} style={[styles.tabBtn, activeTab === 'kpi' && styles.tabBtnActive]}>
            <Text style={[styles.tabText, activeTab === 'kpi' && styles.tabTextActive]}>KPI Overview</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab('companies')} style={[styles.tabBtn, activeTab === 'companies' && styles.tabBtnActive]}>
            <Text style={[styles.tabText, activeTab === 'companies' && styles.tabTextActive]}>Companies ({companies.length})</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab('users')} style={[styles.tabBtn, activeTab === 'users' && styles.tabBtnActive]}>
            <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>Users ({users.length})</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab('audit')} style={[styles.tabBtn, activeTab === 'audit' && styles.tabBtnActive]}>
            <Text style={[styles.tabText, activeTab === 'audit' && styles.tabTextActive]}>Audit Logs</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab('settings')} style={[styles.tabBtn, activeTab === 'settings' && styles.tabBtnActive]}>
            <Text style={[styles.tabText, activeTab === 'settings' && styles.tabTextActive]}>Settings</Text>
          </Pressable>
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadAdminData(true)} tintColor={Brand.primary} />
        }
      >
        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Brand.primary} />
            <Text style={styles.loadingText}>Loading platform metrics...</Text>
          </View>
        ) : null}

        {/* --- Tab 1: KPI Dashboard --- */}
        {activeTab === 'kpi' && dashboard && (
          <View style={styles.kpiContainer}>
            <View style={styles.metricGrid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Total Companies</Text>
                <Text style={styles.metricValue}>{dashboard.companies_count}</Text>
                <Text style={styles.metricSub}>{dashboard.active_companies} Active Operators</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Passengers</Text>
                <Text style={styles.metricValue}>{dashboard.total_passengers || dashboard.total_users}</Text>
                <Text style={styles.metricSub}>Registered Riders</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Fleet Buses</Text>
                <Text style={styles.metricValue}>{dashboard.total_buses}</Text>
                <Text style={styles.metricSub}>NFC Enabled</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>NFC Cards</Text>
                <Text style={styles.metricValue}>{dashboard.total_cards}</Text>
                <Text style={styles.metricSub}>Issued Tokens</Text>
              </View>
            </View>

            <View style={styles.volumeCard}>
              <Text style={styles.volumeTitle}>Monthly Platform Transaction Volume</Text>
              <Text style={styles.volumeAmount}>
                {dashboard.monthly_volume_formatted || `Rs. ${(dashboard.monthly_volume_minor / 100).toFixed(2)}`}
              </Text>
              <View style={styles.healthRow}>
                <View style={styles.healthDot} />
                <Text style={styles.healthText}>System Health: {dashboard.system_health || 'OPTIMAL (100%)'}</Text>
              </View>
            </View>
          </View>
        )}

        {/* --- Tab 2: Transport Companies Management --- */}
        {activeTab === 'companies' && (
          <View style={styles.listSection}>
            <View style={styles.actionHeader}>
              <Text style={styles.sectionTitle}>Registered Companies</Text>
              <Pressable onPress={() => setCompanyModalVisible(true)} style={styles.addBtn}>
                <Text style={styles.addBtnText}>+ New Company</Text>
              </Pressable>
            </View>

            {companies.map((c) => (
              <View key={c.id} style={styles.companyRowCard}>
                <View style={styles.compTop}>
                  <View>
                    <Text style={styles.compTitle}>{c.name}</Text>
                    <Text style={styles.compSub}>Code: {c.code} · Phone: {c.phone}</Text>
                  </View>
                  <Pressable
                    onPress={() => handleToggleCompanyStatus(c)}
                    style={[styles.statusToggle, c.status === 'active' ? styles.statusActive : styles.statusSuspended]}
                  >
                    <Text style={styles.statusToggleText}>{c.status.toUpperCase()}</Text>
                  </Pressable>
                </View>
                <Text style={styles.compEmail}>{c.email}</Text>
              </View>
            ))}
          </View>
        )}

        {/* --- Tab 3: Users Directory --- */}
        {activeTab === 'users' && (
          <View style={styles.listSection}>
            <Text style={styles.sectionTitle}>Platform User Directory</Text>
            {users.map((u) => (
              <View key={u.id} style={styles.userCard}>
                <View style={styles.userTop}>
                  <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>{u.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{u.name}</Text>
                    <Text style={styles.userEmail}>{u.email}</Text>
                    <Text style={styles.userTypeTag}>{(u.type || 'passenger').toUpperCase()}</Text>
                  </View>
                  <Pressable
                    onPress={() => handleToggleUserStatus(u)}
                    style={[styles.userActionBtn, u.status === 'suspended' ? styles.btnReinstate : styles.btnSuspend]}
                  >
                    <Text style={styles.userActionText}>
                      {u.status === 'suspended' ? 'Reinstate' : 'Suspend'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* --- Tab 4: Audit Logs --- */}
        {activeTab === 'audit' && (
          <View style={styles.listSection}>
            <Text style={styles.sectionTitle}>Platform Security Audit Trail</Text>
            {logs.map((log) => (
              <View key={log.id} style={styles.logCard}>
                <View style={styles.logTop}>
                  <Text style={styles.logAction}>{log.action}</Text>
                  <Text style={styles.logDate}>{new Date(log.created_at).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.logActor}>Actor: {log.user_name || log.user_email || 'System'}</Text>
                {log.ip_address && <Text style={styles.logIp}>IP: {log.ip_address}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* --- Tab 5: Settings --- */}
        {activeTab === 'settings' && (
          <View style={styles.listSection}>
            <Text style={styles.sectionTitle}>Platform Parameters</Text>
            <View style={styles.settingsCard}>
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Operating Currency</Text>
                <Text style={styles.settingVal}>{settings?.currency || 'NPR (Nepalese Rupee)'}</Text>
              </View>
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Phone Dev Verification Mode</Text>
                <Text style={styles.settingVal}>ENABLED (123456)</Text>
              </View>
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Payment Gateways</Text>
                <Text style={styles.settingVal}>Dummy Simulator, eSewa, Khalti</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Register Company Modal */}
      <Modal visible={companyModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Register Transport Company</Text>
              <Pressable onPress={() => setCompanyModalVisible(false)} hitSlop={8}>
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
                value={compName}
                onChangeText={setCompName}
                placeholder="Company Name (e.g. Sajha Yatayat)"
                placeholderTextColor={Brand.textSecondary}
              />
              <TextInput
                style={styles.modalInput}
                value={compCode}
                onChangeText={setCompCode}
                placeholder="Code (e.g. SAJHA)"
                placeholderTextColor={Brand.textSecondary}
                autoCapitalize="characters"
              />
              <TextInput
                style={styles.modalInput}
                value={compEmail}
                onChangeText={setCompEmail}
                placeholder="Contact Email"
                placeholderTextColor={Brand.textSecondary}
                keyboardType="email-address"
              />
              <TextInput
                style={styles.modalInput}
                value={compPhone}
                onChangeText={setCompPhone}
                placeholder="Phone Number"
                placeholderTextColor={Brand.textSecondary}
              />
              <TextInput
                style={styles.modalInput}
                value={compAddress}
                onChangeText={setCompAddress}
                placeholder="Headquarters Address"
                placeholderTextColor={Brand.textSecondary}
              />

              <PrimaryButton
                title={creatingComp ? 'Registering...' : 'Register Company'}
                onPress={handleCreateCompany}
                disabled={creatingComp}
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
  segmentBar: {
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  segmentScroll: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#1E293B',
  },
  tabBtnActive: {
    backgroundColor: Brand.primary,
  },
  tabText: {
    fontSize: 13,
    color: '#94A3B8',
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
    color: '#94A3B8',
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
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: Spacing.four,
    gap: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 26,
    fontWeight: '800',
    color: Brand.white,
  },
  metricSub: {
    fontSize: 11,
    color: '#38BDF8',
    marginTop: 2,
  },
  volumeCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: Spacing.five,
    gap: Spacing.two,
  },
  volumeTitle: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
  },
  volumeAmount: {
    fontSize: 34,
    fontWeight: '800',
    color: '#4ADE80',
    marginVertical: 4,
  },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
  },
  healthText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
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
    color: Brand.white,
  },
  addBtn: {
    backgroundColor: Brand.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnText: {
    color: Brand.white,
    fontSize: 13,
    fontWeight: '700',
  },
  companyRowCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: Spacing.four,
    gap: 6,
  },
  compTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  compTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.white,
  },
  compSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  compEmail: {
    fontSize: 13,
    color: '#38BDF8',
  },
  statusToggle: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: '#166534',
  },
  statusSuspended: {
    backgroundColor: '#991B1B',
  },
  statusToggleText: {
    fontSize: 10,
    fontWeight: '800',
    color: Brand.white,
  },
  userCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: Spacing.three,
  },
  userTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: Brand.white,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.white,
  },
  userEmail: {
    fontSize: 12,
    color: '#94A3B8',
  },
  userTypeTag: {
    fontSize: 10,
    color: '#38BDF8',
    fontWeight: '700',
    marginTop: 2,
  },
  userActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  btnSuspend: {
    backgroundColor: '#991B1B',
  },
  btnReinstate: {
    backgroundColor: '#166534',
  },
  userActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: Brand.white,
  },
  logCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: Spacing.three,
    gap: 4,
  },
  logTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  logAction: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38BDF8',
  },
  logDate: {
    fontSize: 11,
    color: '#94A3B8',
  },
  logActor: {
    fontSize: 12,
    color: Brand.white,
  },
  logIp: {
    fontSize: 11,
    color: '#64748B',
  },
  settingsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  settingItem: {
    gap: 2,
  },
  settingLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  settingVal: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#1E293B',
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
    color: Brand.white,
  },
  modalForm: {
    gap: Spacing.three,
  },
  modalInput: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    height: 48,
    fontSize: 15,
    color: Brand.white,
  },
  modalBtn: {
    marginTop: Spacing.two,
  },
});
