/**
 * Passenger API service — all authenticated endpoints for the passenger role.
 *
 * Every function calls through the shared `apiRequest` client, so token
 * injection, 401 handling, timeout, and 429 retry are inherited.
 */

import {
  apiRequest,
  createIdempotencyKey,
  mapApiData,
  normalizeCollection,
  type ApiResult,
} from '@/features/auth/services/apiClient';

// ---------------------------------------------------------------------------
// Types — mirror the backend resource shapes
// ---------------------------------------------------------------------------

export type WalletSummary = {
  id: number | null;
  balance_minor: number;
  balance_formatted: string;
  currency: string;
  status: string;
};

export type CardSummary = {
  id: number;
  uid: string;
  label: string | null;
  status: string;
  type: string;
  last_four: string | null;
};

export type WalletTransaction = {
  id: number;
  reference: string;
  type: string;
  direction: string;
  amount_minor: number;
  balance_before: number;
  balance_after: number;
  status: string;
  currency: string;
  description: string | null;
  created_at: string;
};

export type TravelRecord = {
  id: number;
  travel_uid: string;
  route_name: string | null;
  bus_number: string | null;
  boarding_stop: string | null;
  exit_stop: string | null;
  fare_minor: number;
  fare_formatted: string | null;
  status: string;
  boarded_at: string | null;
  exited_at: string | null;
  company_name: string | null;
};

export type DashboardStats = {
  total_trips: number;
  monthly_spent_minor: number;
  monthly_spent_formatted: string;
  active_cards_count: number;
};

export type DashboardData = {
  user: Record<string, unknown>;
  wallet: WalletSummary;
  primary_card: CardSummary | null;
  recent_transactions: WalletTransaction[];
  recent_trips: TravelRecord[];
  stats: DashboardStats;
};

export type RouteInfo = {
  id: number;
  code: string;
  name: string;
  origin_stop: string | null;
  destination_stop: string | null;
  distance_km: number | null;
  estimated_minutes: number | null;
  company_name: string | null;
};

export type StopInfo = {
  id: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
  sequence: number;
};

