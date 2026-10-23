import * as Device from 'expo-device';
import { NativeModules, Platform, PermissionsAndroid, TurboModuleRegistry } from 'react-native';
import type { RemoteMessage } from '@react-native-firebase/messaging';

import { getSession } from '@/features/auth/session';
import { registerFcmDevice, removeFcmDevice, removeAllFcmDevices } from '@/features/passenger/services/passengerApi';

let registeredFcmToken: string | null = null;
let registeredFcmUserId: string | null = null;

export type FcmRegistrationResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'web' | 'simulator' | 'permission' | 'api' | 'unsupported'; message: string };

/**
 * Checks whether native Firebase modules are linked and available in the current binary.
 * Returns false when running inside standard Expo Go, on web, or in a node testing runner.
 */
export function isFcmAvailable(): boolean {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return false;
  }
  try {
    const turbo = typeof TurboModuleRegistry?.get === 'function'
      ? TurboModuleRegistry.get('NativeRNFBTurboApp')
      : null;
    const legacy = (NativeModules as Record<string, unknown> | undefined)?.RNFBAppModule;
    return Boolean(turbo || legacy);
  } catch {
    return false;
  }
}

/**
 * Lazily loads @react-native-firebase/messaging only when native modules exist.
 * This guarantees Expo Go or web never crashes on startup.
 */
export async function getFirebaseMessaging() {
  if (!isFcmAvailable()) {
    return null;
  }
  try {
    return await import('@react-native-firebase/messaging');
  } catch (error) {
    console.warn('Native Firebase Messaging could not be loaded:', error);
    return null;
  }
}

export async function requestFcmPermission(): Promise<boolean> {
  if (!isFcmAvailable()) return false;

  try {
    if (Platform.OS === 'android') {
      const apiLevel = typeof Platform.constants.Version === 'number'
        ? Platform.constants.Version
        : parseInt(String(Platform.constants.Version), 10);

      if (apiLevel >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      return true;
    }

    if (Platform.OS === 'ios') {
      const fcm = await getFirebaseMessaging();
      if (!fcm) return false;
      const authStatus = await fcm.requestPermission(fcm.getMessaging());
      return (
        authStatus === fcm.AuthorizationStatus.AUTHORIZED ||
        authStatus === fcm.AuthorizationStatus.PROVISIONAL
      );
    }
  } catch (error) {
    console.warn('Failed to request FCM notification permission:', error);
  }

  return false;
}

export async function registerCurrentDeviceForFcm(
  requestPermission = false,
): Promise<FcmRegistrationResult> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return { ok: false, reason: 'web', message: 'FCM push notifications are not available on web.' };
  }
  if (!Device.isDevice) {
    return { ok: false, reason: 'simulator', message: 'FCM push notifications require a physical device.' };
  }
  if (!isFcmAvailable()) {
    return {
      ok: false,
      reason: 'unsupported',
      message: 'Native Firebase is not linked in this build (e.g. Expo Go). Build a development client with "npx expo run:android" to enable push notifications.',
    };
  }

  try {
    const fcm = await getFirebaseMessaging();
    if (!fcm) {
      return { ok: false, reason: 'unsupported', message: 'Firebase messaging module could not be initialized.' };
    }

    const messaging = fcm.getMessaging();
    const hasPermissionStatus = await fcm.hasPermission(messaging);
    const authorized =
      hasPermissionStatus === fcm.AuthorizationStatus.AUTHORIZED ||
      hasPermissionStatus === fcm.AuthorizationStatus.PROVISIONAL;

    if (!authorized && requestPermission) {
      const granted = await requestFcmPermission();
      if (!granted) {
        return { ok: false, reason: 'permission', message: 'Notification permission has not been granted.' };
      }
    } else if (!authorized) {
      return { ok: false, reason: 'permission', message: 'Notification permission has not been granted.' };
    }

    const token = await fcm.getToken(messaging);
    if (!token) {
      return { ok: false, reason: 'api', message: 'Could not obtain native FCM token from Firebase.' };
    }

    const userId = getSession().user?.id;
    if (!userId || !getSession().token) {
      return { ok: false, reason: 'api', message: 'Sign in before registering this device for FCM push notifications.' };
    }

    if (registeredFcmToken === token && registeredFcmUserId === userId) {
      return { ok: true, token };
    }

    const result = await registerFcmDevice({
      token,
      platform: Platform.OS,
      device_name: `${Device.modelName ?? 'Handset'} (${Platform.OS})`.slice(0, 120),
      device_id: Device.osBuildId ?? undefined,
      app_version: '1.0.0',
    });

    if (!result.ok) {
      return { ok: false, reason: 'api', message: result.message ?? 'Could not register this device with Tap & Pay API.' };
    }

    registeredFcmToken = token;
    registeredFcmUserId = userId;
    return { ok: true, token };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown FCM registration error';
    return { ok: false, reason: 'api', message };
  }
}

