import {AppText, AppTextInput } from '@/components/typography/app-text';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useNavigation } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { PrimaryButton } from '@/components/ui/primary-button';
import { Brand, Monochrome, Spacing } from '@/constants/theme';
import { logout } from '@/features/auth/services/auth';
import { getSession } from '@/features/auth/session';
import { useNotificationCount } from '@/features/notifications/useNotificationCount';
import {
  changeCompanyStatus,
  createPlatformCompany,
  getPlatformAuditLogs,
  getPlatformBuses,
  getPlatformCompanies,
  getCompanyStaff,
  getPlatformCompany,
  getPlatformDashboard,
  getPlatformPayments,
  getPlatformSettings,
  getPlatformSystemHealth,
  getPlatformTrips,
  getPlatformUsers,
  inviteCompanyStaff,
  reinstatePlatformUser,
  revokeCompanyStaff,
  suspendPlatformUser,
  updatePlatformSettings,
  type AuditLogEntry,
  type CompanyStaffMembership,
  type PlatformCompany,
  type PlatformBus,
  type PlatformDashboardData,
  type PlatformListQuery,
  type PlatformPayment,
  type PlatformPaymentsData,
  type PlatformQrPayment,
  type PlatformSettings,
  type PlatformSettingsUpdate,
  type PlatformSystemHealth,
  type PlatformTrip,
  type PlatformUser,
} from '@/features/admin/services/adminApi';

type DashboardPeriod = 'today' | '7d' | '30d';
type AdminTab = 'kpi' | 'companies' | 'users' | 'fleet' | 'trips' | 'payments' | 'audit' | 'settings';
type SettingsCategoryId =
  | 'general' | 'appearance' | 'transport' | 'payments' | 'companies' | 'users'
  | 'security' | 'notifications' | 'tracking' | 'roles' | 'reports' | 'integrations'
  | 'health' | 'audit';

const SETTINGS_CATEGORIES: {
  id: SettingsCategoryId;
  title: string;
  description: string;
  status: 'editable' | 'limited' | 'read-only' | 'unavailable';
}[] = [
  { id: 'general', title: 'General platform settings', description: 'Platform identity, support contacts, language, timezone, notices and help links.', status: 'editable' },
  { id: 'appearance', title: 'Branding and appearance', description: 'The mobile app uses the Tap & Pay light teal palette. Custom colors and per-company themes are not supported.', status: 'read-only' },
  { id: 'transport', title: 'Transport and fare policies', description: 'Current wallet fare guardrails are enforced. Fare rules remain managed through company fare workflows.', status: 'limited' },
  { id: 'payments', title: 'Payments and wallets', description: 'Wallet top-up and balance limits are editable. Provider credentials and payment verification remain server-managed.', status: 'limited' },
  { id: 'companies', title: 'Company management policies', description: 'Control whether platform company registrations are accepted and whether newly created companies must remain pending approval.', status: 'editable' },
  { id: 'users', title: 'User and account policies', description: 'Manage verification code lifetime, attempt count and resend cooldown through the existing verification workflow.', status: 'editable' },
  { id: 'security', title: 'Authentication and security', description: 'Configure bounded login throttles. Token lifetime, authorization and lockout controls remain protected by the backend.', status: 'limited' },
  { id: 'notifications', title: 'Notifications and communication', description: 'View safe email and WhatsApp configuration state. Push delivery is unavailable; this screen does not send test messages.', status: 'read-only' },
  { id: 'tracking', title: 'GPS and live bus tracking', description: 'Change the server-enforced stale-location threshold used by platform fleet status.', status: 'editable' },
  { id: 'roles', title: 'Roles and permissions', description: 'Review database roles alongside the exact application permission matrix used to issue API token abilities. Editing is disabled because this matrix is code-enforced.', status: 'read-only' },
  { id: 'reports', title: 'Reports and data export', description: 'Report export and retention controls are not implemented by the current backend.', status: 'unavailable' },
  { id: 'integrations', title: 'Integrations and API configuration', description: 'Shows safe payment, email, WhatsApp, map, push and queue configuration status. No secrets or fake provider checks.', status: 'read-only' },
  { id: 'health', title: 'System health and maintenance', description: 'Live database and cache probes. Queue worker health is explicitly unverified; maintenance mode is not enabled.', status: 'read-only' },
  { id: 'audit', title: 'Audit logs and administrative controls', description: 'Settings changes include the acting administrator, reason, changed keys and redacted before/after values.', status: 'limited' },
];

const ADMIN_MENU_GROUPS: {
  title: string;
  items: { tab: AdminTab; label: string; detail: string }[];
}[] = [
  {
    title: 'OVERVIEW',
    items: [{ tab: 'kpi', label: 'Platform overview', detail: 'Platform activity and service health' }],
  },
  {
    title: 'ORGANIZATION',
    items: [{ tab: 'companies', label: 'Companies', detail: 'Transport company administration' }],
  },
  {
    title: 'PEOPLE',
    items: [{ tab: 'users', label: 'Passengers and staff', detail: 'Find and manage platform accounts' }],
  },
  {
    title: 'OPERATIONS',
    items: [
      { tab: 'fleet', label: 'Fleet and live tracking', detail: 'Vehicles and location freshness' },
      { tab: 'trips', label: 'Trips', detail: 'Trip activity and status' },
    ],
  },
  {
    title: 'FINANCE',
    items: [{ tab: 'payments', label: 'Payments', detail: 'Wallet top-ups and transport transactions' }],
  },
  {
    title: 'PLATFORM GOVERNANCE',
    items: [
      { tab: 'audit', label: 'Audit logs', detail: 'Administrative changes and history' },
      { tab: 'settings', label: 'Settings', detail: 'Policies, integrations and configuration' },
    ],
  },
];

