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

export type ConcessionApplication = {
  id: number;
  category: 'student' | 'senior_citizen';
  details: Record<string, string | null>;
  status: 'pending' | 'approved' | 'rejected';
  review_note: string | null;
  submitted_at: string;
  reviewed_at: string | null;
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

export type ConcessionSubmission = {
  category: 'student' | 'senior_citizen';
  student_id_number?: string;
  college_name?: string;
  college_address?: string;
  student_id_expiry_date?: string;
  senior_card_number?: string;
  document: { uri: string; fileName?: string; mimeType?: string };
};

export type CardSummary = {
  id: number;
  uid?: string;
  card_uid?: string;
  label?: string | null;
  status: string;
  status_label?: string | null;
  status_reason?: string | null;
  blocked_reason_code?: string | null;
  blocked_reason_details?: string | null;
  blocked_at?: string | null;
  type?: string;
  card_type?: string;
  last_four?: string | null;
  masked_code?: string | null;
  is_usable?: boolean;
  deactivated_at?: string | null;
  lost_at?: string | null;
};

export type BlockCardPayload = {
  reason_code: 'lost' | 'stolen' | 'suspicious' | 'damaged' | 'temporary' | 'other';
  reason_details?: string;
  reason?: string;
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

export type WalletStatementFilters = {
  cursor?: string | null;
  perPage?: number;
  type?: 'load' | 'fare' | 'refund' | 'adjustment' | 'reversal';
  direction?: 'credit' | 'debit';
  status?: 'pending' | 'successful' | 'failed' | 'reversed';
  date_from?: string;
  date_to?: string;
};

export type WalletStatementSummary = {
  period: { from: string | null; to: string | null };
  entries: number;
  ledger_entries: number;
  total_credits_minor: number;
  total_debits_minor: number;
  opening_balance_minor: number;
  closing_balance_minor: number;
  net_minor: number;
  total_credits: { formatted: string };
  total_debits: { formatted: string };
  opening_balance: { formatted: string };
  closing_balance: { formatted: string };
  net: { formatted: string };
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

export type RouteDeparture = {
  trip_id: number;
  reference: string;
  scheduled_departure: string;
  status: 'scheduled';
  bus_number: string | null;
  company_name: string | null;
};

export type PassengerFavorites = {
  route_ids: number[];
  stop_ids: number[];
  favorite_stops: FavoriteStopInfo[];
};

export type RecentJourneySearch = {
  id: number;
  from_stop: { id: number; name: string; code: string } | null;
  to_stop: { id: number; name: string; code: string } | null;
  searched_at: string;
};

export type FavoriteStopInfo = {
  id: number;
  name: string;
  code: string;
  latitude: number | null;
  longitude: number | null;
};

export type NotificationItem = {
  id: string;
  type: string;
  title: string | null;
  body: string | null;
  data?: Record<string, unknown>;
  resource?: {
    type?: string;
    reference?: string;
    trip_id?: number | null;
  } | null;
  read_at: string | null;
  created_at: string;
};

export type SupportTicketMessage = {
  id: number;
  author_id: number;
  author_name: string | null;
  is_staff: boolean;
  body: string;
  created_at: string | null;
};

export type SupportTicket = {
  reference: string;
  category: 'payment_dispute' | 'wallet' | 'card' | 'account' | 'journey' | 'other';
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  transaction_reference: string | null;
  last_message_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  messages?: SupportTicketMessage[];
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

export function issueCard(): Promise<ApiResult<{ card: CardSummary }>> {
  return apiRequest<{ card: CardSummary }>('/cards', {
    method: 'POST',
    body: { card_type: 'nfc' },
  });
}

export function activateCard(cardId: number): Promise<ApiResult<{ card: CardSummary }>> {
  return apiRequest<{ card: CardSummary }>(`/cards/${cardId}/activate`, { method: 'POST', body: {} });
}

export function deactivateCard(cardId: number): Promise<ApiResult<{ card: CardSummary }>> {
  return apiRequest<{ card: CardSummary }>(`/cards/${cardId}/deactivate`, { method: 'POST', body: {} });
}

export function blockCard(
  cardId: number,
  payload?: BlockCardPayload,
): Promise<ApiResult<{ card: CardSummary }>> {
  return apiRequest<{ card: CardSummary }>(`/cards/${cardId}/block`, {
    method: 'POST',
    body: payload ?? { reason_code: 'temporary' },
  });
}

export function reportLostCard(cardId: number): Promise<ApiResult<{ card: CardSummary }>> {
  return apiRequest<{ card: CardSummary }>(`/cards/${cardId}/report-lost`, { method: 'POST', body: {} });
}

// ---------------------------------------------------------------------------
// Wallet / Transactions
// ---------------------------------------------------------------------------

export function getWalletTransactions(
  filters: WalletStatementFilters = {},
): Promise<ApiResult<{ transactions: WalletTransaction[] }>> {
  const params = new URLSearchParams();
  if (filters.cursor) params.set('cursor', filters.cursor);
  if (filters.perPage) params.set('per_page', String(filters.perPage));
  if (filters.type) params.set('type', filters.type);
  if (filters.direction) params.set('direction', filters.direction);
  if (filters.status) params.set('status', filters.status);
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  const query = params.toString();
  return apiRequest(`/wallet/statements${query ? `?${query}` : ''}`);
}

export function getWalletStatementSummary(
  filters: Omit<WalletStatementFilters, 'cursor' | 'perPage'> = {},
): Promise<ApiResult<WalletStatementSummary>> {
  const params = new URLSearchParams();
  if (filters.type) params.set('type', filters.type);
  if (filters.direction) params.set('direction', filters.direction);
  if (filters.status) params.set('status', filters.status);
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  const query = params.toString();
  return apiRequest(`/wallet/statements/summary${query ? `?${query}` : ''}`);
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
      })).filter((gateway) => gateway.slug === 'esewa'),
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
  return apiRequest(`/payments/${encodeURIComponent(reference)}/verify`, {
    method: 'POST',
    body: {},
    idempotencyKey: createIdempotencyKey(),
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

export function getRouteDepartures(routeId: number): Promise<ApiResult<{ departures: RouteDeparture[] }>> {
  return apiRequest<{ departures: RouteDeparture[] }>(`/routes/${routeId}/departures`);
}

export function getPassengerFavorites(): Promise<ApiResult<PassengerFavorites>> {
  return apiRequest<PassengerFavorites>('/favorites');
}

export function setRouteFavorite(routeId: number, favorite: boolean): Promise<ApiResult<null>> {
  return apiRequest(`/favorites/routes/${routeId}`, { method: favorite ? 'PUT' : 'DELETE' });
}

export function setStopFavorite(stopId: number, favorite: boolean): Promise<ApiResult<null>> {
  return apiRequest(`/favorites/stops/${stopId}`, { method: favorite ? 'PUT' : 'DELETE' });
}

export function getJourneyOptions(
  fromStopId: number,
  toStopId: number,
): Promise<ApiResult<{ routes: RouteInfo[] }>> {
  const query = `from_stop_id=${encodeURIComponent(fromStopId)}&to_stop_id=${encodeURIComponent(toStopId)}`;
  return apiRequest<unknown>(`/journey-options?${query}`).then((result) =>
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

export function getRecentJourneySearches(): Promise<ApiResult<{ searches: RecentJourneySearch[] }>> {
  return apiRequest<unknown>('/journey-searches/recent').then((result) =>
    normalizeCollection<RecentJourneySearch, 'searches'>(result, 'searches'),
  );
}

export function saveRecentJourneySearch(
  fromStopId: number,
  toStopId: number,
): Promise<ApiResult<{ search: RecentJourneySearch }>> {
  return apiRequest('/journey-searches/recent', {
    method: 'POST',
    body: { from_stop_id: fromStopId, to_stop_id: toStopId },
  });
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

export function getNotification(id: string): Promise<ApiResult<NotificationItem>> {
  return apiRequest(`/notifications/${encodeURIComponent(id)}`);
}

export function getUnreadNotificationCount(): Promise<ApiResult<{ unread_count: number }>> {
  return apiRequest('/notifications/unread-count');
}

export function registerFcmDevice(payload: {
  token: string;
  platform: 'ios' | 'android';
  device_name?: string;
  device_id?: string;
  app_version?: string;
}): Promise<ApiResult<{ registered: boolean }>> {
  return apiRequest('/devices/fcm/register', { method: 'POST', body: payload });
}

export function removeFcmDevice(token: string): Promise<ApiResult<{ removed: boolean }>> {
  return apiRequest('/devices/fcm/unregister', { method: 'DELETE', body: { token } });
}

export function removeAllFcmDevices(): Promise<ApiResult<{ removed: number }>> {
  return apiRequest('/devices/fcm/all', { method: 'DELETE', body: {} });
}

export function markNotificationRead(id: string): Promise<ApiResult<unknown>> {
  return apiRequest(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST', body: {} });
}

export function markAllNotificationsRead(): Promise<ApiResult<unknown>> {
  return apiRequest('/notifications/read-all', { method: 'POST', body: {} });
}

// ---------------------------------------------------------------------------
// Passenger support
// ---------------------------------------------------------------------------

export function getSupportTickets(): Promise<ApiResult<{ tickets: SupportTicket[] }>> {
  return apiRequest<unknown>('/support/tickets').then((result) =>
    normalizeCollection<SupportTicket, 'tickets'>(result, 'tickets'),
  );
}

export function getSupportTicket(reference: string): Promise<ApiResult<{ ticket: SupportTicket }>> {
  return apiRequest(`/support/tickets/${encodeURIComponent(reference)}`);
}

export function createSupportTicket(payload: {
  category: SupportTicket['category'];
  subject: string;
  message: string;
  transaction_reference?: string;
}): Promise<ApiResult<{ ticket: SupportTicket }>> {
  return apiRequest('/support/tickets', { method: 'POST', body: payload });
}

export function replyToSupportTicket(
  reference: string,
  message: string,
): Promise<ApiResult<{ ticket: SupportTicket }>> {
  return apiRequest(`/support/tickets/${encodeURIComponent(reference)}/messages`, {
    method: 'POST',
    body: { message },
  });
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
// MPIN security
// ---------------------------------------------------------------------------

export function getMpinStatus(): Promise<ApiResult<{ configured: boolean }>> {
  return apiRequest('/security/mpin');
}

export function setMpin(mpin: string, confirmation: string): Promise<ApiResult<{ configured: boolean }>> {
  return apiRequest('/security/mpin', {
    method: 'POST',
    body: { mpin, mpin_confirmation: confirmation },
  });
}

export function changeMpin(
  currentMpin: string,
  mpin: string,
  confirmation: string,
): Promise<ApiResult<{ configured: boolean }>> {
  return apiRequest('/security/mpin', {
    method: 'PATCH',
    body: { current_mpin: currentMpin, mpin, mpin_confirmation: confirmation },
  });
}

export function resetMpin(
  currentPassword: string,
  mpin: string,
  confirmation: string,
): Promise<ApiResult<{ configured: boolean }>> {
  return apiRequest('/security/mpin/reset', {
    method: 'POST',
    body: { current_password: currentPassword, mpin, mpin_confirmation: confirmation },
  });
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
  driver: { id: number; name: string | null; photo_url: string | null; verified: boolean };
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
  driver_name: string | null;
  company_name: string | null;
  fare_minor: number;
  fare_formatted: string;
  balance_remaining_minor: number;
  balance_remaining_formatted: string;
  issued_at: string;
  status: string;
};

export type PassengerFeedback = {
  id: number;
  travel_uid: string;
  rating: number;
  comment: string | null;
  submitted_at: string;
};

export function submitPassengerFeedback(
  travelUid: string,
  rating: number,
  comment: string,
  idempotencyKey: string,
): Promise<ApiResult<{ feedback: PassengerFeedback }>> {
  return apiRequest('/passenger/feedback', {
    method: 'POST',
    idempotencyKey,
    body: {
      travel_uid: travelUid,
      rating,
      comment: comment.trim() || null,
    },
  });
}

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
  mpin: string,
  driverId: number,
  idempotencyKey = createIdempotencyKey(),
  stopSequence?: number,
): Promise<ApiResult<{ ticket: TransitFareTicket }>> {
  return apiRequest('/passenger/transit/pay', {
    method: 'POST',
    body: {
      qr_payload: qrPayload,
      mpin,
      driver_id: driverId,
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

export async function getConcessionApplications(): Promise<
  ApiResult<{ applications: ConcessionApplication[] }>
> {
  return apiRequest('/passenger/concession-applications');
}

export function submitConcessionApplication(
  submission: ConcessionSubmission,
): Promise<ApiResult<{ application: ConcessionApplication }>> {
  const form = new FormData();
  form.append('category', submission.category);
  if (submission.student_id_number) form.append('student_id_number', submission.student_id_number);
  if (submission.college_name) form.append('college_name', submission.college_name);
  if (submission.college_address) form.append('college_address', submission.college_address);
  if (submission.student_id_expiry_date) {
    form.append('student_id_expiry_date', submission.student_id_expiry_date);
  }
  if (submission.senior_card_number) form.append('senior_card_number', submission.senior_card_number);
  form.append('document', {
    uri: submission.document.uri,
    name: submission.document.fileName ?? 'concession-document.jpg',
    type: submission.document.mimeType ?? 'image/jpeg',
  } as unknown as Blob);
  return apiRequest('/passenger/concession-applications', { method: 'POST', body: form });
}
