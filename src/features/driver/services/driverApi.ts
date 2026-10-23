import {
  apiRequest,
  mapApiData,
  normalizeCollection,
  type ApiResult,
} from '@/features/auth/services/apiClient';

export type DriverBusInfo = {
  id: number;
  bus_number: string;
  registration_number: string;
  capacity: number;
  status: string;
  company_name?: string;
};

export type DriverTripInfo = {
  id: number;
  trip_uid?: string;
  route_id: number;
  route_name?: string;
  route_code?: string;
  bus_id: number;
  bus_number?: string;
  status: string; // 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  started_at?: string | null;
  ended_at?: string | null;
  passengers_boarded?: number;
  current_stop_sequence?: number | null;
};

export type DriverAssignment = {
  id: number;
  bus_id: number;
  bus_number: string;
  route_id?: number;
  route_name?: string;
  shift_date: string;
  status: string;
};

export function getDriverProfile(): Promise<ApiResult<Record<string, unknown>>> {
  return apiRequest('/driver/profile');
}

export function getDriverAssignments(): Promise<ApiResult<{ assignments: DriverAssignment[] }>> {
  return apiRequest<unknown>('/driver/assignments').then((result) =>
    mapApiData(normalizeCollection<Record<string, unknown>, 'assignments'>(result, 'assignments'), (data) => ({
      assignments: data.assignments.map((item) => {
        const bus = relation(item.bus, 'bus');
        return {
          id: Number(item.id),
          bus_id: Number(item.bus_id ?? bus.id ?? 0),
          bus_number: String(bus.bus_number ?? item.bus_number ?? ''),
          shift_date: String(item.starts_at ?? ''),
          status: String(item.status ?? ''),
        };
      }),
    })),
  );
}

export function getCurrentDriverBus(): Promise<ApiResult<{ bus: DriverBusInfo | null }>> {
  return apiRequest<unknown>('/driver/bus/current').then((result) => {
    if (!result.ok) return result;
    if (result.data === null) return { ...result, data: { bus: null } };
    const data = result.data && typeof result.data === 'object' && !Array.isArray(result.data)
      ? result.data as Record<string, unknown>
      : null;
    const bus = data && 'bus' in data ? data.bus : result.data;
    return bus && typeof bus === 'object' && !Array.isArray(bus)
      ? { ...result, data: { bus: bus as DriverBusInfo } }
      : {
          ok: false as const,
          status: 502,
          kind: 'http' as const,
          message: 'The server returned an unexpected assigned-bus response.',
          data: null,
        };
  });
}

export function getDriverTrips(): Promise<ApiResult<{ trips: DriverTripInfo[] }>> {
  return apiRequest<unknown>('/driver/trips').then((result) =>
    mapApiData(normalizeCollection<Record<string, unknown>, 'trips'>(result, 'trips'), (data) => ({
      trips: data.trips.map((item) => {
        const route = relation(item.route, 'route');
        const bus = relation(item.bus, 'bus');
        return {
          id: Number(item.id),
          trip_uid: typeof item.trip_uid === 'string' ? item.trip_uid : undefined,
          route_id: Number(item.route_id ?? route.id ?? 0),
          route_name: typeof route.name === 'string' ? route.name : undefined,
          route_code: typeof route.code === 'string' ? route.code : undefined,
          bus_id: Number(item.bus_id ?? bus.id ?? 0),
          bus_number: typeof bus.bus_number === 'string' ? bus.bus_number : undefined,
          status: String(item.status ?? ''),
          started_at: typeof item.started_at === 'string' ? item.started_at : null,
          ended_at: typeof item.ended_at === 'string' ? item.ended_at : null,
          current_stop_sequence: typeof item.current_stop_sequence === 'number'
            ? item.current_stop_sequence
            : null,
        };
      }),
    })),
  );
}

export function startTrip(tripId: number): Promise<ApiResult<{ trip: DriverTripInfo }>> {
  return apiRequest<unknown>(`/driver/trips/${tripId}/start`, { method: 'POST', body: {} })
    .then((result) => wrapResource<DriverTripInfo, 'trip'>(result, 'trip'));
}

export function updateTripProgress(tripId: number, data: { stop_sequence?: number }): Promise<ApiResult<{ trip: DriverTripInfo }>> {
  return apiRequest(`/driver/trips/${tripId}/progress`, { method: 'POST', body: data });
}

export function endTrip(tripId: number): Promise<ApiResult<{ trip: DriverTripInfo }>> {
  return apiRequest<unknown>(`/driver/trips/${tripId}/end`, { method: 'POST', body: {} })
    .then((result) => wrapResource<DriverTripInfo, 'trip'>(result, 'trip'));
}

export type DriverTripQr = {
  qr_payload: string;
  expires_in_seconds: number;
  trip_reference: string;
  bus_number: string | null;
  route_name: string | null;
  refreshed_at: string;
};

export function getActiveTripQr(): Promise<ApiResult<DriverTripQr>> {
  return apiRequest<DriverTripQr>('/driver/trips/active/qr');
}

