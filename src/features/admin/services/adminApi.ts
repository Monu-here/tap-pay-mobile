import {
  apiRequest,
  mapApiData,
  normalizeCollection,
  type ApiResult,
} from '@/features/auth/services/apiClient';

// ---------------------------------------------------------------------------
// Super-Admin Platform Types & APIs (/platform/*)
// ---------------------------------------------------------------------------

export type PlatformDateRange = {
  date_from: string;
  date_to: string;
};

export type PlatformConcessionApplication = {
  id: number;
  category: 'student' | 'senior_citizen';
  details: Record<string, string | null>;
  status: 'pending' | 'approved' | 'rejected';
  review_note: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  user: {
    id: number;
    name: string | null;
    name_en: string | null;
    name_np: string | null;
    email: string;
    phone: string | null;
    user_type: string;
  } | null;
  document: {
    id: number;
    document_type: string;
    side: string | null;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
  } | null;
};

export type PlatformListQuery = {
  cursor?: string | null;
  qrCursor?: string | null;
  perPage?: number;
  search?: string;
  status?: string;
  type?: string;
  tracking?: 'live' | 'stale' | 'unknown';
  companyId?: number;
  dateFrom?: string;
  dateTo?: string;
  action?: string;
  actorId?: number;
  settingCategory?: string;
};

export function getPlatformConcessionApplications(
  status: PlatformConcessionApplication['status'] = 'pending',
): Promise<ApiResult<PlatformConcessionApplication[]>> {
  return apiRequest(`/platform/concession-applications?status=${status}&per_page=50`);
}

export function reviewPlatformConcessionApplication(
  id: number,
  decision: 'approved' | 'rejected',
  reviewNote?: string,
): Promise<ApiResult<{ application: PlatformConcessionApplication }>> {
  return apiRequest(`/platform/concession-applications/${id}`, {
    method: 'PATCH',
    body: {
      decision,
      ...(reviewNote ? { review_note: reviewNote } : {}),
    },
  });
}

export type MoneySummary = {
  amount_minor: number;
  amount: string;
  currency: string;
  formatted: string;
};

export type PlatformDashboardData = {
  companies: { total: number; active: number; pending: number; suspended: number };
  users: {
    total: number;
    active: number;
    suspended: number;
    pending_verification: number;
    passengers: number;
    company_admins: number;
    drivers: number;
    new_this_month: number;
    active_last_24h: number;
  };
  cards: { total: number; active: number; inactive_blocked_lost: number; pending: number };
  fleet: {
    buses: { total: number; active: number; offline: number; maintenance: number; live_now: number };
    drivers: { total: number; active: number };
  };
  trips: {
    total: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    passengers_carried: number;
    revenue: MoneySummary;
  };
  wallet: {
    wallets: { total: number; frozen: number; floating_balance: MoneySummary };
    total_loaded_minor: number;
    total_loaded: MoneySummary;
    total_fares_minor: number;
    total_fares: MoneySummary;
  };
  payments: {
    summary: Record<string, { entries: number; total_minor: number; total: MoneySummary }>;
  };
  taps: {
    total: number;
    successful: number;
    failed: number;
    reversed: number;
    success_rate: number;
    collected: MoneySummary;
  };
};

export type PlatformPayment = {
  id: number;
  reference: string;
  user_id: number;
  gateway: string;
  provider_transaction_id: string | null;
  purpose: string | null;
  status: string;
  status_label: string | null;
  amount: MoneySummary;
  initiated_at: string | null;
  paid_at: string | null;
  failed_at: string | null;
  expires_at: string | null;
  failure_code: string | null;
  failure_reason: string | null;
  callback_count: number;
  ledger: {
    reference: string;
    type: string;
    direction: string;
    amount: MoneySummary;
    balance_after: MoneySummary;
  }[];
  created_at: string | null;
};

export type PlatformPaymentsData = {
  payments: PlatformPayment[];
  summary: Record<string, { entries: number; total_minor: number; total: MoneySummary }>;
  qr_payments: PlatformQrPayment[];
  qr_summary: Record<string, { entries: number; total_minor: number; total: MoneySummary }>;
};

export type PlatformQrPayment = {
  tap_uid: string;
  transaction_reference: string;
  user_id: number;
  bus_number: string | null;
  route_name: string | null;
  company_name: string | null;
  status: string;
  status_label: string | null;
  fare: MoneySummary;
  balance_before: MoneySummary;
  balance_after: MoneySummary;
  failure_code: string | null;
  failure_reason: string | null;
  tapped_at: string | null;
  settled_at: string | null;
};

export type PlatformSupportTicket = {
  reference: string;
  category: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  transaction_reference: string | null;
  requester?: { id: number; name: string; email: string } | null;
  created_at: string | null;
  updated_at: string | null;
  messages?: {
    id: number;
    author_id: number;
    author_name: string | null;
    is_staff: boolean;
    body: string;
    created_at: string | null;
  }[];
};

