/**
 * Secure persistent auth session store (token + expiry + current user).
 *
 * Lives outside React so non-component code — the API client, its 401 handler —
 * can read and mutate the session without context plumbing. React subscribes
 * through `useSession`. Native sessions are stored in the OS keychain/keystore;
 * web remains memory-only because SecureStore is not available there.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type SessionUser = {
  id: string;
  uuid?: string;
  name?: string;
  email: string;
  phone?: string;
  type?: string;
  email_verified: boolean;
  phone_verified: boolean;
  status?: string;
  roles?: string[];
  abilities?: string[];
  company_memberships?: Record<string, unknown>[];
  driver?: Record<string, unknown> | null;
};

export type Session = {
  token: string | null;
  expiresAt: string | null;
  user: SessionUser | null;
};

const INITIAL_SESSION: Session = { token: null, expiresAt: null, user: null };
const SESSION_STORAGE_KEY = 'tap-pay.auth-session';

let state: Session = INITIAL_SESSION;
let pendingAuthMessage: string | null = null;
let storageQueue: Promise<void> = Promise.resolve();
let restorePromise: Promise<Session> | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function getSession(): Session {
  return state;
}

export function setSession(patch: Partial<Session>): Promise<void> {
  state = { ...state, ...patch };
  emit();
  return persistSession();
}

export type SaveSessionInput = {
  token: string | null;
  expiresAt?: string | null;
  user: SessionUser | null;
};

/** Persist the session after login / signup. */
export function saveSession(session: SaveSessionInput): Promise<void> {
  state = {
    token: session.token,
    expiresAt: session.expiresAt ?? null,
    user: session.user,
  };
  emit();
  return persistSession();
}

export function clearSession(): Promise<void> {
  state = INITIAL_SESSION;
  emit();
  if (Platform.OS === 'web') return Promise.resolve();
  return enqueueStorage(() => SecureStore.deleteItemAsync(SESSION_STORAGE_KEY));
}

/** Restore the encrypted session once before the app makes authenticated calls. */
export function restoreSession(): Promise<Session> {
  if (restorePromise) return restorePromise;
  restorePromise = (async () => {
    if (Platform.OS === 'web') return state;

    const stored = await SecureStore.getItemAsync(SESSION_STORAGE_KEY);
    if (!stored) return state;

    let parsed: unknown;
    try {
      parsed = JSON.parse(stored);
    } catch {
      await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
      return state;
    }

    if (!isStoredSession(parsed)) {
      await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
      return state;
    }

    state = {
      token: parsed.token,
      expiresAt: parsed.expiresAt,
      user: parsed.user,
    };
    if (!isSessionValid()) {
      state = INITIAL_SESSION;
      await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
    }
    emit();
    return state;
  })();
  return restorePromise;
}

function isStoredSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  const user = candidate.user;
  return (
    typeof candidate.token === 'string' &&
    (candidate.expiresAt === null || typeof candidate.expiresAt === 'string') &&
    !!user &&
    typeof user === 'object' &&
    !Array.isArray(user) &&
    typeof (user as Record<string, unknown>).email === 'string'
  );
}

function persistSession(): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  return enqueueStorage(async () => {
    if (!state.token || !state.user) {
      await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
      return;
    }
    await SecureStore.setItemAsync(SESSION_STORAGE_KEY, JSON.stringify(state), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  });
}

function enqueueStorage(operation: () => Promise<void>): Promise<void> {
  const result = storageQueue.then(operation);
  storageQueue = result.catch(() => undefined);
  return result;
}

/** True when a token exists and has not expired (`expiresAt === null` = no expiry). */
export function isSessionValid(): boolean {
  if (!state.token) return false;
  if (!state.expiresAt) return true;
  const milliseconds = Date.parse(state.expiresAt);
  if (Number.isNaN(milliseconds)) return true;
  return milliseconds > Date.now();
}

/**
 * A one-shot message the login screen shows on mount, e.g. after a global 401.
 * Set by the client's 401 handler and consumed by `LoginScreen`.
 */
export function setPendingAuthMessage(message: string | null): void {
  pendingAuthMessage = message;
}

export function consumePendingAuthMessage(): string | null {
  const message = pendingAuthMessage;
  pendingAuthMessage = null;
  return message;
}

export function subscribeToSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Maps a raw API user object onto `SessionUser`. */
export function normalizeUser(raw: Record<string, unknown> | null): SessionUser {
  const source = raw ?? {};
  return {
    id: String(source.id ?? ''),
    uuid: typeof source.uuid === 'string' ? source.uuid : undefined,
    name: typeof source.name === 'string' ? source.name : undefined,
    email: String(source.email ?? ''),
    phone: typeof source.phone === 'string' ? source.phone : undefined,
    type: typeof source.type === 'string' ? source.type : undefined,
    email_verified: source.email_verified === true,
    phone_verified: source.phone_verified === true,
    status: typeof source.status === 'string' ? source.status : undefined,
    roles: toStringArray(source.roles),
    abilities: toStringArray(source.abilities),
    company_memberships: toRecordArray(source.company_memberships),
    driver: toRecord(source.driver),
  };
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const filtered = value.filter((entry): entry is string => typeof entry === 'string');
  return filtered.length ? filtered : undefined;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function toRecordArray(value: unknown): Record<string, unknown>[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((entry): entry is Record<string, unknown> =>
    Boolean(entry && typeof entry === 'object' && !Array.isArray(entry)),
  );
}

export type AppRole = 'super_admin' | 'company_admin' | 'driver' | 'passenger';

export function getUserRole(user?: SessionUser | null): AppRole {
  if (!user) return 'passenger';
  const roles = user.roles ?? [];
  const type = user.type?.toLowerCase() ?? '';
  if (roles.includes('super_admin') || type === 'super_admin' || type === 'admin') {
    return 'super_admin';
  }
  if (roles.includes('company_admin') || type === 'company_admin' || type === 'operator') {
    return 'company_admin';
  }
  if (roles.includes('driver') || type === 'driver') {
    return 'driver';
  }
  return 'passenger';
}

export function getRoleDashboardPath(role: AppRole): string {
  switch (role) {
    case 'super_admin':
      return '/portal/admin';
    case 'company_admin':
      return '/portal/company';
    case 'driver':
      return '/portal/driver';
    case 'passenger':
    default:
      return '/(tabs)/home';
  }
}