export function reportDriverLocation(
  latitude: number,
  longitude: number,
  speed?: number,
  heading?: number,
  accuracy?: number,
): Promise<ApiResult<unknown>> {
  console.log('Reporting driver location:', { latitude, longitude, speed, heading, accuracy }); 
  return apiRequest('/driver/location', {
    method: 'POST',
    body: {
      latitude,
      longitude,
      ...(speed !== undefined ? { speed } : {}),
      ...(heading !== undefined ? { heading } : {}),
      ...(accuracy !== undefined ? { accuracy } : {}),
    },
  });
}

export type DriverTicket = {
  id: number;
  ticket_number: string;
  passenger_name: string;
  card_uid?: string;
  card_masked?: string;
  bus_number: string;
  route_name: string;
  fare_minor: number;
  fare_formatted: string;
  tapped_at?: string;
  status: string;
};

export type CollectPaymentResult = {
  ticket: {
    ticket_number: string;
    travel_uid: string;
    passenger_name: string;
    bus_number?: string;
    fare_minor: number;
    fare_formatted: string;
    balance_remaining_formatted?: string;
    issued_at: string;
    status: string;
    tap_reference: string;
  };
};

export function collectDriverPayment(data: {
  qr_payload?: string;
  card_uid?: string;
  card_code?: string;
  stop_sequence?: number;
}): Promise<ApiResult<CollectPaymentResult>> {
  return apiRequest('/driver/payments/collect', {
    method: 'POST',
    body: data,
  });
}

export function getDriverTickets(): Promise<ApiResult<{ tickets: DriverTicket[] }>> {
  return apiRequest('/driver/tickets');
}

export type DriverOperationalReport = {
  id: number;
  type: 'inspection' | 'incident' | 'vehicle_issue' | 'route_disruption';
  category: string | null;
  description: string | null;
  checklist: Record<string, boolean> | null;
  odometer_km: string | number | null;
  status: 'submitted' | 'acknowledged' | 'resolved';
  bus_number: string | null;
  trip_reference: string | null;
  created_at: string | null;
};

export type DriverOperationalReportPayload = {
  type: DriverOperationalReport['type'];
  category?: string;
  description?: string;
  checklist?: Record<string, boolean>;
  odometer_km?: number;
};

export function getDriverOperationalReports(): Promise<ApiResult<{ reports: DriverOperationalReport[] }>> {
  return apiRequest('/driver/reports');
}

export function createDriverOperationalReport(
  payload: DriverOperationalReportPayload,
): Promise<ApiResult<{ report: DriverOperationalReport }>> {
  return apiRequest('/driver/reports', { method: 'POST', body: payload });
}

export type DriverFuelExpense = {
  id: number;
  bus_number: string | null;
  amount_minor: number;
  liters: string | number;
  odometer_km: string | number;
  station: string | null;
  occurred_at: string;
};

export function getDriverFuelExpenses(): Promise<ApiResult<{ expenses: DriverFuelExpense[] }>> {
  return apiRequest<unknown>('/driver/fuel-expenses').then((result) =>
    normalizeCollection<DriverFuelExpense, 'expenses'>(result, 'expenses'),
  );
}

export function createDriverFuelExpense(data: {
  amount_minor: number;
  liters: number;
  odometer_km: number;
  station?: string;
  occurred_at: string;
}): Promise<ApiResult<{ expense: DriverFuelExpense }>> {
  return apiRequest('/driver/fuel-expenses', { method: 'POST', body: data });
}

export type DriverRouteStop = {
  id: number;
  name: string;
  sequence: number;
  latitude?: number;
  longitude?: number;
};

export type DriverRouteInfo = {
  bus: {
    id: number;
    bus_number: string;
    registration_number: string;
  };
  route: {
    id: number;
    name: string;
    code?: string;
    stops: DriverRouteStop[];
  };
};

export function getDriverRoute(): Promise<ApiResult<DriverRouteInfo | null>> {
  return apiRequest<DriverRouteInfo | null>('/driver/route');
}

function wrapResource<T, K extends string>(result: ApiResult<unknown>, key: K): ApiResult<{ [P in K]: T }> {
  if (!result.ok) return result;
  if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data)) {
    return {
      ok: false,
      status: 502,
      kind: 'http',
      message: `The server returned an unexpected ${key} response.`,
      data: null,
    };
  }
  const data = result.data as Record<string, unknown>;
  const resource = key in data ? data[key] : data;
  if (!resource || typeof resource !== 'object' || Array.isArray(resource)) {
    return {
      ok: false,
      status: 502,
      kind: 'http',
      message: `The server returned an unexpected ${key} response.`,
      data: null,
    };
  }
  return { ...result, data: { [key]: resource as T } as { [P in K]: T } };
}

/**
 * Read a relation off a payload.
 *
 * The API returns a relation as a plain nested object (`bus: { id }`). Older
 * builds wrapped it one level deeper (`bus: { bus: { id } }`), so the wrapper is
 * unwrapped when present. Without this, `bus.id` resolves to `undefined`,
 * `Number(undefined)` becomes `NaN`, and every trip silently fails to match
 * the driver's assigned bus.
 */
function relation(value: unknown, key: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const nested = record[key];
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return record;
}