export type PlatformCompany = {
  id: number;
  name: string;
  code: string;
  email: string;
  phone: string;
  status: string;
  address?: string;
  buses_count?: number;
  drivers_count?: number;
  created_at: string;
};

export type CompanyProfile = {
  id: number;
  uuid: string;
  code: string;
  name: string;
  legal_name: string | null;
  registration_number: string | null;
  status: string;
  status_label: string | null;
  contact: {
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  settings: Record<string, unknown> | null;
};

export type PlatformUser = {
  id: number;
  uuid: string;
  name: string;
  email: string;
  phone?: string;
  type: string;
  status: string;
  email_verified: boolean;
  phone_verified: boolean;
  roles?: string[];
  created_at: string;
};

export type CompanyStaffMembership = {
  membership_id: number;
  status: string;
  invited_at: string | null;
  joined_at: string | null;
  user: PlatformUser;
};

export type PlatformBus = {
  id: number;
  bus_number: string;
  registration_number: string;
  vehicle_type: string | null;
  capacity: number | null;
  status: string;
  company: { id: number; name: string; code: string } | null;
  tracking_status: 'live' | 'stale' | 'unknown';
  last_location_at: string | null;
  location: { latitude: number; longitude: number } | null;
  active_trip: {
    id: number;
    reference: string;
    status: string;
    route: { id: number; name: string } | null;
    driver_name: string | null;
    started_at: string | null;
  } | null;
};

export type PlatformTrip = {
  id: number;
  reference: string;
  status: string;
  scheduled_departure: string | null;
  started_at: string | null;
  ended_at: string | null;
  passenger_count: number;
  revenue: MoneySummary;
  company: { id: number; name: string; code: string } | null;
  bus: { id: number; bus_number: string; registration_number: string; last_location_at: string | null } | null;
  route: { id: number; name: string } | null;
  driver: { id: number; name: string } | null;
};

export type AuditLogEntry = {
  id: number;
  action: string;
  actor: { type: string; id: number | null; email: string | null };
  entity: { type: string | null; id: string | null };
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_fields: string[] | null;
  context: Record<string, unknown> | null;
  ip_address?: string;
  severity?: string;
  created_at: string;
};

export type PlatformSettings = {
  currency: string;
  general: {
    platform_name: string;
    description: string;
    support_email: string;
    support_phone: string;
    contact_address: string;
    default_language: 'en';
    supported_languages: 'en'[];
    timezone: string;
    date_format: 'Y-m-d' | 'd/m/Y' | 'm/d/Y';
    announcement: string | null;
    minimum_app_version: string | null;
    help_url: string | null;
    support_url: string | null;
  };
  appearance: {
    theme_default: 'system' | 'light' | 'dark';
    primary_color: string;
    secondary_color: string;
  };
  policy: {
    min_topup_minor: number;
    max_topup_minor: number;
    max_wallet_balance_minor: number;
    min_balance_to_board_minor: number;
    max_tap_fare_minor: number;
    max_daily_card_spend_minor: number;
  };
  location: { stale_after_seconds: number };
  verification: {
    expire_minutes: number;
    max_attempts: number;
    resend_cooldown_seconds: number;
    phone_dev_mode: boolean;
  };
  security: {
    auth_ip_per_minute: number;
    auth_ip_per_hour: number;
    auth_account_per_minute: number;
  };
  companies: {
    accept_new_companies: boolean;
    require_approval: boolean;
  };
  roles: {
    roles: {
      id: number;
      name: string;
      slug: string;
      scope: string;
      is_system: boolean;
      description: string | null;
      effective_permissions: string[];
      authorization_source: string;
    }[];
    permission_catalog: Record<string, string[]>;
    editable: false;
  };
  gateways: {
    dummy_enabled: boolean;
    esewa_enabled: boolean;
    esewa_available: boolean;
    esewa_status: 'disabled' | 'missing_configuration' | 'ready';
    esewa_missing_configuration: string[];
  };
  integrations: {
    email: { driver: string; status: string; missing_configuration: string[] };
    whatsapp: { status: string; missing_configuration: string[] };
    push: { status: string; reason: string };
    maps: { status: string; reason: string };
    queue: { driver: string; status: string };
  };
};

export type PlatformSettingsUpdate = {
  reason: string;
  general?: Partial<PlatformSettings['general']>;
  appearance?: Partial<PlatformSettings['appearance']>;
  policy?: Partial<PlatformSettings['policy']>;
  location?: Partial<PlatformSettings['location']>;
  verification?: Partial<Pick<PlatformSettings['verification'], 'expire_minutes' | 'max_attempts' | 'resend_cooldown_seconds'>>;
  security?: Partial<PlatformSettings['security']>;
  companies?: Partial<PlatformSettings['companies']>;
};

export type PlatformSystemHealth = {
  status: string;
  checks: Record<string, { ok: boolean; error: string | null; status?: string; driver?: string }>;
  environment: string;
  version: string;
  time: string;
};

export function getPlatformDashboard(dateRange?: PlatformDateRange): Promise<ApiResult<PlatformDashboardData>> {
  const query = dateRange
    ? `?date_from=${encodeURIComponent(dateRange.date_from)}&date_to=${encodeURIComponent(dateRange.date_to)}`
    : '';
  return apiRequest(`/platform/dashboard${query}`);
}

function listQuery(query: PlatformListQuery = {}): string {
  const values = new URLSearchParams();
  if (query.cursor) values.set('cursor', query.cursor);
  if (query.qrCursor) values.set('qr_cursor', query.qrCursor);
  if (query.perPage) values.set('per_page', String(query.perPage));
  if (query.search?.trim()) values.set('search', query.search.trim());
  if (query.status) values.set('status', query.status);
  if (query.type) values.set('type', query.type);
  if (query.tracking) values.set('tracking', query.tracking);
  if (query.companyId) values.set('company_id', String(query.companyId));
  if (query.dateFrom) values.set('date_from', query.dateFrom);
  if (query.dateTo) values.set('date_to', query.dateTo);
  if (query.action) values.set('action', query.action);
  if (query.actorId) values.set('actor_id', String(query.actorId));
  if (query.settingCategory) values.set('setting_category', query.settingCategory);
  const serialized = values.toString();
  return serialized ? `?${serialized}` : '';
}

export function getPlatformBuses(query: PlatformListQuery = {}): Promise<ApiResult<{ buses: PlatformBus[] }>> {
  return apiRequest(`/platform/buses${listQuery(query)}`).then((result) =>
    normalizeCollection<PlatformBus, 'buses'>(result, 'buses'),
  );
}

export function getPlatformTrips(query: PlatformListQuery = {}): Promise<ApiResult<{ trips: PlatformTrip[] }>> {
  return apiRequest(`/platform/trips${listQuery(query)}`).then((result) =>
    normalizeCollection<PlatformTrip, 'trips'>(result, 'trips'),
  );
}

export function getPlatformPayments(query: PlatformListQuery = {}): Promise<ApiResult<PlatformPaymentsData>> {
  return apiRequest(`/platform/payments${listQuery(query)}`);
}

export function getPlatformSupportTickets(status?: string): Promise<ApiResult<{ tickets: PlatformSupportTicket[] }>> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiRequest(`/platform/support-tickets${query}`);
}