function dateForApi(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dashboardDateRange(period: DashboardPeriod) {
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

function LoadMoreButton({
  busy,
  onPress,
  styles,
}: {
  busy: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable accessibilityRole="button" disabled={busy} onPress={onPress} style={styles.loadMoreButton}>
      {busy ? <ActivityIndicator color={Brand.primary} /> : <AppText style={styles.loadMoreText}>Load more</AppText>}
    </Pressable>
  );
}

export default function AdminPortalScreen() {
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotificationCount();
  const navigation = useNavigation();
  const allowRouteRemovalRef = useRef(false);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<PlatformSettings | null>(null);
  const styles = useMemo(() => createStyles(), []);

  const [activeTab, setActiveTab] = useState<AdminTab>('kpi');
  const [menuVisible, setMenuVisible] = useState(false);
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const session = getSession();
  const [period, setPeriod] = useState<DashboardPeriod>('30d');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');
  const [userCompanyFilter, setUserCompanyFilter] = useState('');
  const [companyStatusFilter, setCompanyStatusFilter] = useState('');
  const [fleetTrackingFilter, setFleetTrackingFilter] = useState<'' | 'live' | 'stale' | 'unknown'>('');
  const [tripStatusFilter, setTripStatusFilter] = useState('');
  const [auditFilterDraft, setAuditFilterDraft] = useState({ action: '', actorId: '', dateFrom: '', dateTo: '', settingCategory: '' });
  const [auditFilters, setAuditFilters] = useState({ action: '', actorId: '', dateFrom: '', dateTo: '', settingCategory: '' });

  // Data
  const [dashboard, setDashboard] = useState<PlatformDashboardData | null>(null);
  const [companies, setCompanies] = useState<PlatformCompany[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [buses, setBuses] = useState<PlatformBus[]>([]);
  const [trips, setTrips] = useState<PlatformTrip[]>([]);
  const [payments, setPayments] = useState<PlatformPayment[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<PlatformPaymentsData['summary']>({});
  const [qrPayments, setQrPayments] = useState<PlatformQrPayment[]>([]);
  const [qrPaymentSummary, setQrPaymentSummary] = useState<PlatformPaymentsData['qr_summary']>({});
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [settingsCategory, setSettingsCategory] = useState<SettingsCategoryId | null>(null);
  const [settingsSearch, setSettingsSearch] = useState('');
  const [settingsReason, setSettingsReason] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [systemHealth, setSystemHealth] = useState<PlatformSystemHealth | null>(null);
  const [companyCursor, setCompanyCursor] = useState<string | null>(null);
  const [userCursor, setUserCursor] = useState<string | null>(null);
  const [auditCursor, setAuditCursor] = useState<string | null>(null);
  const [busCursor, setBusCursor] = useState<string | null>(null);
  const [tripCursor, setTripCursor] = useState<string | null>(null);
  const [paymentCursor, setPaymentCursor] = useState<string | null>(null);
  const [qrPaymentCursor, setQrPaymentCursor] = useState<string | null>(null);
  const [moreBusy, setMoreBusy] = useState(false);

  // Create Company Modal
  const [companyModalVisible, setCompanyModalVisible] = useState(false);
  const [compName, setCompName] = useState('');
  const [compCode, setCompCode] = useState('');
  const [compRegistration, setCompRegistration] = useState('');
  const [compEmail, setCompEmail] = useState('');
  const [compPhone, setCompPhone] = useState('');
  const [compAddress, setCompAddress] = useState('');
  const [initialAdminName, setInitialAdminName] = useState('');
  const [initialAdminEmail, setInitialAdminEmail] = useState('');
  const [initialAdminPassword, setInitialAdminPassword] = useState('');
  const [initialAdminPasswordConfirm, setInitialAdminPasswordConfirm] = useState('');
  const [creatingComp, setCreatingComp] = useState(false);
  const [companyDetail, setCompanyDetail] = useState<PlatformCompany | null>(null);
  const [companyStaff, setCompanyStaff] = useState<CompanyStaffMembership[]>([]);
  const [companyDetailVisible, setCompanyDetailVisible] = useState(false);
  const [companyDetailLoading, setCompanyDetailLoading] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [invitingStaff, setInvitingStaff] = useState(false);

  const loadAdminData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);

    try {
      const userQuery: PlatformListQuery = {
        search: searchQuery,
        type: userTypeFilter || undefined,
        status: userStatusFilter || undefined,
        companyId: userCompanyFilter ? Number(userCompanyFilter) : undefined,
      };
      const range = dashboardDateRange(period);
      const [dashRes, compsRes, usersRes, logsRes, setsRes, healthRes, busesRes, tripsRes, paymentsRes] = await Promise.all([
        getPlatformDashboard(dashboardDateRange(period)),
        getPlatformCompanies({ search: searchQuery, status: companyStatusFilter || undefined }),
        getPlatformUsers(userQuery),
        getPlatformAuditLogs({
          action: auditFilters.action || undefined,
          actorId: auditFilters.actorId ? Number(auditFilters.actorId) : undefined,
          dateFrom: auditFilters.dateFrom || undefined,
          dateTo: auditFilters.dateTo || undefined,
          settingCategory: auditFilters.settingCategory || undefined,
        }),
        getPlatformSettings(),
        getPlatformSystemHealth(),
        getPlatformBuses({ search: searchQuery, tracking: fleetTrackingFilter || undefined }),
        getPlatformTrips({
          search: searchQuery,
          status: tripStatusFilter || undefined,
          dateFrom: range.date_from,
          dateTo: range.date_to,
        }),
        getPlatformPayments({ dateFrom: range.date_from, dateTo: range.date_to }),
      ]);

      if (dashRes.ok && dashRes.data) setDashboard(dashRes.data);
      else if (!dashRes.ok) setLoadError(dashRes.message || 'Could not load platform dashboard.');
      if (compsRes.ok && compsRes.data) {
        setCompanies(compsRes.data.companies);
        setCompanyCursor(nextCursor(compsRes.meta));
      } else if (!compsRes.ok) setLoadError((error) => error ?? compsRes.message ?? 'Could not load companies.');
      if (usersRes.ok && usersRes.data) {
        setUsers(usersRes.data.users);
        setUserCursor(nextCursor(usersRes.meta));
      } else if (!usersRes.ok) setLoadError((error) => error ?? usersRes.message ?? 'Could not load users.');
      if (logsRes.ok && logsRes.data) {
        setLogs(logsRes.data.logs || []);
        setAuditCursor(nextCursor(logsRes.meta));
      } else if (!logsRes.ok) setLoadError((error) => error ?? logsRes.message ?? 'Could not load audit logs.');
      if (setsRes.ok && setsRes.data) {
        setSettings(setsRes.data);
        setSettingsDraft(setsRes.data);
      }
      else if (!setsRes.ok) setLoadError((error) => error ?? setsRes.message ?? 'Could not load platform settings.');
      if (healthRes.ok && healthRes.data) setSystemHealth(healthRes.data);
      else if (!healthRes.ok) setLoadError((error) => error ?? healthRes.message ?? 'Could not load system health.');
      if (busesRes.ok && busesRes.data) {
        setBuses(busesRes.data.buses);
        setBusCursor(nextCursor(busesRes.meta));
      } else if (!busesRes.ok) setLoadError((error) => error ?? busesRes.message ?? 'Could not load fleet.');
      if (tripsRes.ok && tripsRes.data) {
        setTrips(tripsRes.data.trips);
        setTripCursor(nextCursor(tripsRes.meta));
      } else if (!tripsRes.ok) setLoadError((error) => error ?? tripsRes.message ?? 'Could not load trips.');
      if (paymentsRes.ok && paymentsRes.data) {
        setPayments(paymentsRes.data.payments);
        setPaymentSummary(paymentsRes.data.summary);
        setPaymentCursor(nextCursor(paymentsRes.meta));
        setQrPayments(paymentsRes.data.qr_payments);
        setQrPaymentSummary(paymentsRes.data.qr_summary);
        setQrPaymentCursor(typeof paymentsRes.meta?.qr_next_cursor === 'string' ? paymentsRes.meta.qr_next_cursor : null);
      } else if (!paymentsRes.ok) setLoadError((error) => error ?? paymentsRes.message ?? 'Could not load payment records.');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load platform administration data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    companyStatusFilter,
    auditFilters.action,
    auditFilters.actorId,
    auditFilters.dateFrom,
    auditFilters.dateTo,
    auditFilters.settingCategory,
    fleetTrackingFilter,
    period,
    searchQuery,
    tripStatusFilter,
    userCompanyFilter,
    userStatusFilter,
    userTypeFilter,
  ]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadAdminData();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadAdminData]);

  const loadMore = async (kind: 'companies' | 'users' | 'audit' | 'fleet' | 'trips' | 'payments' | 'qrPayments') => {
    const cursor = kind === 'companies'
      ? companyCursor
      : kind === 'users'
        ? userCursor
        : kind === 'audit'
          ? auditCursor
          : kind === 'fleet'
            ? busCursor
            : kind === 'trips'
              ? tripCursor
              : kind === 'payments'
                ? paymentCursor
                : qrPaymentCursor;
    if (!cursor || moreBusy) return;
    setMoreBusy(true);
    try {
      if (kind === 'companies') {
        const result = await getPlatformCompanies({
          cursor,
          search: searchQuery,
          status: companyStatusFilter || undefined,
        });
        if (!result.ok || !result.data) {
          setLoadError(result.message || 'Could not load more companies.');
          return;
        }
        setCompanies((items) => [...items, ...result.data.companies]);
        setCompanyCursor(nextCursor(result.meta));
      } else if (kind === 'users') {
        const result = await getPlatformUsers({
          cursor,
          search: searchQuery,
          type: userTypeFilter || undefined,
          status: userStatusFilter || undefined,
          companyId: userCompanyFilter ? Number(userCompanyFilter) : undefined,
        });
        if (!result.ok || !result.data) {
          setLoadError(result.message || 'Could not load more users.');
          return;
        }
        setUsers((items) => [...items, ...result.data.users]);
        setUserCursor(nextCursor(result.meta));
      } else if (kind === 'audit') {
        const result = await getPlatformAuditLogs({ cursor });
        if (!result.ok || !result.data) {
          setLoadError(result.message || 'Could not load more audit logs.');
          return;
        }
        setLogs((items) => [...items, ...result.data.logs]);
        setAuditCursor(nextCursor(result.meta));
      } else if (kind === 'fleet') {
        const result = await getPlatformBuses({
          cursor,
          search: searchQuery,
          tracking: fleetTrackingFilter || undefined,
        });
        if (!result.ok || !result.data) {
          setLoadError(result.message || 'Could not load more buses.');
          return;
        }
        setBuses((items) => [...items, ...result.data.buses]);
        setBusCursor(nextCursor(result.meta));
      } else if (kind === 'trips') {
        const range = dashboardDateRange(period);
        const result = await getPlatformTrips({
          cursor,
          search: searchQuery,
          status: tripStatusFilter || undefined,
          dateFrom: range.date_from,
          dateTo: range.date_to,
        });
        if (!result.ok || !result.data) {
          setLoadError(result.message || 'Could not load more trips.');
          return;
        }
        setTrips((items) => [...items, ...result.data.trips]);
        setTripCursor(nextCursor(result.meta));
      } else if (kind === 'payments') {
        const range = dashboardDateRange(period);
        const result = await getPlatformPayments({
          cursor,
          dateFrom: range.date_from,
          dateTo: range.date_to,
        });
        if (!result.ok || !result.data) {
          setLoadError(result.message || 'Could not load more payments.');
          return;
        }
        setPayments((items) => [...items, ...result.data.payments]);
        setPaymentCursor(nextCursor(result.meta));
      } else {
        const range = dashboardDateRange(period);
        const result = await getPlatformPayments({
          qrCursor: cursor,
          dateFrom: range.date_from,
          dateTo: range.date_to,
        });
        if (!result.ok || !result.data) {
          setLoadError(result.message || 'Could not load more QR payments.');
          return;
        }
        setQrPayments((items) => [...items, ...result.data.qr_payments]);
        setQrPaymentSummary(result.data.qr_summary);
        setQrPaymentCursor(typeof result.meta?.qr_next_cursor === 'string' ? result.meta.qr_next_cursor : null);
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : `Unable to load more ${kind}.`);
    } finally {
      setMoreBusy(false);
    }
  };

  const handleCreateCompany = async () => {
    if (!compName.trim() || !compCode.trim() || !compRegistration.trim() || !compEmail.trim() || !compPhone.trim()) {
      Alert.alert('Validation', 'Please fill in company name, code, registration number, email and phone.');
      return;
    }
    if (!initialAdminName.trim() || !initialAdminEmail.trim() || !initialAdminPassword || !initialAdminPasswordConfirm) {
      Alert.alert('Validation', 'Create the first company admin with a name, email, and password.');
      return;
    }
    if (initialAdminPassword !== initialAdminPasswordConfirm) {
      Alert.alert('Validation', 'The initial admin passwords do not match.');
      return;
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/.test(initialAdminPassword)) {
      Alert.alert('Validation', 'Use a 10+ character password with uppercase, lowercase, number and symbol.');
      return;
    }

    setCreatingComp(true);
    try {
      const res = await createPlatformCompany({
        name: compName.trim(),
        code: compCode.trim().toUpperCase(),
        registration_number: compRegistration.trim(),
        email: compEmail.trim(),
        phone: compPhone.trim(),
        address: compAddress.trim() || undefined,
        initial_admin: {
          name: initialAdminName.trim(),
          email: initialAdminEmail.trim(),
          password: initialAdminPassword,
          password_confirmation: initialAdminPasswordConfirm,
        },
      });

      if (res.ok) {
        setCompName('');
        setCompCode('');
        setCompRegistration('');
        setCompEmail('');
        setCompPhone('');
        setCompAddress('');
        setInitialAdminName('');
        setInitialAdminEmail('');
        setInitialAdminPassword('');
        setInitialAdminPasswordConfirm('');
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
    Alert.alert(
      `${newStatus === 'suspended' ? 'Suspend' : 'Activate'} ${comp.name}?`,
      newStatus === 'suspended'
        ? 'Company operations may be interrupted until it is reactivated.'
        : 'This company will be allowed to operate on the platform.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: newStatus === 'suspended' ? 'Suspend company' : 'Activate company',
          style: newStatus === 'suspended' ? 'destructive' : 'default',
          onPress: () => {
            void (async () => {
              const res = await changeCompanyStatus(comp.id, newStatus);
              if (res.ok) await loadAdminData(true);
              else Alert.alert('Error', res.message || 'Failed to update status.');
            })();
          },
        },
      ],
    );
  };

  const openCompanyDetails = async (company: PlatformCompany) => {
    setCompanyDetail(company);
    setCompanyDetailVisible(true);
    setCompanyDetailLoading(true);
    try {
      const [companyResult, staffResult] = await Promise.all([
        getPlatformCompany(company.id),
        getCompanyStaff(company.id),
      ]);
      if (companyResult.ok && companyResult.data) setCompanyDetail(companyResult.data.company);
      else if (!companyResult.ok) Alert.alert('Company details unavailable', companyResult.message || 'Please retry.');
      if (staffResult.ok && staffResult.data) setCompanyStaff(staffResult.data.staff);
      else if (!staffResult.ok) Alert.alert('Staff list unavailable', staffResult.message || 'Please retry.');
    } catch (error) {
      Alert.alert('Unable to load company', error instanceof Error ? error.message : 'Network error.');
    } finally {
      setCompanyDetailLoading(false);
    }
  };

  const handleInviteCompanyAdmin = async () => {
    const company = companyDetail;
    if (!company) return;
    if (!staffName.trim() || !staffEmail.trim() || staffPassword.length < 10) {
      Alert.alert('Validation', 'Enter the admin name, email, and an initial password of at least 10 characters.');
      return;
    }
    setInvitingStaff(true);
    try {
      const result = await inviteCompanyStaff(company.id, {
        name: staffName.trim(),
        email: staffEmail.trim(),
        phone: staffPhone.trim() || undefined,
        role: 'company_admin',
        password: staffPassword,
        password_confirmation: staffPassword,
      });
      if (!result.ok) {
        Alert.alert('Unable to add Company Admin', result.message || 'Please verify the account details.');
        return;
      }
      setStaffName('');
      setStaffEmail('');
      setStaffPhone('');
      setStaffPassword('');
      const refreshed = await getCompanyStaff(company.id);
      if (refreshed.ok && refreshed.data) setCompanyStaff(refreshed.data.staff);
      else if (!refreshed.ok) Alert.alert('Staff added', `The account was created, but the staff list could not refresh: ${refreshed.message || 'Please refresh.'}`);
    } catch (error) {
      Alert.alert('Unable to add Company Admin', error instanceof Error ? error.message : 'Network error.');
    } finally {
      setInvitingStaff(false);
    }
  };

  const handleRevokeCompanyAdmin = (membership: CompanyStaffMembership) => {
    const company = companyDetail;
    if (!company) return;
    Alert.alert(
      'Revoke Company Admin access?',
      `${membership.user.name} will lose access to ${company.name}. Historical records will remain.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke access',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const result = await revokeCompanyStaff(company.id, membership.user.id);
              if (!result.ok) {
                Alert.alert('Unable to revoke access', result.message || 'Please retry.');
                return;
              }
              setCompanyStaff((current) => current.filter((item) => item.membership_id !== membership.membership_id));
            })();
          },
        },
      ],
    );
  };

  const handleToggleUserStatus = async (u: PlatformUser) => {
    const reinstate = u.status === 'suspended';
    Alert.alert(
      `${reinstate ? 'Reinstate' : 'Suspend'} ${u.name}?`,
      reinstate
        ? 'This account will be able to sign in and use permitted services again.'
        : 'This immediately disables the account and revokes its active sessions.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: reinstate ? 'Reinstate account' : 'Suspend account',
          style: reinstate ? 'default' : 'destructive',
          onPress: () => {
            void (async () => {
              const res = reinstate
                ? await reinstatePlatformUser(u.id)
                : await suspendPlatformUser(u.id);
              if (res.ok) await loadAdminData(true);
              else Alert.alert('Error', res.message || 'Failed to update account status.');
            })();
          },
        },
      ],
    );
  };

  const hasUnsavedSettings = Boolean(settings && settingsDraft &&
    JSON.stringify(settings) !== JSON.stringify(settingsDraft));
  const hasUnsavedCompanyDraft = Boolean(
    compName.trim() || compCode.trim() || compRegistration.trim() ||
    compEmail.trim() || compPhone.trim() || compAddress.trim() ||
    initialAdminName.trim() || initialAdminEmail.trim() || initialAdminPassword || initialAdminPasswordConfirm,
  );
  const hasUnsavedStaffDraft = Boolean(
    staffName.trim() || staffEmail.trim() || staffPhone.trim() || staffPassword,
  );

  const resetCompanyDraft = useCallback(() => {
    setCompName('');
    setCompCode('');
    setCompRegistration('');
    setCompEmail('');
    setCompPhone('');
    setCompAddress('');
    setInitialAdminName('');
    setInitialAdminEmail('');
    setInitialAdminPassword('');
    setInitialAdminPasswordConfirm('');
  }, []);
  const closeCompanyModal = useCallback(() => {
    if (creatingComp) return;
    if (hasUnsavedCompanyDraft) {
      Alert.alert('Discard company details?', 'Your unsaved company registration will be discarded.', [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            resetCompanyDraft();
            setCompanyModalVisible(false);
          },
        },
      ]);
      return;
    }
    setCompanyModalVisible(false);
  }, [creatingComp, hasUnsavedCompanyDraft, resetCompanyDraft]);
  const closeCompanyDetails = useCallback(() => {
    if (invitingStaff) return;
    if (hasUnsavedStaffDraft) {
      Alert.alert('Discard administrator details?', 'Your unsaved administrator details will be discarded.', [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setStaffName('');
            setStaffEmail('');
            setStaffPhone('');
            setStaffPassword('');
            setCompanyDetailVisible(false);
          },
        },
      ]);
      return;
    }
    setCompanyDetailVisible(false);
  }, [hasUnsavedStaffDraft, invitingStaff]);

  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    if (allowRouteRemovalRef.current) return;

    if (companyModalVisible) {
      event.preventDefault();
      closeCompanyModal();
      return;
    }
    if (companyDetailVisible) {
      event.preventDefault();
      closeCompanyDetails();
      return;
    }
    if (accountModalVisible) {
      event.preventDefault();
      setAccountModalVisible(false);
      return;
    }
    if (activeTab !== 'settings' || !hasUnsavedSettings) return;

    event.preventDefault();
    if (settingsSaving) {
      Alert.alert('Settings are being saved', 'Wait for the save to finish before leaving this screen.');
      return;
    }
    Alert.alert('Discard unsaved settings?', 'Your platform settings edits have not been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard and leave',
        style: 'destructive',
        onPress: () => {
          setSettingsDraft(settings);
          setSettingsReason('');
          navigation.dispatch(event.data.action);
        },
      },
    ]);
  }), [
    accountModalVisible,
    activeTab,
    closeCompanyDetails,
    closeCompanyModal,
    companyDetailVisible,
    companyModalVisible,
    hasUnsavedSettings,
    navigation,
    settings,
    settingsSaving,
  ]);

  const selectAdminTab = (tab: AdminTab) => {
    if (activeTab === 'settings' && tab !== 'settings' && hasUnsavedSettings) {
      Alert.alert('Discard unsaved settings?', 'Your platform settings edits have not been saved.', [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setSettingsDraft(settings);
            setSettingsReason('');
            setSettingsCategory(null);
            setActiveTab(tab);
          },
        },
      ]);
      return;
    }
    setActiveTab(tab);
  };
  const handleAdminLogout = () => {
    Alert.alert(
      'Sign Out of Super Admin',
      'Are you sure you want to sign out of the Platform Administration portal?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            allowRouteRemovalRef.current = true;
            setAccountModalVisible(false);
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

  const handleAdminBack = () => {
    if (companyModalVisible) {
      closeCompanyModal();
      return;
    }
    if (companyDetailVisible) {
      closeCompanyDetails();
      return;
    }
    if (accountModalVisible) {
      setAccountModalVisible(false);
      return;
    }
    if (router.canGoBack()) router.back();
  };
  const settingsGroupIsDirty = (group: 'general' | 'policy' | 'location' | 'verification' | 'security' | 'companies') =>
    Boolean(settings && settingsDraft &&
      JSON.stringify(settings[group]) !== JSON.stringify(settingsDraft[group]));

  const openSettingsCategory = (category: SettingsCategoryId) => {
    if (category === 'audit') {
      if (hasUnsavedSettings) {
        Alert.alert('Unsaved settings', 'Save or discard your changes before opening the audit trail.');
        return;
      }
      const settingsAuditFilter = {
        action: 'platform.settings.updated',
        actorId: '',
        dateFrom: '',
        dateTo: '',
        settingCategory: '',
      };
      setAuditFilterDraft(settingsAuditFilter);
      setAuditFilters(settingsAuditFilter);
      setActiveTab('audit');
      return;
    }
    if (hasUnsavedSettings) {
      Alert.alert('Discard unsaved changes?', 'Your settings edits have not been saved.', [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setSettingsDraft(settings);
            setSettingsReason('');
            setSettingsCategory(category);
          },
        },
      ]);
      return;
    }
    setSettingsCategory(category);
  };

  const cancelSettingsEdits = () => {
    if (!settings) return;
    if (hasUnsavedSettings) {
      Alert.alert('Discard unsaved changes?', 'Your edits will be discarded.', [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            setSettingsDraft(settings);
            setSettingsReason('');
          },
        },
      ]);
      return;
    }
    setSettingsReason('');
  };

  const saveSettingsEdits = () => {
    if (!settingsDraft || !settingsCategory || settingsReason.trim().length < 10) {
      Alert.alert('Add a reason', 'Enter at least 10 characters explaining this administrative change.');
      return;
    }
    let patch: PlatformSettingsUpdate;
    switch (settingsCategory) {
      case 'general':
        patch = { reason: settingsReason.trim(), general: settingsDraft.general };
        break;
      case 'transport':
      case 'payments':
        patch = { reason: settingsReason.trim(), policy: settingsDraft.policy };
        break;
      case 'tracking':
        patch = { reason: settingsReason.trim(), location: settingsDraft.location };
        break;
      case 'users':
        patch = {
          reason: settingsReason.trim(),
          verification: {
            expire_minutes: settingsDraft.verification.expire_minutes,
            max_attempts: settingsDraft.verification.max_attempts,
            resend_cooldown_seconds: settingsDraft.verification.resend_cooldown_seconds,
          },
        };
        break;
      case 'security':
        patch = { reason: settingsReason.trim(), security: settingsDraft.security };
        break;
      case 'companies':
        patch = { reason: settingsReason.trim(), companies: settingsDraft.companies };
        break;
      default:
        Alert.alert('Read-only section', 'This category does not have editable settings in the current backend.');
        return;
    }
    Alert.alert(
      'Save platform settings?',
      'This change will take effect on the server and be recorded in the administrative audit log.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save settings',
          onPress: () => {
            void (async () => {
              setSettingsSaving(true);
              try {
                const result = await updatePlatformSettings(patch);
                if (!result.ok || !result.data) {
                  Alert.alert('Settings not saved', result.message || 'The server rejected this change.');
                  return;
                }
                setSettings(result.data);
                setSettingsDraft(result.data);
                setSettingsReason('');
                Alert.alert('Settings saved', result.message || 'The platform settings were updated.');
              } catch (error) {
                Alert.alert('Settings not saved', error instanceof Error ? error.message : 'Network error.');
              } finally {
                setSettingsSaving(false);
              }
            })();
          },
        },
      ],
    );
  };

  const setGeneralSetting = (key: keyof PlatformSettings['general'], value: string) => {
    setSettingsDraft((current) => current
      ? { ...current, general: { ...current.general, [key]: value } }
      : current);
  };
  const setPolicySetting = (key: keyof PlatformSettings['policy'], value: string) => {
    const amount = value.trim() === '' ? 0 : Number(value);
    setSettingsDraft((current) => current
      ? { ...current, policy: { ...current.policy, [key]: Number.isFinite(amount) ? amount : 0 } }
      : current);
  };
  const setLocationSetting = (value: string) => {
    const seconds = value.trim() === '' ? 0 : Number(value);
    setSettingsDraft((current) => current
      ? { ...current, location: { stale_after_seconds: Number.isFinite(seconds) ? seconds : 0 } }
      : current);
  };
  const setVerificationSetting = (
    key: 'expire_minutes' | 'max_attempts' | 'resend_cooldown_seconds',
    value: string,
  ) => {
    const parsed = value.trim() === '' ? 0 : Number(value);
    setSettingsDraft((current) => current
      ? {
        ...current,
        verification: {
          ...current.verification,
          [key]: Number.isFinite(parsed) ? parsed : 0,
        },
      }
      : current);
  };
  const setCompanyPolicy = (key: keyof PlatformSettings['companies'], value: boolean) => {
    setSettingsDraft((current) => current
      ? { ...current, companies: { ...current.companies, [key]: value } }
      : current);
  };
  const setSecuritySetting = (key: keyof PlatformSettings['security'], value: string) => {
    const parsed = value.trim() === '' ? 0 : Number(value);
    setSettingsDraft((current) => current
      ? {
        ...current,
        security: {
          ...current.security,
          [key]: Number.isFinite(parsed) ? parsed : 0,
        },
      }
      : current);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Top Header */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Super Admin navigation menu"
          accessibilityState={{ expanded: menuVisible }}
          onPress={() => setMenuVisible(true)}
          style={styles.headerMenuButton}
          hitSlop={6}
        >
          <SymbolView
            name={{ ios: 'line.3.horizontal', android: 'menu', web: 'menu' }}
            size={21}
            tintColor={Brand.primary}
          />
        </Pressable>
        <View style={styles.brandMark}>
          <SymbolView
            name={{ ios: 'building.2.crop.circle.fill', android: 'admin_panel_settings', web: 'admin_panel_settings' }}
            size={22}
            tintColor={Brand.white}
          />
        </View>
        <View style={styles.headerIdentity}>
          <AppText style={styles.headerTitle}>Tap &amp; Pay</AppText>
          <AppText style={styles.headerSubtitle}>SUPER ADMIN CONSOLE</AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          onPress={() => router.push('/notifications')}
          style={styles.notificationButton}
        >
          <SymbolView
            name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
            size={19}
            tintColor={Brand.primary}
          />
          {unreadCount > 0 ? (
            <View style={styles.notificationBadge}>
              <AppText style={styles.notificationBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</AppText>
            </View>
          ) : null}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Super Admin account menu"
          onPress={() => setAccountModalVisible(true)}
          style={styles.adminAvatarBtn}
        >
          <AppText style={styles.adminAvatarText}>
            {(session.user?.name || 'SA').slice(0, 2).toUpperCase()}
          </AppText>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadAdminData(true)} tintColor={Brand.primary} />
        }
      >
        {loadError ? (
          <View style={styles.errorBox} accessibilityRole="alert">
            <AppText style={styles.errorText}>{loadError}</AppText>
            <Pressable
              accessibilityRole="button"
              onPress={() => void loadAdminData(true)}
              style={styles.retryButton}
            >
              <AppText style={styles.retryText}>Retry</AppText>
            </Pressable>
          </View>
        ) : null}

        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Brand.primary} />
            <AppText style={styles.loadingText}>Loading platform metrics...</AppText>
          </View>
        ) : null}

        {/* --- Tab 1: KPI Dashboard --- */}
        {activeTab === 'kpi' && dashboard && (
          <View style={styles.kpiContainer}>
            <View>
              <AppText style={styles.dashboardEyebrow}>PLATFORM OVERVIEW</AppText>
              <AppText style={styles.dashboardTitle}>Operations at a glance</AppText>
            </View>
            <View style={styles.periodRow} accessibilityRole="tablist">
              {([
                ['today', 'Today'],
                ['7d', 'Last 7 days'],
                ['30d', 'Last 30 days'],
              ] as const).map(([value, label]) => (
                <Pressable
                  key={value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: period === value }}
                  onPress={() => setPeriod(value)}
                  style={[styles.periodButton, period === value && styles.periodButtonActive]}
                >
                  <AppText style={[styles.periodText, period === value && styles.periodTextActive]}>{label}</AppText>
                </Pressable>
              ))}
            </View>

            <View style={styles.metricGrid}>
              <View style={styles.metricCard}>
                <AppText style={styles.metricLabel}>Total Companies</AppText>
                <AppText style={styles.metricValue}>{dashboard.companies.total}</AppText>
                <AppText style={styles.metricSub}>{dashboard.companies.active} active · {dashboard.companies.pending} pending</AppText>
              </View>

              <View style={styles.metricCard}>
                <AppText style={styles.metricLabel}>Passengers</AppText>
                <AppText style={styles.metricValue}>{dashboard.users.passengers}</AppText>
                <AppText style={styles.metricSub}>{dashboard.users.active} active platform users</AppText>
              </View>

              <View style={styles.metricCard}>
                <AppText style={styles.metricLabel}>Fleet buses</AppText>
                <AppText style={styles.metricValue}>{dashboard.fleet.buses.total}</AppText>
                <AppText style={styles.metricSub}>{dashboard.fleet.buses.live_now} reporting live</AppText>
              </View>

              <View style={styles.metricCard}>
                <AppText style={styles.metricLabel}>Drivers</AppText>
                <AppText style={styles.metricValue}>{dashboard.fleet.drivers.total}</AppText>
                <AppText style={styles.metricSub}>{dashboard.fleet.drivers.active} active</AppText>
              </View>

              <View style={styles.metricCard}>
                <AppText style={styles.metricLabel}>Trips in period</AppText>
                <AppText style={styles.metricValue}>{dashboard.trips.total}</AppText>
                <AppText style={styles.metricSub}>{dashboard.trips.in_progress} active · {dashboard.trips.completed} completed</AppText>
              </View>

              <View style={styles.metricCard}>
                <AppText style={styles.metricLabel}>Verification pending</AppText>
                <AppText style={styles.metricValue}>{dashboard.users.pending_verification}</AppText>
                <AppText style={styles.metricSub}>{dashboard.users.suspended} suspended accounts</AppText>
              </View>
            </View>

            <View style={styles.volumeCard}>
              <AppText style={styles.volumeTitle}>Recorded trip fare volume</AppText>
              <AppText style={styles.volumeAmount}>{dashboard.trips.revenue.formatted}</AppText>
              <AppText style={styles.healthText}>
                {dashboard.taps.successful} successful fares · {dashboard.taps.failed} failed fare attempts
              </AppText>
              <View style={styles.statDivider} />
              <View style={styles.financeRow}>
                <View>
                  <AppText style={styles.volumeTitle}>Successful wallet top-ups</AppText>
                  <AppText style={styles.financeAmount}>{dashboard.wallet.total_loaded.formatted}</AppText>
                </View>
                <View>
                  <AppText style={styles.volumeTitle}>Current wallet balances</AppText>
                  <AppText style={styles.financeAmount}>{dashboard.wallet.wallets.floating_balance.formatted}</AppText>
                </View>
              </View>
              <View style={styles.healthRow}>
                <View style={[styles.healthDot, systemHealth?.status === 'ok' ? styles.healthDotOk : styles.healthDotWarn]} />
                <AppText style={styles.healthText}>System status: {systemHealth?.status || 'Unavailable'}</AppText>
              </View>
            </View>
          </View>
        )}

        {/* --- Tab 2: Transport Companies Management --- */}
        {activeTab === 'companies' && (
          <View style={styles.listSection}>
            <View style={styles.actionHeader}>
              <AppText style={styles.sectionTitle}>Registered Companies</AppText>
              <Pressable onPress={() => setCompanyModalVisible(true)} style={styles.addBtn}>
                <AppText style={styles.addBtnText}>+ New Company</AppText>
              </Pressable>
            </View>
            <AppTextInput
              style={styles.searchInput}
              value={searchInput}
              onChangeText={setSearchInput}
              onSubmitEditing={() => setSearchQuery(searchInput.trim())}
              returnKeyType="search"
              placeholder="Search companies by name or code"
              placeholderTextColor={Brand.textSecondary}
              accessibilityLabel="Search companies"
            />
            <View style={styles.filterRow}>
              {([
                ['', 'All statuses'],
                ['active', 'Active'],
                ['pending', 'Pending'],
                ['suspended', 'Suspended'],
              ] as const).map(([value, label]) => (
                <Pressable
                  key={value || 'all'}
                  onPress={() => setCompanyStatusFilter(value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: companyStatusFilter === value }}
                  style={[styles.filterButton, companyStatusFilter === value && styles.filterButtonActive]}
                >
                  <AppText style={[styles.filterText, companyStatusFilter === value && styles.filterTextActive]}>{label}</AppText>
                </Pressable>
              ))}
            </View>

            {companies.map((c) => (
              <View key={c.id} style={styles.companyRowCard}>
                <View style={styles.compTop}>
                  <View>
                    <AppText style={styles.compTitle}>{c.name}</AppText>
                    <AppText style={styles.compSub}>{c.code} · {c.buses_count ?? 0} buses · {c.drivers_count ?? 0} drivers</AppText>
                  </View>
                  <Pressable
                    onPress={() => handleToggleCompanyStatus(c)}
                    style={[styles.statusToggle, c.status === 'active' ? styles.statusActive : styles.statusSuspended]}
                  >
                    <AppText style={styles.statusToggleText}>{c.status.toUpperCase()}</AppText>
                  </Pressable>
                </View>
                <AppText style={styles.compEmail}>{c.email}</AppText>
                <AppText style={styles.compSub}>{c.phone}{c.address ? ` · ${c.address}` : ''}</AppText>
                <Pressable accessibilityRole="button" onPress={() => void openCompanyDetails(c)} style={styles.loadMoreButton}>
                  <AppText style={styles.loadMoreText}>Company details & administrators</AppText>
                </Pressable>
              </View>
            ))}
            {companies.length === 0 ? (
              <View style={styles.emptyBox}><AppText style={styles.emptyText}>No transport companies match this search.</AppText></View>
            ) : null}
            {companyCursor ? <LoadMoreButton busy={moreBusy} onPress={() => void loadMore('companies')} styles={styles} /> : null}
          </View>
        )}

        {/* --- Tab 3: Users Directory --- */}
        {activeTab === 'users' && (
          <View style={styles.listSection}>
            <AppText style={styles.sectionTitle}>Platform User Directory</AppText>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/portal/concession-review' as any)}
              style={styles.loadMoreButton}
            >
              <AppText style={styles.loadMoreText}>Review fare concession applications</AppText>
            </Pressable>
            <AppTextInput
              style={styles.searchInput}
              value={searchInput}
              onChangeText={setSearchInput}
              onSubmitEditing={() => setSearchQuery(searchInput.trim())}
              returnKeyType="search"
              placeholder="Search users by name, email, or phone"
              placeholderTextColor={Brand.textSecondary}
              accessibilityLabel="Search users"
            />
            <View style={styles.filterRow}>
              {[
                ['', 'All roles'],
                ['passenger', 'Passengers'],
                ['driver', 'Drivers'],
                ['company_admin', 'Company admins'],
              ].map(([value, label]) => (
                <Pressable
                  key={value || 'all'}
                  onPress={() => setUserTypeFilter(value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: userTypeFilter === value }}
                  style={[styles.filterButton, userTypeFilter === value && styles.filterButtonActive]}
                >
                  <AppText style={[styles.filterText, userTypeFilter === value && styles.filterTextActive]}>{label}</AppText>
                </Pressable>
              ))}
            </View>
            <View style={styles.filterRow}>
              <Pressable
                onPress={() => setUserCompanyFilter('')}
                accessibilityRole="button"
                accessibilityState={{ selected: userCompanyFilter === '' }}
                style={[styles.filterButton, userCompanyFilter === '' && styles.filterButtonActive]}
              >
                <AppText style={[styles.filterText, userCompanyFilter === '' && styles.filterTextActive]}>All companies</AppText>
              </Pressable>
              {companies.map((company) => (
                <Pressable
                  key={company.id}
                  onPress={() => setUserCompanyFilter(String(company.id))}
                  accessibilityRole="button"
                  accessibilityState={{ selected: userCompanyFilter === String(company.id) }}
                  style={[styles.filterButton, userCompanyFilter === String(company.id) && styles.filterButtonActive]}
                >
                  <AppText style={[styles.filterText, userCompanyFilter === String(company.id) && styles.filterTextActive]}>
                    {company.name}
                  </AppText>
                </Pressable>
              ))}
            </View>
            <View style={styles.filterRow}>
              {([
                ['', 'All statuses'],
                ['active', 'Active'],
                ['pending_verification', 'Pending verification'],
                ['suspended', 'Suspended'],
                ['inactive', 'Inactive'],
              ] as const).map(([value, label]) => (
                <Pressable
                  key={value || 'all'}
                  onPress={() => setUserStatusFilter(value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: userStatusFilter === value }}
                  style={[styles.filterButton, userStatusFilter === value && styles.filterButtonActive]}
                >
                  <AppText style={[styles.filterText, userStatusFilter === value && styles.filterTextActive]}>{label}</AppText>
                </Pressable>
              ))}
            </View>
            {users.map((u) => (
              <View key={u.id} style={styles.userCard}>
                <View style={styles.userTop}>
                  <View style={styles.userAvatar}>
                    <AppText style={styles.userAvatarText}>{u.name.charAt(0).toUpperCase()}</AppText>
                  </View>
                  <View style={styles.userInfo}>
                    <AppText style={styles.userName}>{u.name}</AppText>
                    <AppText style={styles.userEmail}>{u.email}</AppText>
                    <AppText style={styles.userTypeTag}>
                      {(u.roles?.join(', ') || u.type || 'passenger').replaceAll('_', ' ').toUpperCase()}
                    </AppText>
                    <AppText style={styles.compSub}>
                      {u.status.replaceAll('_', ' ')} · Email {u.email_verified ? 'verified' : 'unverified'} · Phone {u.phone_verified ? 'verified' : 'unverified'}
                    </AppText>
                  </View>
                  <Pressable
                    onPress={() => handleToggleUserStatus(u)}
                    style={[styles.userActionBtn, u.status === 'suspended' ? styles.btnReinstate : styles.btnSuspend]}
                  >
                    <AppText style={styles.userActionText}>
                      {u.status === 'suspended' ? 'Reinstate' : 'Suspend'}
                    </AppText>
                  </Pressable>
                </View>
              </View>
            ))}
            {users.length === 0 ? <View style={styles.emptyBox}><AppText style={styles.emptyText}>No users match these filters.</AppText></View> : null}
            {userCursor ? <LoadMoreButton busy={moreBusy} onPress={() => void loadMore('users')} styles={styles} /> : null}
          </View>
        )}

        {activeTab === 'fleet' && (
          <View style={styles.listSection}>
            <AppText style={styles.sectionTitle}>Global Fleet & GPS Freshness</AppText>
            <AppTextInput
              style={styles.searchInput}
              value={searchInput}
              onChangeText={setSearchInput}
              onSubmitEditing={() => setSearchQuery(searchInput.trim())}
              returnKeyType="search"
              placeholder="Search bus number or registration"
              placeholderTextColor={Brand.textSecondary}
              accessibilityLabel="Search global fleet"
            />
            <View style={styles.filterRow}>
              {([
                ['', 'All tracking'],
                ['live', 'Live'],
                ['stale', 'Stale'],
                ['unknown', 'No GPS'],
              ] as const).map(([value, label]) => (
                <Pressable
                  key={value || 'all'}
                  onPress={() => setFleetTrackingFilter(value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: fleetTrackingFilter === value }}
                  style={[styles.filterButton, fleetTrackingFilter === value && styles.filterButtonActive]}
                >
                  <AppText style={[styles.filterText, fleetTrackingFilter === value && styles.filterTextActive]}>{label}</AppText>
                </Pressable>
              ))}
            </View>
            {buses.map((bus) => (
              <View key={bus.id} style={styles.companyRowCard}>
                <View style={styles.compTop}>
                  <View>
                    <AppText style={styles.compTitle}>{bus.bus_number}</AppText>
                    <AppText style={styles.compSub}>
                      {bus.registration_number} · {bus.company?.name ?? 'Company unavailable'}
                    </AppText>
                  </View>
                  <View style={[styles.statusToggle, bus.tracking_status === 'live' ? styles.statusActive : styles.statusSuspended]}>
                    <AppText style={styles.statusToggleText}>{bus.tracking_status.toUpperCase()}</AppText>
                  </View>
                </View>
                <AppText style={styles.compSub}>
                  {bus.status.replaceAll('_', ' ')} · {bus.capacity ?? 'Capacity unavailable'} seats
                  {bus.last_location_at ? ` · GPS ${new Date(bus.last_location_at).toLocaleString()}` : ' · No GPS update recorded'}
                </AppText>
                {bus.location ? (
                  <AppText style={styles.compSub}>
                    Last coordinates: {bus.location.latitude.toFixed(5)}, {bus.location.longitude.toFixed(5)}
                  </AppText>
                ) : null}
                {bus.active_trip ? (
                  <AppText style={styles.compSub}>
                    Active trip {bus.active_trip.reference}
                    {bus.active_trip.route ? ` · ${bus.active_trip.route.name}` : ''}
                    {bus.active_trip.driver_name ? ` · ${bus.active_trip.driver_name}` : ''}
                  </AppText>
                ) : <AppText style={styles.compSub}>No active trip</AppText>}
              </View>
            ))}
            {buses.length === 0 ? <View style={styles.emptyBox}><AppText style={styles.emptyText}>No buses match this search.</AppText></View> : null}
            {busCursor ? <LoadMoreButton busy={moreBusy} onPress={() => void loadMore('fleet')} styles={styles} /> : null}
          </View>
        )}

        {activeTab === 'trips' && (
          <View style={styles.listSection}>
            <AppText style={styles.sectionTitle}>Network Trip Operations</AppText>
            <AppTextInput
              style={styles.searchInput}
              value={searchInput}
              onChangeText={setSearchInput}
              onSubmitEditing={() => setSearchQuery(searchInput.trim())}
              returnKeyType="search"
              placeholder="Search trip reference, route, or bus"
              placeholderTextColor={Brand.textSecondary}
              accessibilityLabel="Search platform trips"
            />
            <View style={styles.filterRow}>
              {([
                ['', 'All statuses'],
                ['scheduled', 'Scheduled'],
                ['in_progress', 'Active'],
                ['completed', 'Completed'],
                ['cancelled', 'Cancelled'],
              ] as const).map(([value, label]) => (
                <Pressable
                  key={value || 'all'}
                  onPress={() => setTripStatusFilter(value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: tripStatusFilter === value }}
                  style={[styles.filterButton, tripStatusFilter === value && styles.filterButtonActive]}
                >
                  <AppText style={[styles.filterText, tripStatusFilter === value && styles.filterTextActive]}>{label}</AppText>
                </Pressable>
              ))}
            </View>
            <AppText style={styles.compSub}>Scheduled trips within the selected dashboard period.</AppText>
            {trips.map((trip) => (
              <View key={trip.id} style={styles.companyRowCard}>
                <View style={styles.compTop}>
                  <View>
                    <AppText style={styles.compTitle}>{trip.route?.name ?? trip.reference}</AppText>
                    <AppText style={styles.compSub}>{trip.company?.name ?? 'Company unavailable'} · {trip.bus?.bus_number ?? 'Bus unavailable'}</AppText>
                  </View>
                  <View style={[styles.statusToggle, trip.status === 'in_progress' ? styles.statusActive : styles.statusSuspended]}>
                    <AppText style={styles.statusToggleText}>{trip.status.replaceAll('_', ' ').toUpperCase()}</AppText>
                  </View>
                </View>
                <AppText style={styles.compSub}>Ref {trip.reference} · Driver {trip.driver?.name ?? 'Unassigned'}</AppText>
                <AppText style={styles.compSub}>
                  {trip.scheduled_departure ? `Scheduled ${new Date(trip.scheduled_departure).toLocaleString()}` : 'Schedule unavailable'}
                  {trip.started_at ? ` · Started ${new Date(trip.started_at).toLocaleString()}` : ''}
                </AppText>
                <AppText style={styles.compSub}>{trip.passenger_count} passengers · {trip.revenue.formatted} recorded fare volume</AppText>
              </View>
            ))}
            {trips.length === 0 ? <View style={styles.emptyBox}><AppText style={styles.emptyText}>No trips match this search and date range.</AppText></View> : null}
            {tripCursor ? <LoadMoreButton busy={moreBusy} onPress={() => void loadMore('trips')} styles={styles} /> : null}
          </View>
        )}

        {activeTab === 'payments' && (
          <View style={styles.listSection}>
            <AppText style={styles.sectionTitle}>Payment monitoring & reconciliation</AppText>
            <AppText style={styles.compSub}>
              Gateway wallet top-ups and QR transport fares for {period === 'today' ? 'today' : period === '7d' ? 'the last 7 days' : 'the last 30 days'}.
            </AppText>
            <AppText style={styles.sectionTitle}>Wallet top-ups</AppText>
            <View style={styles.paymentSummaryRow}>
              {Object.entries(paymentSummary).map(([status, summary]) => (
                <View key={status} style={styles.paymentSummaryCard}>
                  <AppText style={styles.settingLabel}>{status.replaceAll('_', ' ')}</AppText>
                  <AppText style={styles.paymentSummaryAmount}>{summary.total.formatted}</AppText>
                  <AppText style={styles.compSub}>{summary.entries} attempts</AppText>
                </View>
              ))}
            </View>
            {payments.map((payment) => (
              <View key={payment.reference} style={styles.paymentCard}>
                <View style={styles.compTop}>
                  <View style={styles.paymentReferenceWrap}>
                    <AppText style={styles.paymentReference} numberOfLines={1}>{payment.reference}</AppText>
                    <AppText style={styles.compSub}>{payment.gateway} · user #{payment.user_id}</AppText>
                  </View>
                  <View style={styles.statusToggle}>
                    <AppText style={styles.statusToggleText}>{payment.status_label ?? payment.status}</AppText>
                  </View>
                </View>
                <AppText style={styles.paymentAmount}>{payment.amount.formatted}</AppText>
                <AppText style={styles.compSub}>
                  Provider ref: {payment.provider_transaction_id ?? 'Not assigned'}
                  {payment.created_at ? ` · ${new Date(payment.created_at).toLocaleString()}` : ''}
                </AppText>
                {payment.failure_reason ? (
                  <AppText style={styles.compSub}>Failure: {payment.failure_reason}</AppText>
                ) : null}
                {payment.ledger.length > 0 ? (
                  <View style={styles.paymentLedger}>
                    <AppText style={styles.settingLabel}>Wallet ledger</AppText>
                    {payment.ledger.map((entry) => (
                      <AppText key={entry.reference} style={styles.compSub}>
                        {entry.direction} {entry.type} · {entry.amount.formatted} · balance {entry.balance_after.formatted} · {entry.reference}
                      </AppText>
                    ))}
                  </View>
                ) : (
                  <AppText style={styles.compSub}>No wallet ledger credit is recorded for this payment.</AppText>
                )}
              </View>
            ))}
            {payments.length === 0 ? (
              <View style={styles.emptyBox}><AppText style={styles.emptyText}>No payment attempts were recorded in this period.</AppText></View>
            ) : null}
            {paymentCursor ? <LoadMoreButton busy={moreBusy} onPress={() => void loadMore('payments')} styles={styles} /> : null}
            <AppText style={styles.sectionTitle}>Tap & Pay QR transport transactions</AppText>
            <View style={styles.paymentSummaryRow}>
              {Object.entries(qrPaymentSummary).map(([status, summary]) => (
                <View key={status} style={styles.paymentSummaryCard}>
                  <AppText style={styles.settingLabel}>{status.replaceAll('_', ' ')}</AppText>
                  <AppText style={styles.paymentSummaryAmount}>{summary.total.formatted}</AppText>
                  <AppText style={styles.compSub}>{summary.entries} transactions</AppText>
                </View>
              ))}
            </View>
            {qrPayments.map((payment) => (
              <View key={payment.tap_uid} style={styles.paymentCard}>
                <View style={styles.compTop}>
                  <View style={styles.paymentReferenceWrap}>
                    <AppText style={styles.paymentReference} numberOfLines={1}>{payment.transaction_reference}</AppText>
                    <AppText style={styles.compSub}>
                      {payment.company_name ?? 'Transport company unavailable'} · {payment.bus_number ?? 'Bus unavailable'}
                    </AppText>
                  </View>
                  <View style={styles.statusToggle}>
                    <AppText style={styles.statusToggleText}>{payment.status_label ?? payment.status}</AppText>
                  </View>
                </View>
                <AppText style={styles.paymentAmount}>{payment.fare.formatted}</AppText>
                <AppText style={styles.compSub}>
                  {payment.route_name ?? 'Route unavailable'} · passenger #{payment.user_id}
                  {payment.tapped_at ? ` · ${new Date(payment.tapped_at).toLocaleString()}` : ''}
                </AppText>
                <AppText style={styles.compSub}>
                  Wallet balance {payment.balance_before.formatted} → {payment.balance_after.formatted}
                </AppText>
                {payment.failure_reason ? <AppText style={styles.compSub}>Failure: {payment.failure_reason}</AppText> : null}
              </View>
            ))}
            {qrPayments.length === 0 ? (
              <View style={styles.emptyBox}><AppText style={styles.emptyText}>No QR transport transactions were recorded in this period.</AppText></View>
            ) : null}
            {qrPaymentCursor ? <LoadMoreButton busy={moreBusy} onPress={() => void loadMore('qrPayments')} styles={styles} /> : null}
          </View>
        )}

        {/* --- Tab 4: Audit Logs --- */}
        {activeTab === 'audit' && (
          <View style={styles.listSection}>
            <AppText style={styles.sectionTitle}>Platform Security Audit Trail</AppText>
            <View style={styles.settingsCard}>
              <AppText style={styles.settingLabel}>Filter by settings category, operation, administrator ID, or date range (YYYY-MM-DD).</AppText>
              <AppTextInput
                style={styles.modalInput}
                value={auditFilterDraft.action}
                onChangeText={(action) => setAuditFilterDraft((current) => ({ ...current, action }))}
                placeholder="Operation (e.g. platform.settings.updated)"
                placeholderTextColor={Brand.textSecondary}
                autoCapitalize="none"
              />
              <AppTextInput
                style={styles.modalInput}
                value={auditFilterDraft.actorId}
                onChangeText={(actorId) => setAuditFilterDraft((current) => ({ ...current, actorId }))}
                placeholder="Administrator user ID"
                placeholderTextColor={Brand.textSecondary}
                keyboardType="number-pad"
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one }}>
                {(['', 'general', 'appearance', 'policy', 'location', 'verification', 'security', 'companies'] as const).map((category) => (
                  <Pressable
                    key={category || 'all'}
                    accessibilityRole="button"
                    accessibilityState={{ selected: auditFilterDraft.settingCategory === category }}
                    onPress={() => setAuditFilterDraft((current) => ({ ...current, settingCategory: category }))}
                    style={[
                      styles.settingsCancel,
                      auditFilterDraft.settingCategory === category && styles.settingsSave,
                    ]}
                  >
                    <AppText style={auditFilterDraft.settingCategory === category ? styles.settingsSaveText : styles.settingVal}>
                      {category || 'All categories'}
                    </AppText>
                  </Pressable>
                ))}
              </View>
              <View style={styles.settingsActionRow}>
                <AppTextInput
                  style={[styles.modalInput, { flex: 1 }]}
                  value={auditFilterDraft.dateFrom}
                  onChangeText={(dateFrom) => setAuditFilterDraft((current) => ({ ...current, dateFrom }))}
                  placeholder="From date"
                  placeholderTextColor={Brand.textSecondary}
                />
                <AppTextInput
                  style={[styles.modalInput, { flex: 1 }]}
                  value={auditFilterDraft.dateTo}
                  onChangeText={(dateTo) => setAuditFilterDraft((current) => ({ ...current, dateTo }))}
                  placeholder="To date"
                  placeholderTextColor={Brand.textSecondary}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  if (auditFilterDraft.actorId && !/^\d+$/.test(auditFilterDraft.actorId)) {
                    Alert.alert('Invalid administrator ID', 'Enter a numeric user ID.');
                    return;
                  }
                  setAuditFilters(auditFilterDraft);
                }}
                style={styles.settingsSave}
              >
                <AppText style={styles.settingsSaveText}>Apply audit filters</AppText>
              </Pressable>
            </View>
            {logs.map((log) => (
              <View key={log.id} style={styles.logCard}>
                <View style={styles.logTop}>
                  <AppText style={styles.logAction}>{log.action}</AppText>
                  <AppText style={styles.logDate}>{new Date(log.created_at).toLocaleDateString()}</AppText>
                </View>
                <AppText style={styles.logActor}>Actor: {log.actor.email || `${log.actor.type}${log.actor.id ? ` #${log.actor.id}` : ''}`}</AppText>
                {typeof log.context?.reason === 'string' ? <AppText style={styles.logActor}>Reason: {log.context.reason}</AppText> : null}
                {log.changed_fields?.length ? <AppText style={styles.logActor}>Changed: {log.changed_fields.join(', ')}</AppText> : null}
                {log.ip_address && <AppText style={styles.logIp}>IP: {log.ip_address}</AppText>}
              </View>
            ))}
            {logs.length === 0 ? <View style={styles.emptyBox}><AppText style={styles.emptyText}>No audit events are available.</AppText></View> : null}
            {auditCursor ? <LoadMoreButton busy={moreBusy} onPress={() => void loadMore('audit')} styles={styles} /> : null}
          </View>
        )}

        {/* --- Tab 5: Settings --- */}
        {activeTab === 'settings' && (
          <View style={styles.listSection}>
            {settingsCategory === null ? (
              <>
                <AppText style={styles.sectionTitle}>Platform settings</AppText>
                <AppText style={styles.compSub}>Search categories, review current capabilities, and edit only policies the server supports.</AppText>
                <AppTextInput
                  accessibilityLabel="Search settings categories"
                  style={styles.modalInput}
                  value={settingsSearch}
                  onChangeText={setSettingsSearch}
                  placeholder="Search settings"
                  placeholderTextColor={Brand.textSecondary}
                />
                {!settings ? (
                  <View style={styles.emptyBox}><AppText style={styles.emptyText}>Settings are unavailable. Use retry to reload.</AppText></View>
                ) : SETTINGS_CATEGORIES
                  .filter((category) => `${category.title} ${category.description}`.toLowerCase().includes(settingsSearch.trim().toLowerCase()))
                  .map((category) => (
                    <Pressable
                      key={category.id}
                      accessibilityRole="button"
                      onPress={() => openSettingsCategory(category.id)}
                      style={styles.settingsCard}
                    >
                      <View style={styles.logTop}>
                        <AppText style={styles.settingVal}>{category.title}</AppText>
                        <AppText style={styles.settingStatus}>{category.status.replace('-', ' ').toUpperCase()}</AppText>
                      </View>
                      <AppText style={styles.settingLabel}>{category.description}</AppText>
                      {category.id === 'payments' ? (
                        <AppText style={styles.settingVal}>eSewa: {settings?.gateways.esewa_status.replace('_', ' ') ?? 'unavailable'} · Currency: {settings?.currency ?? 'unavailable'}</AppText>
                      ) : null}
                      {category.id === 'health' ? (
                        <AppText style={styles.settingVal}>
                          {systemHealth
                            ? Object.entries(systemHealth.checks).map(([name, check]) => `${name}: ${check.status ?? (check.ok ? 'operational' : 'unavailable')}`).join(' · ')
                            : 'Health status unavailable'}
                        </AppText>
                      ) : null}
                    </Pressable>
                  ))}
                {SETTINGS_CATEGORIES.filter((category) =>
                  `${category.title} ${category.description}`.toLowerCase().includes(settingsSearch.trim().toLowerCase()),
                ).length === 0 ? (
                  <View style={styles.emptyBox}><AppText style={styles.emptyText}>No settings categories match this search.</AppText></View>
                ) : null}
                <View style={styles.settingsCard}>
                  <AppText style={styles.settingVal}>Environment-managed values</AppText>
                  <AppText style={styles.settingLabel}>
                    Currency ({settings?.currency ?? 'unavailable'}), verification timing, payment provider credentials, authentication limits and role abilities are not editable here. Secrets are never returned.
                  </AppText>
                  <AppText style={styles.settingLabel}>
                    Phone verification test mode: {settings?.verification.phone_dev_mode ? 'enabled by server configuration' : 'disabled'} · Simulator gateway: {settings?.gateways.dummy_enabled ? 'enabled' : 'disabled'}
                  </AppText>
                </View>
              </>
            ) : (
              <>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    if (hasUnsavedSettings) {
                      Alert.alert('Unsaved settings', 'Save or discard your changes before leaving this section.');
                      return;
                    }
                    setSettingsCategory(null);
                  }}
                  style={styles.backBtn}
                >
                  <AppText style={styles.settingVal}>‹ All settings</AppText>
                </Pressable>
                <AppText style={styles.sectionTitle}>{SETTINGS_CATEGORIES.find((item) => item.id === settingsCategory)?.title}</AppText>
                <AppText style={styles.compSub}>{SETTINGS_CATEGORIES.find((item) => item.id === settingsCategory)?.description}</AppText>
                {!settingsDraft ? <ActivityIndicator color={Brand.primary} /> : null}

                {settingsCategory === 'general' && settingsDraft ? (
                  <View style={styles.settingsCard}>
                    <AppText style={styles.settingLabel}>Platform name</AppText>
                    <AppTextInput style={styles.modalInput} value={settingsDraft.general.platform_name} onChangeText={(v) => setGeneralSetting('platform_name', v)} />
                    <AppText style={styles.settingLabel}>Description</AppText>
                    <AppTextInput style={styles.modalInput} value={settingsDraft.general.description} onChangeText={(v) => setGeneralSetting('description', v)} />
                    <AppText style={styles.settingLabel}>Support email</AppText>
                    <AppTextInput style={styles.modalInput} value={settingsDraft.general.support_email ?? ''} onChangeText={(v) => setGeneralSetting('support_email', v)} keyboardType="email-address" autoCapitalize="none" />
                    <AppText style={styles.settingLabel}>Support phone</AppText>
                    <AppTextInput style={styles.modalInput} value={settingsDraft.general.support_phone ?? ''} onChangeText={(v) => setGeneralSetting('support_phone', v)} keyboardType="phone-pad" />
                    <AppText style={styles.settingLabel}>Contact address</AppText>
                    <AppTextInput style={styles.modalInput} value={settingsDraft.general.contact_address ?? ''} onChangeText={(v) => setGeneralSetting('contact_address', v)} />
                    <AppText style={styles.settingLabel}>Default language (English is currently supported)</AppText>
                    <AppTextInput style={styles.modalInput} value={settingsDraft.general.default_language} onChangeText={(v) => setGeneralSetting('default_language', v)} autoCapitalize="none" />
                    <AppText style={styles.settingLabel}>Supported languages (English only; localization catalogs are not present)</AppText>
                    <AppTextInput
                      style={styles.modalInput}
                      value={settingsDraft.general.supported_languages.join(', ')}
                      onChangeText={(value) => setSettingsDraft((current) => current ? {
                        ...current,
                        general: {
                          ...current.general,
                          supported_languages: value.trim().toLowerCase() === 'en' ? ['en'] : [],
                        },
                      } : current)}
                      autoCapitalize="none"
                    />
                    <AppText style={styles.settingLabel}>Timezone</AppText>
                    <AppTextInput style={styles.modalInput} value={settingsDraft.general.timezone} onChangeText={(v) => setGeneralSetting('timezone', v)} autoCapitalize="none" />
                    <AppText style={styles.settingLabel}>Date format</AppText>
                    <AppTextInput style={styles.modalInput} value={settingsDraft.general.date_format} onChangeText={(v) => setGeneralSetting('date_format', v)} autoCapitalize="none" />
                    <AppText style={styles.settingLabel}>Platform notice</AppText>
                    <AppTextInput style={styles.modalInput} value={settingsDraft.general.announcement ?? ''} onChangeText={(v) => setGeneralSetting('announcement', v)} multiline />
                    <AppText style={styles.settingLabel}>Minimum app version (x.y.z)</AppText>
                    <AppTextInput style={styles.modalInput} value={settingsDraft.general.minimum_app_version ?? ''} onChangeText={(v) => setGeneralSetting('minimum_app_version', v)} autoCapitalize="none" />
                    <AppText style={styles.settingLabel}>Help URL</AppText>
                    <AppTextInput style={styles.modalInput} value={settingsDraft.general.help_url ?? ''} onChangeText={(v) => setGeneralSetting('help_url', v)} autoCapitalize="none" keyboardType="url" />
                    <AppText style={styles.settingLabel}>Support URL</AppText>
                    <AppTextInput style={styles.modalInput} value={settingsDraft.general.support_url ?? ''} onChangeText={(v) => setGeneralSetting('support_url', v)} autoCapitalize="none" keyboardType="url" />
                  </View>
                ) : null}

                {settingsCategory === 'appearance' && settings ? (
                  <View style={styles.settingsCard}>
                    <AppText style={styles.settingVal}>Fixed monochrome palette</AppText>
                    <AppText style={styles.settingLabel}>
                      Background {Monochrome.background} · cards {Monochrome.surfacePrimary} · secondary surfaces {Monochrome.surfaceSecondary} · elevated surfaces {Monochrome.surfaceElevated} · borders {Monochrome.border}.
                    </AppText>
                    <AppText style={styles.settingLabel}>
                      Primary text {Monochrome.textPrimary} · secondary text {Monochrome.textSecondary} · muted text {Monochrome.textMuted}. Custom colors and gradients are not supported.
                    </AppText>
                  </View>
                ) : null}

                {(settingsCategory === 'transport' || settingsCategory === 'payments') && settingsDraft ? (
                  <View style={styles.settingsCard}>
                    <AppText style={styles.settingLabel}>Currency is fixed to the environment currency ({settings?.currency ?? 'unavailable'}); changing it does not rewrite historical transactions.</AppText>
                    {([
                      ['min_topup_minor', 'Minimum top-up (minor units)'],
                      ['max_topup_minor', 'Maximum top-up (minor units)'],
                      ['max_wallet_balance_minor', 'Maximum wallet balance (minor units)'],
                      ['min_balance_to_board_minor', 'Minimum boarding balance (minor units)'],
                      ['max_tap_fare_minor', 'Maximum tap fare (minor units)'],
                      ['max_daily_card_spend_minor', 'Maximum daily card spend (minor units)'],
                    ] as const).map(([key, label]) => (
                      <View key={key} style={styles.settingItem}>
                        <AppText style={styles.settingLabel}>{label}</AppText>
                        <AppTextInput
                          style={styles.modalInput}
                          value={String(settingsDraft.policy[key])}
                          onChangeText={(value) => setPolicySetting(key, value)}
                          keyboardType="number-pad"
                        />
                      </View>
                    ))}
                    <AppText style={styles.settingLabel}>
                      eSewa status: {settings?.gateways.esewa_status.replace('_', ' ') ?? 'unavailable'}.
                      {settings?.gateways.esewa_missing_configuration.length
                        ? ` Missing configuration: ${settings.gateways.esewa_missing_configuration.join(', ')}.`
                        : ''}
                      {' '}This is a configuration check only; no live payment or provider health check is performed. Secrets and success verification remain server-controlled.
                    </AppText>
                  </View>
                ) : null}

                {settingsCategory === 'tracking' && settingsDraft ? (
                  <View style={styles.settingsCard}>
                    <AppText style={styles.settingLabel}>Mark a location stale after this many seconds (15–3600).</AppText>
                    <AppTextInput
                      style={styles.modalInput}
                      value={String(settingsDraft.location.stale_after_seconds)}
                      onChangeText={setLocationSetting}
                      keyboardType="number-pad"
                    />
                    <AppText style={styles.settingLabel}>Coordinates are not generated; stale fleet locations remain suppressed by the API.</AppText>
                  </View>
                ) : null}

                {settingsCategory === 'users' && settingsDraft ? (
                  <View style={styles.settingsCard}>
                    <AppText style={styles.settingLabel}>Verification code expiry in minutes (1–60)</AppText>
                    <AppTextInput
                      style={styles.modalInput}
                      value={String(settingsDraft.verification.expire_minutes)}
                      onChangeText={(value) => setVerificationSetting('expire_minutes', value)}
                      keyboardType="number-pad"
                    />
                    <AppText style={styles.settingLabel}>Maximum verification attempts (1–10)</AppText>
                    <AppTextInput
                      style={styles.modalInput}
                      value={String(settingsDraft.verification.max_attempts)}
                      onChangeText={(value) => setVerificationSetting('max_attempts', value)}
                      keyboardType="number-pad"
                    />
                    <AppText style={styles.settingLabel}>Resend cooldown in seconds (15–3600)</AppText>
                    <AppTextInput
                      style={styles.modalInput}
                      value={String(settingsDraft.verification.resend_cooldown_seconds)}
                      onChangeText={(value) => setVerificationSetting('resend_cooldown_seconds', value)}
                      keyboardType="number-pad"
                    />
                    <AppText style={styles.settingLabel}>Email continues using generated one-time codes and the configured mail delivery. Phone development override remains server-controlled.</AppText>
                  </View>
                ) : null}

                {settingsCategory === 'security' && settingsDraft ? (
                  <View style={styles.settingsCard}>
                    {([
                      ['auth_ip_per_minute', 'Login attempts per IP per minute (1–60)'],
                      ['auth_ip_per_hour', 'Login attempts per IP per hour (2–1000)'],
                      ['auth_account_per_minute', 'Login attempts per account per minute (1–60)'],
                    ] as const).map(([key, label]) => (
                      <View key={key} style={styles.settingItem}>
                        <AppText style={styles.settingLabel}>{label}</AppText>
                        <AppTextInput
                          style={styles.modalInput}
                          value={String(settingsDraft.security[key])}
                          onChangeText={(value) => setSecuritySetting(key, value)}
                          keyboardType="number-pad"
                        />
                      </View>
                    ))}
                    <AppText style={styles.settingLabel}>The API enforces a nonzero minimum and bounded maximum. Token expiry, permission checks, and local-environment rate-limit bypass are not editable here.</AppText>
                  </View>
                ) : null}

                {settingsCategory === 'companies' && settingsDraft ? (
                  <View style={styles.settingsCard}>
                    {([
                      ['accept_new_companies', 'Accept new company registrations'],
                      ['require_approval', 'Require Super Admin approval for new companies'],
                    ] as const).map(([key, label]) => (
                      <Pressable
                        key={key}
                        accessibilityRole="switch"
                        accessibilityState={{ checked: settingsDraft.companies[key] }}
                        onPress={() => setCompanyPolicy(key, !settingsDraft.companies[key])}
                        style={styles.settingItem}
                      >
                        <AppText style={styles.settingVal}>{settingsDraft.companies[key] ? 'ON' : 'OFF'} · {label}</AppText>
                      </Pressable>
                    ))}
                    <AppText style={styles.settingLabel}>Applies to platform-provisioned companies. This backend currently has no public company-application endpoint.</AppText>
                  </View>
                ) : null}

                {settingsCategory === 'roles' && settings ? (
                  <View style={styles.settingsCard}>
                    <AppText style={styles.settingVal}>Enforced role and permission matrix</AppText>
                    <AppText style={styles.settingLabel}>Token permissions are derived from application code. Database role-permission edits alone do not grant API abilities, so editing remains disabled here.</AppText>
                    {settings.roles.roles.map((role) => (
                      <View key={role.id} style={styles.settingItem}>
                        <AppText style={styles.settingVal}>{role.name} · {role.scope}{role.is_system ? ' · system' : ''}</AppText>
                        <AppText style={styles.settingLabel}>{role.description || role.authorization_source}</AppText>
                        <AppText style={styles.settingLabel}>
                          Effective API abilities: {role.effective_permissions.includes('*')
                            ? 'all platform abilities (*)'
                            : role.effective_permissions.length
                              ? role.effective_permissions.join(', ')
                              : 'none defined in the enforced role matrix'}
                        </AppText>
                      </View>
                    ))}
                    {Object.entries(settings.roles.permission_catalog).map(([group, permissions]) => (
                      <View key={group} style={styles.settingItem}>
                        <AppText style={styles.settingVal}>{group}</AppText>
                        <AppText style={styles.settingLabel}>{permissions.join(', ')}</AppText>
                      </View>
                    ))}
                  </View>
                ) : null}

                {settingsCategory === 'notifications' || settingsCategory === 'integrations' || settingsCategory === 'health' || settingsCategory === 'reports' ? (
                  <View style={styles.settingsCard}>
                    <AppText style={styles.settingVal}>Current status</AppText>
                    {settingsCategory === 'notifications' && settings ? (
                      <>
                        <AppText style={styles.settingLabel}>Email: {settings.integrations.email.status.replaceAll('_', ' ')} via {settings.integrations.email.driver}{settings.integrations.email.missing_configuration.length ? ` · Missing: ${settings.integrations.email.missing_configuration.join(', ')}` : ''}</AppText>
                        <AppText style={styles.settingLabel}>WhatsApp: {settings.integrations.whatsapp.status.replaceAll('_', ' ')}{settings.integrations.whatsapp.missing_configuration.length ? ` · Missing: ${settings.integrations.whatsapp.missing_configuration.join(', ')}` : ''}</AppText>
                        <AppText style={styles.settingLabel}>Push: unavailable ({settings.integrations.push.reason}). No test notification was sent.</AppText>
                      </>
                    ) : null}
                    {settingsCategory === 'integrations' && settings ? (
                      <>
                        <AppText style={styles.settingLabel}>eSewa: {settings.gateways.esewa_status.replaceAll('_', ' ')} · simulator: {settings.gateways.dummy_enabled ? 'enabled' : 'disabled'}.</AppText>
                        <AppText style={styles.settingLabel}>Email: {settings.integrations.email.status.replaceAll('_', ' ')} · WhatsApp: {settings.integrations.whatsapp.status.replaceAll('_', ' ')}.</AppText>
                        <AppText style={styles.settingLabel}>Maps: unavailable ({settings.integrations.maps.reason}) · Queue: {settings.integrations.queue.driver}, {settings.integrations.queue.status.replaceAll('_', ' ')}.</AppText>
                        <AppText style={styles.settingLabel}>Configuration status only; no external provider was contacted and no credentials are returned.</AppText>
                      </>
                    ) : null}
                    {settingsCategory === 'health' ? Object.entries(systemHealth?.checks ?? {}).map(([name, check]) => <AppText key={name} style={styles.settingLabel}>{name}: {check.status ?? (check.ok ? 'operational' : 'unavailable')} {check.driver ? `(${check.driver})` : ''}</AppText>) : null}
                    {settingsCategory === 'reports' ? <AppText style={styles.settingLabel}>Export and retention policy controls are not available in the current backend.</AppText> : null}
                  </View>
                ) : null}

                {settingsCategory !== 'general' && settingsCategory !== 'transport' && settingsCategory !== 'payments' && settingsCategory !== 'tracking' && settingsCategory !== 'users' && settingsCategory !== 'security' && settingsCategory !== 'companies' ? null : (
                  <View style={styles.settingsCard}>
                    <AppText style={styles.settingLabel}>Administrative reason (required; at least 10 characters)</AppText>
                    <AppTextInput
                      style={styles.modalInput}
                      value={settingsReason}
                      onChangeText={setSettingsReason}
                      placeholder="Describe the approval or operational reason"
                      placeholderTextColor={Brand.textSecondary}
                      multiline
                    />
                    <View style={styles.settingsActionRow}>
                      <Pressable accessibilityRole="button" onPress={cancelSettingsEdits} style={styles.settingsCancel}>
                        <AppText style={styles.settingVal}>Cancel</AppText>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        disabled={settingsSaving || !settingsGroupIsDirty(
                          settingsCategory === 'general' ? 'general'
                            : settingsCategory === 'tracking' ? 'location'
                              : settingsCategory === 'users' ? 'verification'
                                : settingsCategory === 'security' ? 'security'
                                  : settingsCategory === 'companies' ? 'companies' : 'policy',
                        ) || settingsReason.trim().length < 10}
                        onPress={saveSettingsEdits}
                        style={[styles.settingsSave, (settingsSaving || settingsReason.trim().length < 10) && styles.settingsSaveDisabled]}
                      >
                        {settingsSaving ? <ActivityIndicator color={Brand.white} /> : <AppText style={styles.settingsSaveText}>Save changes</AppText>}
                      </Pressable>
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>

      <Modal visible={menuVisible} animationType="slide" transparent onRequestClose={() => setMenuVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.menuSheet, { paddingBottom: insets.bottom + Spacing.three }]}>
            <View style={styles.modalHeader}>
              <View>
                <AppText style={styles.modalTitle}>Platform navigation</AppText>
                <AppText style={styles.menuSubtitle}>Choose an administration area</AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close navigation menu"
                onPress={() => setMenuVisible(false)}
                hitSlop={8}
              >
                <SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }} size={24} tintColor={Brand.textSecondary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {ADMIN_MENU_GROUPS.map((group) => (
                <View key={group.title} style={styles.menuGroup}>
                  <AppText style={styles.menuGroupTitle}>{group.title}</AppText>
                  {group.items.map((item) => (
                    <Pressable
                      key={item.tab}
                      accessibilityRole="button"
                      accessibilityState={{ selected: activeTab === item.tab }}
                      onPress={() => {
                        setMenuVisible(false);
                        selectAdminTab(item.tab);
                      }}
                      style={[styles.menuItem, activeTab === item.tab && styles.menuItemActive]}
                    >
                      <View style={styles.menuItemCopy}>
                        <AppText style={[styles.menuItemTitle, activeTab === item.tab && styles.menuItemTitleActive]}>{item.label}</AppText>
                        <AppText style={styles.menuItemDetail}>{item.detail}</AppText>
                      </View>
                      <SymbolView
                        name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                        size={16}
                        tintColor={activeTab === item.tab ? Brand.primary : Brand.textMuted}
                      />
                    </Pressable>
                  ))}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Register Company Modal */}
      <Modal visible={companyModalVisible} animationType="slide" transparent onRequestClose={closeCompanyModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <AppText style={styles.modalTitle}>Register Transport Company</AppText>
              <Pressable onPress={closeCompanyModal} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close company registration">
                <SymbolView
                  name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                  size={24}
                  tintColor={Brand.textSecondary}
                />
              </Pressable>
            </View>

            <View style={styles.modalForm}>
              <AppTextInput
                style={styles.modalInput}
                value={compName}
                onChangeText={setCompName}
                placeholder="Company Name (e.g. Sajha Yatayat)"
                placeholderTextColor={Brand.textSecondary}
              />
              <AppTextInput
                style={styles.modalInput}
                value={compCode}
                onChangeText={setCompCode}
                placeholder="Code (e.g. SAJHA)"
                placeholderTextColor={Brand.textSecondary}
                autoCapitalize="characters"
              />
              <AppTextInput
                style={styles.modalInput}
                value={compRegistration}
                onChangeText={setCompRegistration}
                placeholder="Company registration number"
                placeholderTextColor={Brand.textSecondary}
              />
              <AppTextInput
                style={styles.modalInput}
                value={compEmail}
                onChangeText={setCompEmail}
                placeholder="Contact Email"
                placeholderTextColor={Brand.textSecondary}
                keyboardType="email-address"
              />
              <AppTextInput
                style={styles.modalInput}
                value={compPhone}
                onChangeText={setCompPhone}
                placeholder="Phone Number"
                placeholderTextColor={Brand.textSecondary}
              />
              <AppTextInput
                style={styles.modalInput}
                value={compAddress}
                onChangeText={setCompAddress}
                placeholder="Headquarters Address"
                placeholderTextColor={Brand.textSecondary}
              />

              <AppText style={[styles.sectionTitle, { marginTop: Spacing.two, marginBottom: Spacing.one }]}>Initial Company Admin</AppText>
              <AppText style={styles.compSub}>This creates the first login account for the company and gives them Company Admin access.</AppText>
              <AppTextInput
                style={styles.modalInput}
                value={initialAdminName}
                onChangeText={setInitialAdminName}
                placeholder="Admin full name"
                placeholderTextColor={Brand.textSecondary}
              />
              <AppTextInput
                style={styles.modalInput}
                value={initialAdminEmail}
                onChangeText={setInitialAdminEmail}
                placeholder="Admin email"
                placeholderTextColor={Brand.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <AppTextInput
                style={styles.modalInput}
                value={initialAdminPassword}
                onChangeText={setInitialAdminPassword}
                placeholder="Admin password (10+ chars)"
                placeholderTextColor={Brand.textSecondary}
                secureTextEntry
                autoCapitalize="none"
              />
              <AppTextInput
                style={styles.modalInput}
                value={initialAdminPasswordConfirm}
                onChangeText={setInitialAdminPasswordConfirm}
                placeholder="Confirm admin password"
                placeholderTextColor={Brand.textSecondary}
                secureTextEntry
                autoCapitalize="none"
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

      <Modal visible={companyDetailVisible} animationType="slide" transparent onRequestClose={closeCompanyDetails}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '88%', paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <AppText style={styles.modalTitle}>Company administration</AppText>
              <Pressable onPress={closeCompanyDetails} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close company details">
                <SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }} size={24} tintColor={Brand.textSecondary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {companyDetailLoading ? (
                <View style={styles.loadingBox}><ActivityIndicator color={Brand.primary} /><AppText style={styles.loadingText}>Loading company and staff...</AppText></View>
              ) : companyDetail ? (
                <View style={styles.modalForm}>
                  <AppText style={styles.sectionTitle}>{companyDetail.name}</AppText>
                  <AppText style={styles.compSub}>Code {companyDetail.code} · {companyDetail.status.toUpperCase()}</AppText>
                  <AppText style={styles.compSub}>{companyDetail.email} · {companyDetail.phone}</AppText>
                  <AppText style={styles.compSub}>{companyDetail.address || 'Address not recorded'}</AppText>
                  <AppText style={styles.sectionTitle}>Company administrators</AppText>
                  {companyStaff.map((membership) => (
                    <View key={membership.membership_id} style={styles.userCard}>
                      <View style={styles.userTop}>
                        <View style={styles.userInfo}>
                          <AppText style={styles.userName}>{membership.user.name}</AppText>
                          <AppText style={styles.userEmail}>{membership.user.email}</AppText>
                          <AppText style={styles.compSub}>{membership.status.replaceAll('_', ' ')} · {membership.user.status}</AppText>
                        </View>
                        <Pressable onPress={() => handleRevokeCompanyAdmin(membership)} style={[styles.userActionBtn, styles.btnSuspend]}>
                          <AppText style={styles.userActionText}>Revoke</AppText>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                  {companyStaff.length === 0 ? <View style={styles.emptyBox}><AppText style={styles.emptyText}>No staff memberships are recorded.</AppText></View> : null}
                  <AppText style={styles.sectionTitle}>Assign Company Admin</AppText>
                  <AppText style={styles.compSub}>Creates an account with the Company Admin role using the existing protected invitation endpoint. Share initial credentials securely; they are not sent by this request.</AppText>
                  <AppTextInput style={styles.modalInput} value={staffName} onChangeText={setStaffName} placeholder="Administrator name" placeholderTextColor={Brand.textSecondary} />
                  <AppTextInput style={styles.modalInput} value={staffEmail} onChangeText={setStaffEmail} placeholder="Administrator email" placeholderTextColor={Brand.textSecondary} keyboardType="email-address" autoCapitalize="none" />
                  <AppTextInput style={styles.modalInput} value={staffPhone} onChangeText={setStaffPhone} placeholder="Phone (optional)" placeholderTextColor={Brand.textSecondary} keyboardType="phone-pad" />
                  <AppTextInput style={styles.modalInput} value={staffPassword} onChangeText={setStaffPassword} placeholder="Initial password (10+ characters)" placeholderTextColor={Brand.textSecondary} secureTextEntry autoCapitalize="none" />
                  <PrimaryButton title={invitingStaff ? 'Creating account...' : 'Assign Company Admin'} onPress={() => void handleInviteCompanyAdmin()} disabled={invitingStaff} style={styles.modalBtn} />
                </View>
              ) : <View style={styles.emptyBox}><AppText style={styles.emptyText}>Company detail is unavailable. Close and retry.</AppText></View>}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Super Admin Account Modal */}
      <Modal visible={accountModalVisible} animationType="slide" transparent onRequestClose={() => setAccountModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <AppText style={styles.modalTitle}>Super Administrator</AppText>
              <Pressable onPress={() => setAccountModalVisible(false)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close account modal">
                <SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }} size={24} tintColor={Brand.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.adminProfileHeader}>
              <View style={styles.adminProfileAvatarLarge}>
                <AppText style={styles.adminProfileAvatarLargeText}>
                  {(session.user?.name || 'SA').slice(0, 2).toUpperCase()}
                </AppText>
              </View>
              <AppText style={styles.adminProfileName}>{session.user?.name || 'Super Administrator'}</AppText>
              <AppText style={styles.adminProfileEmail}>{session.user?.email || 'admin@tappay.np'}</AppText>
              <View style={styles.adminRoleBadge}>
                <AppText style={styles.adminRoleBadgeText}>PLATFORM ROOT ACCESS</AppText>
              </View>
            </View>

            <View style={styles.adminStatsCard}>
              <View style={styles.adminStatItem}>
                <AppText style={styles.adminStatValue}>{dashboard?.companies.total ?? companies.length}</AppText>
                <AppText style={styles.adminStatLabel}>Companies</AppText>
              </View>
              <View style={styles.adminStatItem}>
                <AppText style={styles.adminStatValue}>{dashboard?.users.total ?? users.length}</AppText>
                <AppText style={styles.adminStatLabel}>Users</AppText>
              </View>
              <View style={styles.adminStatItem}>
                <AppText style={styles.adminStatValue}>{dashboard?.fleet.buses.total ?? buses.length}</AppText>
                <AppText style={styles.adminStatLabel}>Buses</AppText>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setAccountModalVisible(false);
                router.push('/portal/support' as any);
              }}
              style={styles.adminSupportBtn}
            >
              <SymbolView
                name={{ ios: 'bubble.left.and.bubble.right.fill', android: 'support_agent', web: 'support_agent' }}
                size={18}
                tintColor={Monochrome.textPrimary}
              />
              <AppText style={styles.adminSupportBtnText}>Support queue</AppText>
            </Pressable>

            <Pressable
              onPress={() => {
                setAccountModalVisible(false);
                handleAdminLogout();
              }}
              style={styles.adminLogoutBtn}
            >
              <SymbolView
                name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }}
                size={18}
                tintColor={Monochrome.textSecondary}
              />
              <AppText style={styles.adminLogoutBtnText}>Sign Out of Platform</AppText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles() {
  const colors = {
    background: Monochrome.background,
    surface: Monochrome.surfaceSecondary,
    raised: Monochrome.surfaceElevated,
    border: Monochrome.border,
    text: Monochrome.textPrimary,
    muted: Monochrome.textSecondary,
    accent: Brand.primary,
  };
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: Spacing.two,
  },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.primary,
  },
  headerIdentity: {
    flex: 1,
    gap: 2,
  },
  headerMenuButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3F4EF',
  },
  notificationButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3F4EF',
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
    backgroundColor: Brand.primary,
  },
  notificationBadgeText: {
    color: Brand.white,
    fontSize: 9,
    fontWeight: '700',
  },
  backBtn: {
    padding: Spacing.one,
  },
  backBtnPlaceholder: {
    width: 30,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  headerSubtitle: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  menuSheet: {
    maxHeight: '86%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  menuSubtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 3,
  },
  menuGroup: {
    marginBottom: Spacing.three,
  },
  menuGroupTitle: {
    color: Brand.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: Spacing.two,
  },
  menuItem: {
    minHeight: 62,
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  menuItemActive: {
    borderColor: Brand.primary,
    backgroundColor: '#E3F4EF',
  },
  menuItemCopy: {
    flex: 1,
    gap: 3,
  },
  menuItemTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  menuItemTitleActive: {
    color: Brand.primaryDark,
  },
  menuItemDetail: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
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
    color: colors.muted,
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
    width: '46%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: Spacing.four,
    gap: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
  },
  metricSub: {
    fontSize: 11,
    color: colors.accent,
    marginTop: 2,
  },
  volumeCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: Spacing.five,
    gap: Spacing.two,
  },
  volumeTitle: {
    fontSize: 14,
    color: colors.muted,
    fontWeight: '600',
  },
  volumeAmount: {
    fontSize: 34,
    fontWeight: '800',
    color: Monochrome.textPrimary,
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
    backgroundColor: Monochrome.textMuted,
  },
  healthText: {
    fontSize: 12,
    color: colors.muted,
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
    color: colors.text,
  },
  addBtn: {
    backgroundColor: Brand.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnText: {
    color: Brand.primaryText,
    fontSize: 13,
    fontWeight: '700',
  },
  companyRowCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.text,
  },
  compSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  compEmail: {
    fontSize: 13,
    color: colors.accent,
  },
  statusToggle: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: '#E3F4EF',
  },
  statusSuspended: {
    backgroundColor: '#FCEBEC',
  },
  statusToggleText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.text,
  },
  userCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: Brand.primaryText,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  userEmail: {
    fontSize: 12,
    color: colors.muted,
  },
  userTypeTag: {
    fontSize: 10,
    color: colors.accent,
    fontWeight: '700',
    marginTop: 2,
  },
  userActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
  },
  btnSuspend: {
    backgroundColor: '#FCEBEC',
  },
  btnReinstate: {
    backgroundColor: '#E3F4EF',
  },
  userActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  logCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.accent,
  },
  logDate: {
    fontSize: 11,
    color: colors.muted,
  },
  logActor: {
    fontSize: 12,
    color: colors.text,
  },
  logIp: {
    fontSize: 11,
    color: Monochrome.textMuted,
  },
  paymentSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  paymentSummaryCard: {
    minWidth: '46%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: Spacing.three,
    gap: 4,
  },
  paymentSummaryAmount: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  paymentCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  paymentReferenceWrap: {
    flex: 1,
    paddingRight: Spacing.two,
  },
  paymentReference: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  paymentAmount: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  paymentLedger: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: Spacing.two,
    gap: 4,
  },
  settingsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  settingItem: {
    gap: 2,
  },
  settingLabel: {
    fontSize: 12,
    color: colors.muted,
  },
  settingVal: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  settingStatus: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 0.4,
  },
  settingsActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  settingsCancel: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingsSave: {
    minHeight: 44,
    minWidth: 120,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: 10,
    backgroundColor: colors.accent,
  },
  settingsSaveDisabled: {
    opacity: 0.5,
  },
  settingsSaveText: {
    color: Brand.primaryText,
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: colors.surface,
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
    color: colors.text,
  },
  modalForm: {
    gap: Spacing.three,
  },
  modalInput: {
    backgroundColor: colors.raised,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    height: 48,
    fontSize: 15,
    color: colors.text,
  },
  modalBtn: {
    marginTop: Spacing.two,
  },
  dashboardEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.accent,
  },
  dashboardTitle: {
    marginTop: Spacing.one,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: colors.text,
  },
  periodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  periodButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  periodButtonActive: {
    borderColor: Brand.primary,
    backgroundColor: Brand.primary,
  },
  periodText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.muted,
  },
  periodTextActive: {
    color: Brand.primaryText,
  },
  financeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.four,
  },
  financeAmount: {
    marginTop: Spacing.one,
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  statDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: Spacing.two,
  },
  healthDotOk: {
    backgroundColor: Monochrome.textSecondary,
  },
  healthDotWarn: {
    backgroundColor: Monochrome.surfaceElevated,
  },
  errorBox: {
    borderWidth: 1,
    borderColor: Monochrome.border,
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  errorText: {
    color: Monochrome.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  retryButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: 10,
    backgroundColor: Brand.primary,
  },
  retryText: {
    color: Brand.primaryText,
    fontWeight: '700',
  },
  searchInput: {
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  filterButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterButtonActive: {
    borderColor: Brand.primary,
    backgroundColor: Brand.primary,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
  },
  filterTextActive: {
    color: Brand.primaryText,
  },
  emptyBox: {
    padding: Spacing.four,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
  },
  loadMoreButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  loadMoreText: {
    color: colors.accent,
    fontWeight: '700',
  },
  adminAvatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  adminAvatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: Brand.primaryText,
  },
  adminProfileHeader: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
    gap: 6,
  },
  adminProfileAvatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.accent,
    marginBottom: 4,
  },
  adminProfileAvatarLargeText: {
    fontSize: 22,
    fontWeight: '800',
    color: Brand.primaryText,
  },
  adminProfileName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  adminProfileEmail: {
    fontSize: 13,
    color: colors.muted,
  },
  adminRoleBadge: {
    backgroundColor: Monochrome.surfaceSecondary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Monochrome.border,
    marginTop: 4,
  },
  adminRoleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Monochrome.textSecondary,
    letterSpacing: 0.5,
  },
  adminStatsCard: {
    flexDirection: 'row',
    backgroundColor: colors.raised,
    borderRadius: 14,
    padding: Spacing.three,
    marginVertical: Spacing.three,
    borderWidth: 1,
    borderColor: colors.border,
  },
  adminStatItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  adminStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  adminStatLabel: {
    fontSize: 11,
    color: colors.muted,
  },
  adminLogoutBtn: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
    borderRadius: 12,
    paddingVertical: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  adminSupportBtn: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raised,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  adminSupportBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  adminLogoutBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: Monochrome.textSecondary,
  },
  });
}
