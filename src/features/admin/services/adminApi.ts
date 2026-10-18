import {
  apiRequest,
  mapApiData,
  normalizeCollection,
  type ApiResult,
} from '@/features/auth/services/apiClient';

// ---------------------------------------------------------------------------
// Super-Admin Platform Types & APIs (/platform/*)
// ---------------------------------------------------------------------------

export type PlatformDashboardData = {
  companies_count: number;
  active_companies: number;
  total_users: number;
  total_passengers: number;
  total_buses: number;
  total_cards: number;
  daily_volume_minor: number;
  daily_volume_formatted?: string;
  monthly_volume_minor: number;
  monthly_volume_formatted?: string;
  system_health?: string;
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

export type AuditLogEntry = {
  id: number;
  action: string;
  action_label?: string;
  user_name?: string;
  user_email?: string;
  ip_address?: string;
  severity?: string;
  details?: Record<string, unknown>;
  created_at: string;
};

export type PlatformSettings = {
  currency: string;
  policy: Record<string, unknown>;
  verification: Record<string, unknown>;
  gateways: Record<string, unknown>;
};

export function getPlatformDashboard(): Promise<ApiResult<PlatformDashboardData>> {
  return apiRequest('/platform/dashboard');
}

export function getPlatformCompanies(page = 1): Promise<ApiResult<{ companies: PlatformCompany[]; meta?: Record<string, unknown> }>> {
  return apiRequest<unknown>(`/platform/companies?page=${page}`).then((result) =>
    mapApiData(normalizeCollection<Record<string, unknown>, 'companies'>(result, 'companies'), (data) => ({
      companies: data.companies.map((company) => ({
        id: Number(company.id),
        name: String(company.name ?? ''),
        code: String(company.code ?? ''),
        email: String(company.contact_email ?? company.email ?? ''),
        phone: String(company.contact_phone ?? company.phone ?? ''),
        status: String(company.status ?? ''),
        address: typeof company.address === 'string' ? company.address : undefined,
        buses_count: typeof company.buses_count === 'number' ? company.buses_count : undefined,
        drivers_count: typeof company.drivers_count === 'number' ? company.drivers_count : undefined,
        created_at: String(company.created_at ?? ''),
      })),
    })),
  );
}

export function createPlatformCompany(data: {
  name: string;
  code: string;
  email: string;
  phone: string;
  address?: string;
}): Promise<ApiResult<{ company: PlatformCompany }>> {
  return apiRequest('/platform/companies', { method: 'POST', body: data });
}

export function getPlatformCompany(companyId: number): Promise<ApiResult<{ company: PlatformCompany }>> {
  return apiRequest(`/platform/companies/${companyId}`);
}

export function updatePlatformCompany(companyId: number, data: Partial<PlatformCompany>): Promise<ApiResult<{ company: PlatformCompany }>> {
  return apiRequest(`/platform/companies/${companyId}`, { method: 'PATCH', body: data });
}

export function changeCompanyStatus(companyId: number, status: 'active' | 'suspended' | 'pending'): Promise<ApiResult<unknown>> {
  return apiRequest(`/platform/companies/${companyId}/status`, { method: 'POST', body: { status } });
}

export function getCompanyStaff(companyId: number): Promise<ApiResult<{ staff: PlatformUser[] }>> {
  return apiRequest(`/platform/companies/${companyId}/staff`);
}

export function inviteCompanyStaff(companyId: number, data: { name: string; email: string; role: string }): Promise<ApiResult<unknown>> {
  return apiRequest(`/platform/companies/${companyId}/staff`, { method: 'POST', body: data });
}

export function revokeCompanyStaff(companyId: number, userId: number): Promise<ApiResult<unknown>> {
  return apiRequest(`/platform/companies/${companyId}/staff/${userId}`, { method: 'DELETE' });
}

export function getPlatformUsers(page = 1, search = ''): Promise<ApiResult<{ users: PlatformUser[]; meta?: Record<string, unknown> }>> {
  const query = search ? `&search=${encodeURIComponent(search)}` : '';
  return apiRequest<unknown>(`/platform/users?page=${page}${query}`).then((result) =>
    normalizeCollection<PlatformUser, 'users'>(result, 'users'),
  );
}

export function suspendPlatformUser(userId: number, reason = 'Administrative suspension'): Promise<ApiResult<unknown>> {
  return apiRequest(`/platform/users/${userId}/suspend`, { method: 'POST', body: { reason } });
}

export function reinstatePlatformUser(userId: number): Promise<ApiResult<unknown>> {
  return apiRequest(`/platform/users/${userId}/reinstate`, { method: 'POST', body: {} });
}

export function getPlatformAuditLogs(page = 1): Promise<ApiResult<{ logs: AuditLogEntry[]; meta?: Record<string, unknown> }>> {
  return apiRequest(`/platform/audit-logs?page=${page}`);
}

export function getPlatformSettings(): Promise<ApiResult<PlatformSettings>> {
  return apiRequest('/platform/settings');
}

// ---------------------------------------------------------------------------
// Transport Company Administration APIs (/admin/*)
// ---------------------------------------------------------------------------

export type CompanyDashboardData = {
  total_buses: number;
  active_buses: number;
  total_drivers: number;
  total_routes: number;
  today_trips: number;
  today_revenue_minor: number;
  today_revenue_formatted?: string;
  today_taps_count: number;
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
  period_start: string;
  period_end: string;
  gross_amount_minor: number;
  net_amount_minor: number;
  commission_minor: number;
  status: string;
  reference: string;
};

export function getCompanyDashboard(): Promise<ApiResult<CompanyDashboardData>> {
  return apiRequest('/admin/dashboard');
}

export function getCompanyProfile(): Promise<ApiResult<{ company: PlatformCompany }>> {
  return apiRequest('/admin/company');
}

export function updateCompanyProfile(data: Record<string, unknown>): Promise<ApiResult<{ company: PlatformCompany }>> {
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

export function getLiveCompanyBuses(): Promise<ApiResult<{ buses: (CompanyBus & { latitude?: number; longitude?: number; speed_kmh?: number })[] }>> {
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
  name: string;
  license_number: string;
  phone: string;
  email?: string;
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

export function getCompanyTrips(page = 1): Promise<ApiResult<{ trips: Record<string, unknown>[]; meta?: Record<string, unknown> }>> {
  return apiRequest<unknown>(`/admin/company/trips?page=${page}`).then((result) =>
    normalizeCollection<Record<string, unknown>, 'trips'>(result, 'trips'),
  );
}

export function getCompanyRevenue(): Promise<ApiResult<Record<string, unknown>>> {
  return apiRequest('/admin/company/revenue');
}

export function getCompanyTaps(page = 1): Promise<ApiResult<{ taps: Record<string, unknown>[]; meta?: Record<string, unknown> }>> {
  return apiRequest<unknown>(`/admin/company/taps?page=${page}`).then((result) =>
    normalizeCollection<Record<string, unknown>, 'taps'>(result, 'taps'),
  );
}

export function getCompanyFares(): Promise<ApiResult<{ fares: Record<string, unknown>[] }>> {
  return apiRequest<unknown>('/admin/company/fares').then((result) =>
    normalizeCollection<Record<string, unknown>, 'fares'>(result, 'fares'),
  );
}

export function getCompanySettlements(): Promise<ApiResult<{ settlements: CompanySettlement[] }>> {
  return apiRequest<unknown>('/admin/company/settlements').then((result) =>
    normalizeCollection<CompanySettlement, 'settlements'>(result, 'settlements'),
  );
}
