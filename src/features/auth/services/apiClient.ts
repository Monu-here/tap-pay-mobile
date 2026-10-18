/**
 * Shared fetch client for the authenticated API.
 *
 * Thin wrapper around `fetch` that gives every call the same behaviour:
 *   - base URL + `Authorization: Bearer` from the current session,
 *   - the shared `{ message, data }` JSON envelope parsed into an `ApiResult`,
 *   - a 15s request timeout,
 *   - 401 handled globally (clears the session, queues a message, bounces to login),
 *   - 429 surfaced with its `retry_after` (seconds),
 *   - dev-only logging of URL + method + status (never body, token or password).
 *
 * No third-party HTTP library is used — the project calls `fetch` directly.
 * Unauthenticated calls (login, register) pass `skipAuthError` so their own
 * 401/422 is returned to the caller instead of triggering the global logout.
 */

import { router } from 'expo-router';

import { API_BASE_URL } from '@/config/api';
import { common } from '@/constants/strings';
import { clearSession, getSession, setPendingAuthMessage } from '../session';

/** Route a 401 redirects to. */
export const LOGIN_ROUTE = '/login';

const IS_DEV = typeof __DEV__ !== 'undefined' && __DEV__;
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_RETRY_AFTER = 60;

export type ApiSuccess<T> = {
  ok: true;
  status: number;
  message: string | null;
  data: T;
};

export type ApiFailure = {
  ok: false;
  /** HTTP status, or 0 for network/timeout failures. */
  status: number;
  message: string | null;
  data: Record<string, unknown> | null;
  /** Populated on 429 with the backend's `retry_after` (seconds). */
  retryAfter?: number;
  kind: 'http' | 'network' | 'timeout' | 'unauthorized';
};

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Serialized to a JSON body. Omitted entirely for GET. */
  body?: unknown;
  /** Do not treat a 401 as session expiry (used by login/register). */
  skipAuthError?: boolean;
  /** Reuse this key when retrying the same logical write. */
  idempotencyKey?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function createIdempotencyKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Converts a successful response only when its data matches a known resource
 * shape. Contract mismatches are surfaced as 502-style integration errors,
 * rather than silently turning a server response into an empty list.
 */
export function normalizeCollection<T, K extends string>(
  result: ApiResult<unknown>,
  key: K,
): ApiResult<{ [P in K]: T[] }> {
  if (!result.ok) return result;
  if (Array.isArray(result.data)) {
    return { ...result, data: { [key]: result.data as T[] } as { [P in K]: T[] } };
  }
  const data = asRecord(result.data);
  if (data && Array.isArray(data[key])) {
    return { ...result, data: { [key]: data[key] as T[] } as { [P in K]: T[] } };
  }
  return {
    ok: false,
    status: 502,
    kind: 'http',
    message: `The server returned an unexpected ${key} response. Please retry or contact support.`,
    data: null,
  };
}

export function mapApiData<TSource, TTarget>(
  result: ApiResult<TSource>,
  map: (data: TSource) => TTarget,
): ApiResult<TTarget> {
  if (!result.ok) return result;
  return { ...result, data: map(result.data) };
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const { token } = getSession();
  const method = options.method ?? 'GET';
  const url = `${API_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (method !== 'GET') {
    headers['Idempotency-Key'] = options.idempotencyKey ?? createIdempotencyKey();
  }

  const hasBody = options.body !== undefined;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  if (IS_DEV) console.log(`[api] ${method} ${url} -> pending`);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: hasBody ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    if (IS_DEV) console.log(`[api] ${method} ${url} -> ${response.status}`);
    return await interpret<T>(response, options.skipAuthError === true);
  } catch (error) {
    // No response reached us (DNS/offline/aborted): this is the only case shown
    // as "could not reach the server". HTTP responses keep their own message.
    if (IS_DEV) {
      const reason =
        error instanceof Error ? `${error.name}: ${error.message}` : 'unknown error';
      console.log(`[api] ${method} ${url} -> no response (${reason})`);
    }
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, status: 0, kind: 'timeout', message: 'Request timed out. Please check your connection to the server.', data: null };
    }
    return { ok: false, status: 0, kind: 'network', message: 'Unable to connect to Tap & Pay server. Please check your network.', data: null };
  } finally {
    clearTimeout(timeout);
  }
}

function extractErrorMessage(root: Record<string, unknown> | null, status: number): string {
  // 1. Validation errors dictionary from Laravel 422
  if (root && typeof root.errors === 'object' && root.errors !== null) {
    const errorMap = root.errors as Record<string, unknown>;
    const firstKey = Object.keys(errorMap)[0];
    if (firstKey) {
      const val = errorMap[firstKey];
      if (Array.isArray(val) && typeof val[0] === 'string') {
        return val[0];
      }
      if (typeof val === 'string') {
        return val;
      }
    }
  }

  // 2. Direct message string (ignoring generic 'Action required')
  if (typeof root?.message === 'string' && root.message.trim() && root.message !== 'Action required') {
    return root.message;
  }

  // 3. Status-based human readable description
  switch (status) {
    case 401:
      return 'Session expired or unauthenticated. Please log in again.';
    case 403:
      return 'Access forbidden. Your account does not have permission for this action.';
    case 404:
      return 'The requested resource or endpoint was not found.';
    case 422:
      return 'Validation failed. Please verify the submitted details.';
    case 429:
      return 'Too many requests. Please slow down and try again shortly.';
    case 500:
    case 502:
    case 503:
      return 'Server encountered an error. Please try again shortly.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

async function interpret<T>(response: Response, skipAuthError: boolean): Promise<ApiResult<T>> {
  const text = await response.text();
  const parsed = text ? safeParse(text) : null;
  const root = asRecord(parsed);
  const data = (root && 'data' in root ? root.data : null) as T | null;
  const message = extractErrorMessage(root, response.status);

  if (response.status === 401 && !skipAuthError) {
    // Global session expiry: queue a message, drop the session, bounce to login.
    setPendingAuthMessage(common.sessionExpired);
    try {
      await clearSession();
    } catch {
      setPendingAuthMessage('Session expired. Please sign in again; secure session cleanup failed.');
    }
    router.replace(LOGIN_ROUTE);
    return { ok: false, status: 401, kind: 'unauthorized', message, data: root };
  }

  if (response.status === 429) {
    return {
      ok: false,
      status: 429,
      kind: 'http',
      message,
      data: root,
      retryAfter: readRetryAfter(root, response),
    };
  }

  if (response.ok) {
    return { ok: true, status: response.status, message: typeof root?.message === 'string' ? root.message : null, data: (data ?? null) as T };
  }

  return { ok: false, status: response.status, kind: 'http', message, data: root };
}

function readRetryAfter(root: Record<string, unknown> | null, response: Response): number {
  const data = asRecord(root?.data);
  const bodyValue = data?.retry_after ?? root?.retry_after;
  if (typeof bodyValue === 'number' && Number.isFinite(bodyValue)) {
    return Math.max(0, Math.round(bodyValue));
  }
  const header = response.headers?.get?.('Retry-After');
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds));
  }
  return DEFAULT_RETRY_AFTER;
}