export type NotificationItem = {
  id: string;
  type: string;
  title: string | null;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

export type PaymentGateway = {
  slug: string;
  name: string;
  enabled: true;
  min_amount_minor?: number;
  max_amount_minor?: number;
  currency?: string;
};

export type PaymentRecord = {
  id: number;
  reference: string;
  amount_minor: number;
  status: string;
  gateway: string | null;
  created_at: string;
};

export type PaymentCheckout = {
  gateway: string;
  checkout?: {
    url?: string;
    method?: string;
    fields?: Record<string, string>;
  };
  extra?: {
    token?: string;
  };
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function getDashboard(): Promise<ApiResult<DashboardData>> {
  return apiRequest<DashboardData>('/passenger/dashboard');
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export function getCards(): Promise<ApiResult<{ cards: CardSummary[] }>> {
  return apiRequest<unknown>('/cards').then((result) => normalizeCollection<CardSummary, 'cards'>(result, 'cards'));
}

export function getCard(cardId: number): Promise<ApiResult<{ card: CardSummary }>> {
  return apiRequest<{ card: CardSummary }>(`/cards/${cardId}`);
}

export function registerCard(uid: string, label?: string): Promise<ApiResult<{ card: CardSummary }>> {
  return apiRequest<{ card: CardSummary }>('/cards', {
    method: 'POST',
    body: { uid, label },
  });
}

export function activateCard(cardId: number): Promise<ApiResult<{ card: CardSummary }>> {
  return apiRequest<{ card: CardSummary }>(`/cards/${cardId}/activate`, { method: 'POST', body: {} });
}

export function deactivateCard(cardId: number): Promise<ApiResult<{ card: CardSummary }>> {
  return apiRequest<{ card: CardSummary }>(`/cards/${cardId}/deactivate`, { method: 'POST', body: {} });
}

export function blockCard(cardId: number): Promise<ApiResult<{ card: CardSummary }>> {
  return apiRequest<{ card: CardSummary }>(`/cards/${cardId}/block`, { method: 'POST', body: {} });
}

export function reportLostCard(cardId: number): Promise<ApiResult<{ card: CardSummary }>> {
  return apiRequest<{ card: CardSummary }>(`/cards/${cardId}/report-lost`, { method: 'POST', body: {} });
}

// ---------------------------------------------------------------------------
// Wallet / Transactions
// ---------------------------------------------------------------------------

export function getWalletTransactions(page = 1): Promise<ApiResult<{ transactions: WalletTransaction[]; meta?: Record<string, unknown> }>> {
  return apiRequest(`/wallet/transactions?page=${page}`);
}

export function getWalletTransaction(reference: string): Promise<ApiResult<{ transaction: WalletTransaction }>> {
  return apiRequest(`/wallet/transactions/${encodeURIComponent(reference)}`);
}

// ---------------------------------------------------------------------------
// Travel history
// ---------------------------------------------------------------------------

export function getTravelHistory(page = 1): Promise<ApiResult<{ travel_records: TravelRecord[]; meta?: Record<string, unknown> }>> {
  return apiRequest<unknown>(`/travel-history?page=${page}`).then((result) => {
    if (!result.ok) return result;
    const data = result.data;
    if (Array.isArray(data)) {
      return { ...result, data: { travel_records: data } };
    }
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const record = data as Record<string, unknown>;
      if (Array.isArray(record.travel_history)) {
        return { ...result, data: { travel_records: record.travel_history } };
      }
      if (Array.isArray(record.travel_records)) {
        return { ...result, data: record as { travel_records: TravelRecord[] } };
      }
    }
    return normalizeCollection<TravelRecord, 'travel_records'>(result, 'travel_records');
  });
}

export function getTravelRecord(travelUid: string): Promise<ApiResult<{ travel_record: TravelRecord }>> {
  return apiRequest(`/travel-history/${encodeURIComponent(travelUid)}`);
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export function getPayments(page = 1): Promise<ApiResult<{ payments: PaymentRecord[]; meta?: Record<string, unknown> }>> {
  return apiRequest(`/payments?page=${page}`);
}

export function getPaymentGateways(): Promise<ApiResult<{ gateways: PaymentGateway[] }>> {
  return apiRequest<{ gateways: Record<string, unknown>[] }>('/payments/gateways').then((result) => {
    if (!result.ok) return result;
    return mapApiData(result, (data) => ({
      gateways: data.gateways.map((gateway) => ({
        slug: String(gateway.gateway ?? ''),
        name: String(gateway.label ?? gateway.gateway ?? ''),
        enabled: true as const,
        min_amount_minor: typeof gateway.min_amount_minor === 'number' ? gateway.min_amount_minor : undefined,
        max_amount_minor: typeof gateway.max_amount_minor === 'number' ? gateway.max_amount_minor : undefined,
        currency: typeof gateway.currency === 'string' ? gateway.currency : undefined,
      })).filter((gateway) => gateway.slug.length > 0),
    }));
  });
}

export function topUp(
  amountMinor: number,
  gateway: string,
  idempotencyKey?: string,
): Promise<ApiResult<{ payment: PaymentRecord; checkout?: PaymentCheckout; redirect_url?: string }>> {
  return apiRequest('/payments/top-up', {
    method: 'POST',
    body: { amount_minor: amountMinor, gateway },
    idempotencyKey,
  });
}

export function getPayment(reference: string): Promise<ApiResult<{ payment: PaymentRecord }>> {
  return apiRequest(`/payments/${encodeURIComponent(reference)}`);
}

export function verifyPayment(reference: string): Promise<ApiResult<{ payment: PaymentRecord }>> {
  return apiRequest(`/payments/${encodeURIComponent(reference)}/verify`, { method: 'POST', body: {} });
}

export function simulatePayment(reference: string, token?: string): Promise<ApiResult<{ payment: PaymentRecord }>> {
  return apiRequest(`/payments/${encodeURIComponent(reference)}/simulate`, {
    method: 'POST',
    body: { simulate: 'success', ...(token ? { token } : {}) },
  });
}

// ---------------------------------------------------------------------------
// Routes & Stops (authenticated passenger endpoints)
// ---------------------------------------------------------------------------

export function getRoutes(): Promise<ApiResult<{ routes: RouteInfo[] }>> {
  return apiRequest<unknown>('/routes').then((result) =>
    mapApiData(normalizeCollection<Record<string, unknown>, 'routes'>(result, 'routes'), (data) => ({
      routes: data.routes.map((route) => ({
        id: Number(route.id),
        code: String(route.code ?? ''),
        name: String(route.name ?? ''),
        origin_stop: stopName(route.origin_stop),
        destination_stop: stopName(route.destination_stop),
        distance_km: typeof route.distance_km === 'number' ? route.distance_km : null,
        estimated_minutes: typeof route.estimated_minutes === 'number' ? route.estimated_minutes : null,
        company_name: nestedName(route.company),
      })),
    })),
  );
}

export function getRoute(routeId: number): Promise<ApiResult<RouteInfo>> {
  return apiRequest(`/routes/${routeId}`);
}

export function getRouteStops(routeId: number): Promise<ApiResult<{ stops: StopInfo[] }>> {
  return apiRequest<unknown>(`/routes/${routeId}/stops`).then((result) =>
    mapApiData(normalizeCollection<Record<string, unknown>, 'stops'>(result, 'stops'), (data) => ({
      stops: data.stops.map((item) => {
        const stop = item.stop && typeof item.stop === 'object'
          ? item.stop as Record<string, unknown>
          : {};
        return {
          id: Number(item.stop_id ?? stop.id ?? item.id),
          name: String(stop.name ?? item.name ?? ''),
          latitude: typeof stop.latitude === 'number' ? stop.latitude : null,
          longitude: typeof stop.longitude === 'number' ? stop.longitude : null,
          sequence: Number(item.sequence ?? 0),
        };
      }),
    })),
  );
}

// ---------------------------------------------------------------------------
// Fare rules
// ---------------------------------------------------------------------------

export function getFareRules(): Promise<ApiResult<{ fare_rules: Record<string, unknown>[] }>> {
  return apiRequest<unknown>('/fare-rules').then((result) =>
    normalizeCollection<Record<string, unknown>, 'fare_rules'>(result, 'fare_rules'),
  );
}

export function previewFare(fareRuleId: number): Promise<ApiResult<Record<string, unknown>>> {
  return apiRequest(`/fare-rules/${fareRuleId}/preview`);
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export function getNotifications(): Promise<ApiResult<{ notifications: NotificationItem[] }>> {
  return apiRequest('/notifications');
}

export function markNotificationRead(id: string): Promise<ApiResult<unknown>> {
  return apiRequest(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST', body: {} });
}

export function markAllNotificationsRead(): Promise<ApiResult<unknown>> {
  return apiRequest('/notifications/read-all', { method: 'POST', body: {} });
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export function getProfile(): Promise<ApiResult<Record<string, unknown>>> {
  return apiRequest('/passenger/profile');
}

export function updateProfile(data: Record<string, unknown>): Promise<ApiResult<Record<string, unknown>>> {
  return apiRequest('/passenger/profile', { method: 'PATCH', body: data });
}

// ---------------------------------------------------------------------------
// QR Code
// ---------------------------------------------------------------------------

export type PassengerQrData = {
  qr_payload: string;
  card_uid: string;
  masked_code: string;
  expires_in_seconds: number;
  refreshed_at: string;
  status: string;
  passenger_name: string;
};

export function getPassengerQr(): Promise<ApiResult<PassengerQrData>> {
  return apiRequest<PassengerQrData>('/passenger/qr');
}

export type TransitFareQuote = {
  trip_reference: string;
  bus: { bus_number: string };
  company: { name: string | null };
  route: { name: string };
  fare: {
    amount_minor: number;
    amount_formatted: string;
    currency: string;
    boarding_stop_name: string | null;
  };
  wallet: {
    balance_minor: number;
    balance_formatted: string;
  };
};

export type TransitFareTicket = {
  ticket_number: string;
  travel_uid: string;
  transaction_reference: string;
  bus_number: string;
  route_name: string;
  fare_minor: number;
  fare_formatted: string;
  balance_remaining_minor: number;
  balance_remaining_formatted: string;
  issued_at: string;
  status: string;
};

export function quoteTransitFare(
  qrPayload: string,
  stopSequence?: number,
): Promise<ApiResult<TransitFareQuote>> {
  return apiRequest('/passenger/transit/quote', {
    method: 'POST',
    body: {
      qr_payload: qrPayload,
      ...(stopSequence !== undefined ? { stop_sequence: stopSequence } : {}),
    },
  });
}

export function payTransitFare(
  qrPayload: string,
  idempotencyKey = createIdempotencyKey(),
  stopSequence?: number,
): Promise<ApiResult<{ ticket: TransitFareTicket }>> {
  return apiRequest('/passenger/transit/pay', {
    method: 'POST',
    body: {
      qr_payload: qrPayload,
      ...(stopSequence !== undefined ? { stop_sequence: stopSequence } : {}),
    },
    idempotencyKey,
  });
}

function stopName(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const name = (value as Record<string, unknown>).name;
    return typeof name === 'string' ? name : null;
  }
  return null;
}

function nestedName(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const name = (value as Record<string, unknown>).name;
  return typeof name === 'string' ? name : null;
}
