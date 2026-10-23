import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import type { RemoteMessage } from '@react-native-firebase/messaging';

import { getSession, restoreSession, subscribeToSession } from '@/features/auth/session';
import {
  fcmDestination,
  getFirebaseMessaging,
  isFcmAvailable,
  registerCurrentDeviceForFcm,
  subscribeToFcmTokenRefresh,
} from '@/features/notifications/fcm';
import { getNotification, markNotificationRead } from '@/features/passenger/services/passengerApi';

export function FcmRuntime() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
    if (!isFcmAvailable()) return;

    let mounted = true;
    const unsubscribers: Array<() => void> = [];

    const handleRemoteMessageOpen = async (remoteMessage: RemoteMessage) => {
      await restoreSession();
      if (!getSession().token) {
        router.replace('/login');
        return;
      }

      const data = (remoteMessage.data ?? {}) as Record<string, unknown>;
      const notificationId = typeof data.notificationId === 'string' ? data.notificationId : null;

      if (notificationId) {
        const result = await getNotification(notificationId);
        if (result.ok && result.data) {
          void markNotificationRead(notificationId);
          const notificationData = result.data.data as Record<string, unknown> | undefined;
          const notificationResource = (result.data.resource ?? notificationData?.resource) as
            | Record<string, unknown>
            | undefined;

          const destination = fcmDestination({
            ...(notificationData ?? {}),
            eventType: notificationData?.event_type ?? result.data.type,
            resourceType: typeof notificationResource?.type === 'string' ? notificationResource.type : undefined,
            resourceReference: typeof notificationResource?.reference === 'string' ? notificationResource.reference : undefined,
          });
          router.push(destination as never);
          return;
        }

        if (result.status === 401) {
          router.replace('/login');
          return;
        }
      }

      const fallbackDestination = fcmDestination(data);
      router.push(fallbackDestination as never);
    };

    const synchronizeFcmToken = () => {
      if (!getSession().token || !getSession().user) return;

      void registerCurrentDeviceForFcm(false).then((result) => {
        if (mounted && !result.ok && result.reason === 'api') {
          console.warn('FCM device registration was not completed:', result.message);
        }
      }).catch((error: unknown) => {
        if (mounted) {
          console.warn(
            'FCM registration failed:',
            error instanceof Error ? error.message : 'Unknown registration error',
          );
        }
      });
    };

    // Initial sync
    synchronizeFcmToken();

    // Listen to session changes
    const unsubscribeSession = subscribeToSession(synchronizeFcmToken);
    unsubscribers.push(unsubscribeSession);

    // Sync on app focus
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') synchronizeFcmToken();
    });
    unsubscribers.push(() => appStateSubscription.remove());

    // Listen to token refresh
    const unsubscribeTokenRefresh = subscribeToFcmTokenRefresh();
    unsubscribers.push(unsubscribeTokenRefresh);

    // Load native Firebase Messaging listeners if available
    void getFirebaseMessaging().then((fcm) => {
      if (!fcm || !mounted) return;

      const messagingInstance = fcm.getMessaging();

      // Foreground message handler
      const unsubscribeForeground = fcm.onMessage(messagingInstance, async (remoteMessage: RemoteMessage) => {
        if (!mounted) return;
        const title = remoteMessage.notification?.title ?? 'Tap & Pay';
        const body = remoteMessage.notification?.body ?? 'New notification received.';
        console.log('FCM foreground message received:', { title, body, data: remoteMessage.data });
      });
      unsubscribers.push(unsubscribeForeground);

      // Notification opened from background state
      const unsubscribeOpenedApp = fcm.onNotificationOpenedApp(messagingInstance, (remoteMessage: RemoteMessage) => {
        if (remoteMessage) {
          void handleRemoteMessageOpen(remoteMessage);
        }
      });
      unsubscribers.push(unsubscribeOpenedApp);

      // Notification opened from quit/terminated state
      void fcm.getInitialNotification(messagingInstance)
        .then((remoteMessage: RemoteMessage | null) => {
          if (mounted && remoteMessage) {
            void handleRemoteMessageOpen(remoteMessage);
          }
        });
    });

    return () => {
      mounted = false;
      for (const unsub of unsubscribers) {
        try {
          unsub();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, [router]);

  return null;
}