export async function unregisterCurrentDeviceFcmToken(): Promise<boolean> {
  const token = registeredFcmToken;
  if (!token) {
    if (isFcmAvailable()) {
      try {
        const fcm = await getFirebaseMessaging();
        if (fcm) {
          const currentToken = await fcm.getToken(fcm.getMessaging());
          if (currentToken) {
            const result = await removeFcmDevice(currentToken);
            return result.ok;
          }
        }
      } catch {
        // Safe to ignore if token retrieval fails during logout
      }
    }
    return true;
  }

  const result = await removeFcmDevice(token);
  if (result.ok) {
    registeredFcmToken = null;
    registeredFcmUserId = null;
    return true;
  }
  return false;
}

export async function unregisterAllFcmTokens(): Promise<boolean> {
  const result = await removeAllFcmDevices();
  if (result.ok) {
    registeredFcmToken = null;
    registeredFcmUserId = null;
    return true;
  }
  return false;
}

export function fcmDestination(data?: Record<string, unknown> | null): string {
  const payload = data && typeof data === 'object' ? data : {};
  const eventType = typeof payload.eventType === 'string' ? payload.eventType : '';
  const resourceType = typeof payload.resourceType === 'string' ? payload.resourceType : '';
  const resourceReference = typeof payload.resourceReference === 'string' ? payload.resourceReference : '';

  if (resourceType === 'wallet_transaction' && resourceReference) {
    return `/wallet/transaction/${encodeURIComponent(resourceReference)}`;
  }
  if (resourceType === 'card') return '/(tabs)/cards';
  if (resourceType === 'trip') return '/travel';
  if (resourceType === 'payment') return '/(tabs)/wallet';
  if (resourceType === 'company') {
    return eventType === 'company_approval_required' ? '/portal/admin' : '/portal/company';
  }
  if (eventType.startsWith('driver_assignment') || eventType.startsWith('driver_')) {
    return '/portal/driver';
  }
  return '/notifications';
}

/**
 * Listen for FCM token refresh events and synchronize with backend.
 */
export function subscribeToFcmTokenRefresh(): () => void {
  if (!isFcmAvailable()) return () => {};

  let unsubscribeInner: (() => void) | null = null;
  let cancelled = false;

  void getFirebaseMessaging().then((fcm) => {
    if (!fcm || cancelled) return;

    unsubscribeInner = fcm.onTokenRefresh(fcm.getMessaging(), async (newToken: string) => {
      const userId = getSession().user?.id;
      if (!userId || !getSession().token) return;

      try {
        const result = await registerFcmDevice({
          token: newToken,
          platform: Platform.OS as 'ios' | 'android',
          device_name: `${Device.modelName ?? 'Handset'} (${Platform.OS})`.slice(0, 120),
          device_id: Device.osBuildId ?? undefined,
          app_version: '1.0.0',
        });
        if (result.ok) {
          registeredFcmToken = newToken;
          registeredFcmUserId = userId;
        }
      } catch (error) {
        console.warn('FCM token refresh synchronization failed:', error);
      }
    });
  });

  return () => {
    cancelled = true;
    if (unsubscribeInner) {
      unsubscribeInner();
    }
  };
}