export function getPlatformSupportTicket(reference: string): Promise<ApiResult<{ ticket: PlatformSupportTicket }>> {
  return apiRequest(`/platform/support-tickets/${encodeURIComponent(reference)}`);
}

export function replyPlatformSupportTicket(
  reference: string,
  message: string,
): Promise<ApiResult<{ ticket: PlatformSupportTicket }>> {
  return apiRequest(`/platform/support-tickets/${encodeURIComponent(reference)}/messages`, {
    method: 'POST',
    body: { message },
  });
}

export function updatePlatformSupportTicketStatus(
  reference: string,
  status: PlatformSupportTicket['status'],
): Promise<ApiResult<{ ticket: PlatformSupportTicket }>> {
  return apiRequest(`/platform/support-tickets/${encodeURIComponent(reference)}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

export function getPlatformCompanies(query: PlatformListQuery = {}): Promise<ApiResult<{ companies: PlatformCompany[] }>> {
  return apiRequest<unknown>(`/platform/companies${listQuery(query)}`).then((result) =>
    mapApiData(normalizeCollection<Record<string, unknown>, 'companies'>(result, 'companies'), (data) => ({
      companies: data.companies.map((company) => ({
        id: Number(company.id),
        name: String(company.name ?? ''),
        code: String(company.code ?? ''),
        email: String(
          (company.contact && typeof company.contact === 'object'
            ? (company.contact as Record<string, unknown>).email
            : undefined) ?? company.contact_email ?? company.email ?? '',
        ),
        phone: String(
          (company.contact && typeof company.contact === 'object'
            ? (company.contact as Record<string, unknown>).phone
            : undefined) ?? company.contact_phone ?? company.phone ?? '',
        ),
        status: String(company.status ?? ''),
        address: typeof company.address === 'string'
          ? company.address
          : company.contact && typeof company.contact === 'object' &&
              typeof (company.contact as Record<string, unknown>).address === 'string'
            ? String((company.contact as Record<string, unknown>).address)
            : undefined,
        buses_count: typeof company.buses_count === 'number'
          ? company.buses_count
          : typeof company.bus_count === 'number'
            ? company.bus_count
            : undefined,
        drivers_count: typeof company.drivers_count === 'number'
          ? company.drivers_count
          : typeof company.driver_count === 'number'
            ? company.driver_count
            : undefined,
        created_at: String(company.created_at ?? ''),
      })),
    })),
  );
}

export function createPlatformCompany(data: {
  name: string;
  code: string;
  registration_number: string;
  email: string;
  phone: string;
  address?: string;
}): Promise<ApiResult<{ company: PlatformCompany }>> {
  const { email, phone, ...company } = data;
  return apiRequest('/platform/companies', {
    method: 'POST',
    body: { ...company, contact_email: email, contact_phone: phone },
  });
}

export function getPlatformCompany(companyId: number): Promise<ApiResult<{ company: PlatformCompany }>> {
  return apiRequest<Record<string, unknown>>(`/platform/companies/${companyId}`).then((result) =>
    mapApiData(result, (data) => {
      const contact = data.contact && typeof data.contact === 'object'
        ? data.contact as Record<string, unknown>
        : {};
      return {
        company: {
          id: Number(data.id),
          name: String(data.name ?? ''),
          code: String(data.code ?? ''),
          email: String(contact.email ?? ''),
          phone: String(contact.phone ?? ''),
          address: typeof contact.address === 'string' ? contact.address : undefined,
          status: String(data.status ?? ''),
          buses_count: typeof data.bus_count === 'number' ? data.bus_count : undefined,
          drivers_count: typeof data.driver_count === 'number' ? data.driver_count : undefined,
          created_at: String(data.created_at ?? ''),
        },
      };
    }),
  );
}

export function updatePlatformCompany(companyId: number, data: Partial<PlatformCompany>): Promise<ApiResult<{ company: PlatformCompany }>> {
  return apiRequest(`/platform/companies/${companyId}`, { method: 'PATCH', body: data });
}

export function changeCompanyStatus(companyId: number, status: 'active' | 'suspended' | 'pending'): Promise<ApiResult<unknown>> {
  return apiRequest(`/platform/companies/${companyId}/status`, { method: 'POST', body: { status } });
}

export function getCompanyStaff(companyId: number): Promise<ApiResult<{ staff: CompanyStaffMembership[] }>> {
  return apiRequest<unknown>(`/platform/companies/${companyId}/staff`).then((result) =>
    mapApiData(normalizeCollection<Record<string, unknown>, 'memberships'>(result, 'memberships'), (data) => ({
      staff: data.memberships.map((membership) => {
        const user = membership.user && typeof membership.user === 'object'
          ? membership.user as Record<string, unknown>
          : {};
        const roles = Array.isArray(user.roles)
          ? user.roles.map((role) => {
              if (role && typeof role === 'object' && 'slug' in role) {
                return String((role as Record<string, unknown>).slug);
              }
              return String(role);
            })
          : [];
        return {
          membership_id: Number(membership.membership_id),
          status: String(membership.status ?? ''),
          invited_at: typeof membership.invited_at === 'string' ? membership.invited_at : null,
          joined_at: typeof membership.joined_at === 'string' ? membership.joined_at : null,
          user: {
            id: Number(user.id),
            uuid: String(user.uuid ?? ''),
            name: String(user.name ?? ''),
            email: String(user.email ?? ''),
            phone: typeof user.phone === 'string' ? user.phone : undefined,
            type: String(user.type ?? ''),
            status: String(user.status ?? ''),
            email_verified: user.email_verified === true,
            phone_verified: user.phone_verified === true,
            roles,
            created_at: String(user.created_at ?? ''),
          },
        };
      }),
    })),
  );
}

export function inviteCompanyStaff(companyId: number, data: {
  name: string;
  email: string;
  phone?: string;
  role: 'company_admin';
  password: string;
  password_confirmation: string;
}): Promise<ApiResult<unknown>> {
  return apiRequest(`/platform/companies/${companyId}/staff`, { method: 'POST', body: data });
}

export function revokeCompanyStaff(companyId: number, userId: number): Promise<ApiResult<unknown>> {
  return apiRequest(`/platform/companies/${companyId}/staff/${userId}`, { method: 'DELETE' });
}

export function getPlatformUsers(query: PlatformListQuery = {}): Promise<ApiResult<{ users: PlatformUser[] }>> {
  return apiRequest<unknown>(`/platform/users${listQuery(query)}`).then((result) =>
    normalizeCollection<PlatformUser, 'users'>(result, 'users'),
  );
}

export function suspendPlatformUser(userId: number, reason = 'Administrative suspension'): Promise<ApiResult<unknown>> {
  return apiRequest(`/platform/users/${userId}/suspend`, { method: 'POST', body: { reason } });
}

export function reinstatePlatformUser(userId: number): Promise<ApiResult<unknown>> {
  return apiRequest(`/platform/users/${userId}/reinstate`, { method: 'POST', body: {} });
}

export function getPlatformAuditLogs(query: PlatformListQuery = {}): Promise<ApiResult<{ logs: AuditLogEntry[] }>> {
  return apiRequest(`/platform/audit-logs${listQuery(query)}`);
}

export function getPlatformSettings(): Promise<ApiResult<PlatformSettings>> {
  return apiRequest('/platform/settings');
}

export function updatePlatformSettings(data: PlatformSettingsUpdate): Promise<ApiResult<PlatformSettings>> {
  return apiRequest('/platform/settings', { method: 'PATCH', body: data });
}

export function getPlatformSystemHealth(): Promise<ApiResult<PlatformSystemHealth>> {
  return apiRequest('/platform/system/health');
}

// ---------------------------------------------------------------------------
// Transport Company Administration APIs (/admin/*)
// ---------------------------------------------------------------------------

export type CompanyDashboardData = {
  fleet: {
    buses: { total: number; active: number; offline: number; maintenance: number; live_now: number; stale?: number };
    drivers: { total: number; active: number };
  };
  trips: {
    total: number;
    scheduled?: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    passengers_carried: number;
    revenue: MoneySummary;
  };
  taps: {
    total: number;
    successful: number;
    failed: number;
    reversed: number;
    success_rate: number;
    collected: MoneySummary;
  };
  payments?: {
    summary: Record<string, { entries: number; total: MoneySummary }>;
    by_gateway?: Record<string, { entries: number; total_minor: number }>;
  };
  recent_trips?: {
    reference: string;
    status: string;
    bus_number?: string;
    route?: string;
    passenger_count: number;
    revenue: MoneySummary;
    started_at: string | null;
  }[];
  recent_taps?: {
    tap_uid: string;
    transaction_reference: string;
    status: string;
    fare: MoneySummary;
    bus_number?: string;
    route?: string;
    tapped_at: string | null;
  }[];
};

export type CompanyBus = {
  id: number;
  bus_number: string;
  registration_number: string;
  vehicle_type: string;
  capacity: number;
  status: string;
  has_nfc_validator: boolean;
};

export type CompanyDriver = {
  id: number;
  name: string;
  license_number: string;
  phone: string;
  status: string;
  assigned_bus_id?: number | null;
  assigned_bus_number?: string | null;
};

export type CompanyRoute = {
  id: number;
  code: string;
  name: string;
  origin_stop_id: number;
  destination_stop_id: number;
  distance_km: number;
  estimated_minutes: number;
  stops_count?: number;
};

export type CompanySettlement = {
  id: number;
  period: { start: string; end: string };
  tap_count: number;
  gross_fares: MoneySummary;
  refunds: MoneySummary;
  net: MoneySummary;
  status: string;
  closed_at: string | null;
  generated_at: string | null;
};

export type CompanyTrip = {
  id: number;
  reference: string;
  status: string;
  scheduled_departure: string | null;
  started_at: string | null;
  ended_at: string | null;
  passenger_count: number;
  revenue: MoneySummary;
  bus: { id: number; bus_number: string } | null;
  route: { id: number; name: string } | null;
  driver: { id: number; user?: { name?: string } } | null;
};

export type CompanyTap = {
  id: number;
  tap_uid: string;
  transaction_reference: string;
  status: string;
  failure_reason: string | null;
  tapped_at: string | null;
  bus?: { bus_number?: string } | null;
  route?: { name?: string } | null;
};

export type CompanyLiveBus = {
  bus_id: number;
  bus_number: string;
  registration_number: string;
  status: string;
  latitude?: number;
  longitude?: number;
  speed?: number;
  speed_kmh?: number;
  last_seen_at?: string | null;
  route?: { id: number | null; name: string | null; destination: string | null };
};

export function getCompanyDashboard(dateRange?: PlatformDateRange): Promise<ApiResult<CompanyDashboardData>> {
  const query = dateRange
    ? `?date_from=${encodeURIComponent(dateRange.date_from)}&date_to=${encodeURIComponent(dateRange.date_to)}`
    : '';
  return apiRequest(`/admin/dashboard${query}`);
}

export function getCompanyProfile(): Promise<ApiResult<CompanyProfile>> {
  return apiRequest('/admin/company');
}

export function updateCompanyProfile(data: Record<string, unknown>): Promise<ApiResult<CompanyProfile>> {
  return apiRequest('/admin/company', { method: 'PATCH', body: data });
}

export function getCompanyBuses(): Promise<ApiResult<{ buses: CompanyBus[] }>> {
  return apiRequest<unknown>('/admin/company/buses').then((result) =>
    normalizeCollection<CompanyBus, 'buses'>(result, 'buses'),
  );
}

export function storeCompanyBus(data: {
  bus_number: string;
  registration_number: string;
  capacity: number;
  vehicle_type?: string;
}): Promise<ApiResult<{ bus: CompanyBus }>> {
  return apiRequest('/admin/company/buses', { method: 'POST', body: data });
}

export function updateCompanyBus(busId: number, data: Partial<CompanyBus>): Promise<ApiResult<{ bus: CompanyBus }>> {
  return apiRequest(`/admin/company/buses/${busId}`, { method: 'PATCH', body: data });
}

export function getLiveCompanyBuses(): Promise<ApiResult<{ buses: CompanyLiveBus[]; count?: number }>> {
  return apiRequest('/admin/company/buses/live');
}

export function getCompanyDrivers(): Promise<ApiResult<{ drivers: CompanyDriver[] }>> {
  return apiRequest<unknown>('/admin/company/drivers').then((result) =>
    mapApiData(normalizeCollection<Record<string, unknown>, 'drivers'>(result, 'drivers'), (data) => ({
      drivers: data.drivers.map((driver) => {
        const user = driver.user && typeof driver.user === 'object'
          ? driver.user as Record<string, unknown>
          : {};
        const assignment = driver.current_assignment && typeof driver.current_assignment === 'object'
          ? driver.current_assignment as Record<string, unknown>
          : {};
        const bus = assignment.bus && typeof assignment.bus === 'object'
          ? assignment.bus as Record<string, unknown>
          : {};
        return {
          id: Number(driver.id),
          name: String(user.name ?? driver.name ?? ''),
          license_number: String(driver.license_number ?? ''),
          phone: String(user.phone ?? driver.phone ?? ''),
          status: String(driver.status ?? user.status ?? ''),
          assigned_bus_id: typeof bus.id === 'number' ? bus.id : null,
          assigned_bus_number: typeof bus.bus_number === 'string' ? bus.bus_number : null,
        };
      }),
    })),
  );
}

export function storeCompanyDriver(data: {
  user_id: number;
  license_number: string;
}): Promise<ApiResult<{ driver: CompanyDriver }>> {
  return apiRequest('/admin/company/drivers', { method: 'POST', body: data });
}

export function getCompanyRoutes(): Promise<ApiResult<{ routes: CompanyRoute[] }>> {
  return apiRequest<unknown>('/admin/company/routes').then((result) =>
    normalizeCollection<CompanyRoute, 'routes'>(result, 'routes'),
  );
}

export function storeCompanyRoute(data: {
  code: string;
  name: string;
  origin_stop_id: number;
  destination_stop_id: number;
  distance_km: number;
  estimated_minutes: number;
}): Promise<ApiResult<{ route: CompanyRoute }>> {
  return apiRequest('/admin/company/routes', { method: 'POST', body: data });
}

export function getCompanyTrips(query: PlatformListQuery = {}): Promise<ApiResult<{ trips: CompanyTrip[] }>> {
  return apiRequest<unknown>(`/admin/company/trips${listQuery(query)}`).then((result) =>
    mapApiData(normalizeCollection<Record<string, unknown>, 'trips'>(result, 'trips'), (data) => ({
      trips: data.trips.map((trip) => {
        const revenue = trip.revenue && typeof trip.revenue === 'object'
          ? trip.revenue as Record<string, unknown>
          : null;
        const amountMinor = Number(revenue?.amount_minor ?? trip.revenue_minor ?? 0);
        const amount = String(revenue?.amount ?? (amountMinor / 100).toFixed(2));
        return {
          id: Number(trip.id),
          reference: String(trip.reference ?? ''),
          status: String(trip.status ?? ''),
          scheduled_departure: typeof trip.scheduled_departure === 'string' ? trip.scheduled_departure : null,
          started_at: typeof trip.started_at === 'string' ? trip.started_at : null,
          ended_at: typeof trip.ended_at === 'string' ? trip.ended_at : null,
          passenger_count: Number(trip.passenger_count ?? 0),
          revenue: {
            amount_minor: amountMinor,
            amount,
            currency: String(revenue?.currency ?? 'NPR'),
            formatted: String(revenue?.formatted ?? `Rs. ${amount}`),
          },
          bus: trip.bus && typeof trip.bus === 'object'
            ? trip.bus as CompanyTrip['bus']
            : null,
          route: trip.route && typeof trip.route === 'object'
            ? trip.route as CompanyTrip['route']
            : null,
          driver: trip.driver && typeof trip.driver === 'object'
            ? trip.driver as CompanyTrip['driver']
            : null,
        };
      }),
    })),
  );
}

export function getCompanyRevenue(dateRange?: PlatformDateRange): Promise<ApiResult<Record<string, unknown>>> {
  return apiRequest(`/admin/company/revenue${listQuery({
    dateFrom: dateRange?.date_from,
    dateTo: dateRange?.date_to,
  })}`);
}

export function getCompanyTaps(query: PlatformListQuery = {}): Promise<ApiResult<{ taps: CompanyTap[] }>> {
  return apiRequest<unknown>(`/admin/company/taps${listQuery(query)}`).then((result) =>
    normalizeCollection<CompanyTap, 'taps'>(result, 'taps'),
  );
}

export function getCompanyFares(): Promise<ApiResult<{ fares: Record<string, unknown>[] }>> {
  return apiRequest<unknown>('/admin/company/fares').then((result) =>
    normalizeCollection<Record<string, unknown>, 'fares'>(result, 'fares'),
  );
}

export function getCompanySettlements(): Promise<ApiResult<{ settlements: CompanySettlement[] }>> {
  return apiRequest<unknown>('/admin/company/settlements').then((result) =>
    mapApiData(normalizeCollection<Record<string, unknown>, 'settlements'>(result, 'settlements'), (data) => ({
      settlements: data.settlements.map((settlement) => {
        const resourcePeriod = settlement.period && typeof settlement.period === 'object'
          ? settlement.period as Record<string, unknown>
          : {};
        const money = (value: unknown): MoneySummary => {
          const item = value && typeof value === 'object' ? value as Record<string, unknown> : {};
          return {
            amount_minor: Number(item.amount_minor ?? 0),
            amount: String(item.amount ?? '0.00'),
            currency: String(item.currency ?? 'NPR'),
            formatted: String(item.formatted ?? `Rs. ${String(item.amount ?? '0.00')}`),
          };
        };
        const moneyFromMinor = (value: unknown): MoneySummary => {
          const minor = Number(value ?? 0);
          const amount = (minor / 100).toFixed(2);
          return {
            amount_minor: minor,
            amount,
            currency: 'NPR',
            formatted: `Rs. ${amount}`,
          };
        };
        const rawPeriodStart = String(settlement.period_start ?? '');
        const rawPeriodEnd = String(settlement.period_end ?? '');
        return {
          id: Number(settlement.id),
          period: {
            start: String(resourcePeriod.start ?? rawPeriodStart),
            end: String(resourcePeriod.end ?? rawPeriodEnd),
          },
          tap_count: Number(settlement.tap_count ?? 0),
          gross_fares: settlement.gross_fares !== undefined
            ? money(settlement.gross_fares)
            : moneyFromMinor(settlement.gross_fare_minor),
          refunds: settlement.refunds !== undefined
            ? money(settlement.refunds)
            : moneyFromMinor(settlement.refund_minor),
          net: settlement.net !== undefined
            ? money(settlement.net)
            : moneyFromMinor(settlement.net_minor),
          status: String(settlement.status ?? ''),
          closed_at: typeof settlement.closed_at === 'string' ? settlement.closed_at : null,
          generated_at: typeof settlement.generated_at === 'string' ? settlement.generated_at : null,
        };
      }),
    })),
  );
}

export function storeCompanyTrip(data: {
  bus_id: number;
  route_id: number;
  driver_id: number;
  direction?: string;
  scheduled_departure: string;
}): Promise<ApiResult<{ trip: CompanyTrip }>> {
  return apiRequest('/admin/company/trips', { method: 'POST', body: data });
}

export function cancelCompanyTrip(tripId: number): Promise<ApiResult<{ trip: CompanyTrip }>> {
  return apiRequest(`/admin/company/trips/${tripId}/cancel`, { method: 'POST', body: {} });
}

export function updateCompanyDriverStatus(
  driverId: number,
  status: 'active' | 'suspended' | 'inactive',
): Promise<ApiResult<{ driver: CompanyDriver }>> {
  return apiRequest(`/admin/company/drivers/${driverId}/status`, { method: 'PATCH', body: { status } });
}

export type CompanyAssignment = {
  id: number;
  bus_id: number;
  driver_id: number;
  role: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  bus?: { id: number; bus_number: string; registration_number: string; status: string } | null;
  driver?: { id: number; user?: { id: number; name: string; phone?: string; status?: string } | null } | null;
};

export function getCompanyAssignments(query: PlatformListQuery = {}): Promise<ApiResult<{ assignments: CompanyAssignment[] }>> {
  return apiRequest<unknown>(`/admin/company/assignments${listQuery(query)}`).then((result) =>
    normalizeCollection<CompanyAssignment, 'assignments'>(result, 'assignments'),
  );
}

export function storeCompanyAssignment(data: {
  bus_id: number;
  driver_id: number;
  role?: 'primary' | 'relief';
}): Promise<ApiResult<{ assignment: CompanyAssignment }>> {
  return apiRequest('/admin/company/assignments', { method: 'POST', body: data });
}

export type CompanyNotification = {
  id: string;
  type: 'warning' | 'info' | 'error';
  title: string;
  message: string;
  created_at: string;
  action?: string;
};

export function getCompanyNotifications(): Promise<ApiResult<{ notifications: CompanyNotification[]; unread_count: number }>> {
  return apiRequest('/admin/company/notifications');
}

export type CompanyReportsData = {
  period: { from: string; to: string };
  fleet: CompanyDashboardData['fleet'];
  trips: CompanyDashboardData['trips'];
  taps: CompanyDashboardData['taps'];
  routes: {
    route_id: number;
    route_name: string;
    route_code: string;
    trips_count: number;
    passengers: number;
    revenue: MoneySummary;
  }[];
  drivers: {
    driver_id: number;
    driver_name: string;
    trips_count: number;
    completed_count: number;
    passengers: number;
  }[];
  revenue_series: Record<string, unknown>[];
};

export function getCompanyReports(dateRange?: PlatformDateRange): Promise<ApiResult<CompanyReportsData>> {
  return apiRequest(`/admin/company/reports/summary${listQuery({
    dateFrom: dateRange?.date_from,
    dateTo: dateRange?.date_to,
  })}`);
}

export type CompanyDriverReport = {
  id: number;
  type: 'inspection' | 'incident' | 'vehicle_issue' | 'route_disruption';
  category: string | null;
  description: string | null;
  checklist: Record<string, boolean> | null;
  odometer_km: string | number | null;
  status: 'submitted' | 'acknowledged' | 'resolved';
  driver_name: string | null;
  bus_number: string | null;
  trip_reference: string | null;
  created_at: string | null;
};

export function getCompanyDriverReports(query: PlatformListQuery = {}): Promise<ApiResult<{ reports: CompanyDriverReport[] }>> {
  return apiRequest<unknown>(`/admin/company/driver-reports${listQuery(query)}`).then((result) =>
    normalizeCollection<CompanyDriverReport, 'reports'>(result, 'reports'),
  );
}

export function updateCompanyDriverReportStatus(
  reportId: number,
  status: 'acknowledged' | 'resolved',
): Promise<ApiResult<{ report: CompanyDriverReport }>> {
  return apiRequest(`/admin/company/driver-reports/${reportId}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

export type CompanyMaintenanceRecord = {
  id: number;
  bus_id: number;
  bus_number: string | null;
  title: string;
  details: string | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  scheduled_at: string;
  completed_at: string | null;
  next_due_at: string | null;
  cost_minor: number | null;
  odometer_km: string | number | null;
};

export type CompanyFuelExpense = {
  id: number;
  bus_id: number;
  bus_number: string | null;
  amount_minor: number;
  liters: string | number;
  odometer_km: string | number;
  station: string | null;
  reference: string | null;
  occurred_at: string;
};

export function getCompanyMaintenance(): Promise<ApiResult<{ vehicle_maintenance_records: CompanyMaintenanceRecord[] }>> {
  return apiRequest<unknown>('/admin/company/maintenance?per_page=100').then((result) =>
    normalizeCollection<CompanyMaintenanceRecord, 'vehicle_maintenance_records'>(result, 'vehicle_maintenance_records'),
  );
}

export function createCompanyMaintenance(data: {
  bus_id: number;
  title: string;
  details?: string;
  scheduled_at: string;
  next_due_at?: string;
  cost_minor?: number;
  odometer_km?: number;
}): Promise<ApiResult<{ maintenance: CompanyMaintenanceRecord }>> {
  return apiRequest('/admin/company/maintenance', { method: 'POST', body: data });
}

export function updateCompanyMaintenance(
  id: number,
  data: { status: 'in_progress' | 'completed' | 'cancelled'; cost_minor?: number; odometer_km?: number },
): Promise<ApiResult<{ maintenance: CompanyMaintenanceRecord }>> {
  return apiRequest(`/admin/company/maintenance/${id}`, { method: 'PATCH', body: data });
}

export function getCompanyFuelExpenses(): Promise<ApiResult<{ vehicle_fuel_expenses: CompanyFuelExpense[] }>> {
  return apiRequest<unknown>('/admin/company/fuel-expenses?per_page=100').then((result) =>
    normalizeCollection<CompanyFuelExpense, 'vehicle_fuel_expenses'>(result, 'vehicle_fuel_expenses'),
  );
}

export function createCompanyFuelExpense(data: {
  bus_id: number;
  amount_minor: number;
  liters: number;
  odometer_km: number;
  station?: string;
  reference?: string;
  occurred_at: string;
}): Promise<ApiResult<{ expense: CompanyFuelExpense }>> {
  return apiRequest('/admin/company/fuel-expenses', { method: 'POST', body: data });
}

export type CompanyServiceNotice = {
  id: number;
  title: string;
  message: string;
  severity: 'information' | 'delay' | 'disruption' | 'closure';
  status: 'published' | 'resolved';
  starts_at: string;
  ends_at: string | null;
  route: { id: number; name: string } | null;
  stop: { id: number; name: string } | null;
};

export function getCompanyServiceNotices(): Promise<ApiResult<{ notices: CompanyServiceNotice[] }>> {
  return apiRequest<unknown>('/admin/company/notices').then((result) =>
    normalizeCollection<CompanyServiceNotice, 'notices'>(result, 'notices'),
  );
}

export function publishCompanyServiceNotice(data: {
  route_id?: number | null;
  stop_id?: number | null;
  title: string;
  message: string;
  severity: CompanyServiceNotice['severity'];
  starts_at: string;
  ends_at?: string | null;
}): Promise<ApiResult<{ notice: CompanyServiceNotice }>> {
  return apiRequest('/admin/company/notices', { method: 'POST', body: data });
}

export function resolveCompanyServiceNotice(noticeId: number): Promise<ApiResult<{ notice: CompanyServiceNotice }>> {
  return apiRequest(`/admin/company/notices/${noticeId}/resolve`, { method: 'PATCH', body: {} });
}

export function storeCompanyFareRule(data: {
  name: string;
  type: string;
  amount_minor?: number;
  base_amount_minor?: number;
  per_km_minor?: number;
  route_id?: number | null;
  priority?: number;
}): Promise<ApiResult<{ id: number; uuid: string }>> {
  return apiRequest('/admin/company/fares', { method: 'POST', body: data });
}

export function activateCompanyFareRule(fareRuleId: number): Promise<ApiResult<Record<string, unknown>>> {
  return apiRequest(`/admin/company/fares/${fareRuleId}/activate`, { method: 'POST', body: {} });
}

export function deleteCompanyFareRule(fareRuleId: number): Promise<ApiResult<unknown>> {
  return apiRequest(`/admin/company/fares/${fareRuleId}`, { method: 'DELETE' });
}
