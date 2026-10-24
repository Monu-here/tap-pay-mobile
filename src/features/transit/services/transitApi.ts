import {
  apiRequest,
  mapApiData,
  normalizeCollection,
  type ApiResult,
} from '@/features/auth/services/apiClient';

export type PublicStop = {
  id: number;
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  distance_km?: number;
};

export type PublicNearbyBus = {
  bus_id: number;
  bus_number: string;
  latitude: number;
  longitude: number;
  distance_km?: number;
  speed: number | null;
  last_seen_at: string | null;
  status: string | null;
  route: { id: number | null; name: string | null; destination: string | null };
  company: { id: number | null; name: string | null; code: string | null };
};

export type TransportCompanyItem = {
  id: number;
  name: string;
  code: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  status: string;
  active_buses_count?: number;
  active_routes_count?: number;
};

export type ServiceNoticeItem = {
  id: number;
  title: string;
  message: string;
  severity: 'information' | 'delay' | 'disruption' | 'closure';
  starts_at: string;
  ends_at: string | null;
  company: { id: number; name: string } | null;
  route: { id: number; name: string } | null;
  stop: { id: number; name: string } | null;
};

export function getServiceNotices(): Promise<ApiResult<{ notices: ServiceNoticeItem[] }>> {
  return apiRequest<unknown>('/service-notices').then((result) =>
    normalizeCollection<ServiceNoticeItem, 'notices'>(result, 'notices'),
  );
}

export function getNearbyStops(latitude: number, longitude: number, radius = 2000): Promise<ApiResult<{ stops: PublicStop[] }>> {
  const radiusKm = radius > 25 ? radius / 1000 : radius;
  return apiRequest<unknown>(
    `/stops/nearby?lat=${latitude}&lng=${longitude}&radius_km=${radiusKm}`,
    { skipAuthError: true },
  ).then((result) => normalizeCollection<PublicStop, 'stops'>(result, 'stops'));
}

export function searchStops(query: string): Promise<ApiResult<{ stops: PublicStop[] }>> {
  return apiRequest<unknown>(`/stops/search?q=${encodeURIComponent(query)}`, { skipAuthError: true })
    .then((result) => normalizeCollection<PublicStop, 'stops'>(result, 'stops'));
}

export function getNearbyBuses(latitude: number, longitude: number, radiusKm = 5): Promise<ApiResult<{ buses: PublicNearbyBus[] }>> {
  return apiRequest<unknown>(
    `/buses/nearby?lat=${latitude}&lng=${longitude}&radius_km=${radiusKm}`,
    { skipAuthError: true },
  ).then((result) =>
    mapApiData(normalizeCollection<Record<string, unknown>, 'buses'>(result, 'buses'), (data) => ({
      buses: data.buses.map((bus) => {
        const route = bus.route && typeof bus.route === 'object'
          ? bus.route as Record<string, unknown>
          : {};
        const companyData = bus.transport_company ?? bus.company;
        const company = companyData && typeof companyData === 'object'
          ? companyData as Record<string, unknown>
          : {};
        return {
          bus_id: Number(bus.bus_id),
          bus_number: String(bus.bus_number ?? ''),
          latitude: Number(bus.latitude),
          longitude: Number(bus.longitude),
          distance_km: typeof bus.distance_km === 'number' ? bus.distance_km : undefined,
          speed: typeof bus.speed === 'number' ? bus.speed : null,
          last_seen_at: typeof bus.last_seen_at === 'string' ? bus.last_seen_at : null,
          status: typeof bus.status === 'string' ? bus.status : null,
          route: {
            id: typeof route.id === 'number' ? route.id : null,
            name: typeof route.name === 'string' ? route.name : null,
            destination: typeof route.destination === 'string' ? route.destination : null,
          },
          company: {
            id: typeof company.id === 'number' ? company.id : null,
            name: typeof company.name === 'string' ? company.name : null,
            code: typeof company.code === 'string' ? company.code : null,
          },
        };
      }),
    })),
  );
}

export function getPublicCompanies(): Promise<ApiResult<{ companies: TransportCompanyItem[] }>> {
  return apiRequest<unknown>('/companies', { skipAuthError: true }).then((result) =>
    mapApiData(normalizeCollection<Record<string, unknown>, 'companies'>(result, 'companies'), (data) => ({
      companies: data.companies.map((company) => {
        const contact = company.contact && typeof company.contact === 'object'
          ? company.contact as Record<string, unknown>
          : {};
        return {
          id: Number(company.id),
          name: String(company.name ?? ''),
          code: String(company.code ?? ''),
          email: typeof contact.email === 'string' ? contact.email : null,
          phone: typeof contact.phone === 'string' ? contact.phone : null,
          address: typeof contact.address === 'string' ? contact.address : null,
          status: String(company.status ?? ''),
          active_buses_count: typeof company.bus_count === 'number' ? company.bus_count : undefined,
          active_routes_count: typeof company.route_count === 'number' ? company.route_count : undefined,
        };
      }),
    })),
  );
}

export function getPublicCompany(id: number): Promise<ApiResult<TransportCompanyItem>> {
  return apiRequest(`/companies/${id}`, { skipAuthError: true });
}
