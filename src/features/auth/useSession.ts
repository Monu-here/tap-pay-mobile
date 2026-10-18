import { useSyncExternalStore } from 'react';

import { getSession, subscribeToSession, type Session } from './session';

/**
 * Subscribes a component to the in-memory auth session (token + user) and
 * re-renders it whenever the session changes.
 */
export function useSession(): Session {
  return useSyncExternalStore(subscribeToSession, getSession, getSession);
}
