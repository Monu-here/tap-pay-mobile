import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { AppText } from '@/components/typography/app-text';
import { NotificationSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppBackButton } from '@/components/ui/app-back-button';
import { DriverColors, Palette, Spacing } from '@/constants/theme';
import { FontFamilies } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { getSession } from '@/features/auth/session';
import {
  fcmDestination,
  isFcmAvailable,
  registerCurrentDeviceForFcm,
} from '@/features/notifications/fcm';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@/features/passenger/services/passengerApi';

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const baseTheme = useTheme();
  const isDriver = getSession().user?.type === 'driver';
  const theme = isDriver
    ? {
        ...baseTheme,
        ...DriverColors,
        text: DriverColors.textPrimary,
        borderLight: DriverColors.border,
        isDark: false,
      }
    : baseTheme;
  const actionColor = isDriver ? DriverColors.actionPrimary : Palette.crimsonRed;

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [registeringPush, setRegisteringPush] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadNotifications = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await getNotifications();
      if (res.ok && res.data) {
        setNotifications(res.data.notifications || []);
        setErrorMsg(null);
      } else {
        setErrorMsg(res.message || 'Could not load notifications.');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error loading notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadNotifications();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadNotifications]);

  useEffect(() => {
    let active = true;
    if (isFcmAvailable()) {
      import('@react-native-firebase/messaging')
        .then(({ getMessaging, hasPermission }) => hasPermission(getMessaging()))
        .then((status) => {
          if (active) {
            setPushEnabled(status === 1 || status === 2);
          }
        })
        .catch(() => {});
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void loadNotifications(true);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [loadNotifications]);

  const handleMarkRead = async (id: string | number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    );
    try {
      await markNotificationRead(String(id));
    } catch {
      // Background action
    }
  };

  const handleMarkAllRead = async () => {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: now })));
    try {
      await markAllNotificationsRead();
    } catch {
      // Background action
    }
  };

  const enablePush = async () => {
    setRegisteringPush(true);
    try {
      const token = await registerCurrentDeviceForFcm();
      if (token) {
        setPushEnabled(true);
      }
    } catch {
      // Ignored
    } finally {
      setRegisteringPush(false);
    }
  };

  const openNotification = async (item: NotificationItem) => {
    if (!item.read_at) await handleMarkRead(item.id);
    const resource = (item.resource ?? item.data?.resource) as Record<string, unknown> | undefined;
    const dest = fcmDestination({
      ...(item.data ?? {}),
      eventType: item.data?.event_type ?? item.type,
      resourceType: typeof resource?.type === 'string' ? resource.type : undefined,
      resourceReference: typeof resource?.reference === 'string' ? resource.reference : undefined,
    });
    if (dest) {
      router.push(dest as never);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />

      {/* Header Gradient */}
      <LinearGradient
        colors={['#003049', '#001824']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <AppBackButton />

            <View>
              <AppText style={styles.headerSubtitle}>eYatra</AppText>
              <View style={styles.headerTitleRow}>
                <AppText style={styles.headerTitle}>Notifications</AppText>
                {unreadCount > 0 && (
                  <View style={[styles.unreadBadge, { backgroundColor: actionColor }]}>
                    <AppText style={styles.unreadBadgeText}>{unreadCount} New</AppText>
                  </View>
                )}
              </View>
            </View>
          </View>

          {unreadCount > 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={handleMarkAllRead}
              style={({ pressed }) => [
                styles.markAllBtn,
                isDriver && { backgroundColor: 'rgba(253,240,213,0.12)' },
                { opacity: pressed ? 0.75 : 1 },
              ]}
              hitSlop={8}
            >
              <AppText style={styles.markAllText}>Mark all read</AppText>
            </Pressable>
          )}
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadNotifications(true)}
            tintColor={actionColor}
          />
        }
      >
        {loading && !refreshing ? (
          <NotificationSkeleton />
        ) : (
          <>
        {/* Device Push Notifications Banner */}
        <View
          style={[
            styles.pushBanner,
            {
              backgroundColor: theme.isDark ? '#002235' : Palette.white,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.pushIconWrap}>
            <SymbolView
              name={{ ios: 'bell.badge.fill', android: 'notifications_active', web: 'notifications_active' }}
              size={20}
              tintColor={pushEnabled ? DriverColors.actionPrimary : actionColor}
            />
          </View>

          <View style={styles.pushTextGroup}>
            <AppText style={[styles.pushTitle, { color: theme.text }]}>
              {pushEnabled ? 'Push Notifications Active' : 'Enable Ride & Fare Alerts'}
            </AppText>
            <AppText style={[styles.pushSubtitle, { color: theme.textSecondary }]}>
              {pushEnabled
                ? 'You will receive instant alerts for bus payments and travel passes.'
                : 'Stay notified on bus arrivals, receipts, and important journey updates.'}
            </AppText>
          </View>

          {!pushEnabled && (
            <Pressable
              accessibilityRole="button"
              onPress={() => void enablePush()}
              disabled={registeringPush}
              style={({ pressed }) => [
                styles.enableBtn,
                { opacity: pressed || registeringPush ? 0.75 : 1 },
              ]}
            >
              {registeringPush ? (
                <ActivityIndicator size="small" color={Palette.white} />
              ) : (
                <AppText style={styles.enableBtnText}>Enable</AppText>
              )}
            </Pressable>
          )}
        </View>

        {/* Error notification if any */}
        {errorMsg && (
          <View
            style={[
              styles.errorCard,
              {
                backgroundColor: theme.isDark ? '#3D0D11' : isDriver ? DriverColors.surfaceElevated : '#FDF0D5',
                borderColor: actionColor,
              },
            ]}
          >
            <AppText style={[styles.errorText, { color: theme.text }]}>{errorMsg}</AppText>
            <Pressable onPress={() => void loadNotifications(true)}>
              <AppText style={styles.retryText}>Retry</AppText>
            </Pressable>
          </View>
        )}

        {/* Notifications List */}
        {notifications.length > 0 ? (
          <View
            style={[
              styles.listCard,
              {
                backgroundColor: theme.isDark ? '#002235' : Palette.white,
                borderColor: theme.border,
              },
            ]}
          >
            {notifications.map((item, idx) => {
              const isUnread = !item.read_at;
              const isLast = idx === notifications.length - 1;

              // Format notification timestamp
              let timeFormatted = item.created_at;
              try {
                const date = new Date(item.created_at);
                timeFormatted = date.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
              } catch {
                // keep string
              }

              return (
                <Pressable
                  key={item.id}
                  onPress={() => void openNotification(item)}
                  style={({ pressed }) => [
                    styles.notificationItem,
                    !isLast && [styles.itemDivider, { borderBottomColor: theme.borderLight }],
                    {
                      backgroundColor: pressed
                        ? theme.isDark
                          ? '#002B42'
                          : isDriver ? DriverColors.surfaceSecondary : '#FBF5EB'
                        : isUnread
                        ? theme.isDark
                          ? 'rgba(193, 18, 31, 0.08)'
                          : isDriver ? 'rgba(27, 138, 90, 0.10)' : 'rgba(253, 240, 213, 0.45)'
                        : 'transparent',
                    },
                  ]}
                >
                  {/* Category Indicator Icon */}
                  <View
                    style={[
                      styles.iconCircle,
                      {
                        backgroundColor: isUnread
                          ? isDriver ? 'rgba(27, 138, 90, 0.12)' : 'rgba(193, 18, 31, 0.12)'
                          : theme.isDark
                          ? '#001824'
                          : isDriver ? DriverColors.surfaceElevated : '#F5EFE6',
                      },
                    ]}
                  >
                    <SymbolView
                      name={
                        item.type?.includes('payment') || item.type?.includes('wallet')
                          ? { ios: 'creditcard.fill', android: 'credit_card', web: 'credit_card' }
                          : item.type?.includes('trip') || item.type?.includes('fare')
                          ? { ios: 'bus.fill', android: 'directions_bus', web: 'directions_bus' }
                          : { ios: 'bell.fill', android: 'notifications', web: 'notifications' }
                      }
                      size={18}
                      tintColor={isUnread ? actionColor : theme.textMuted}
                    />
                  </View>

                  {/* Body Content */}
                  <View style={styles.itemBody}>
                    <View style={styles.itemTitleRow}>
                      <AppText
                        style={[
                          styles.itemTitle,
                          {
                            color: theme.text,
                            fontFamily: isUnread ? FontFamilies.bold : FontFamilies.semiBold,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {item.title || item.type || 'Notification'}
                      </AppText>

                      {isUnread && <View style={styles.unreadDot} />}
                    </View>

                    <AppText
                      style={[
                        styles.itemMessage,
                        { color: isUnread ? theme.text : theme.textSecondary },
                      ]}
                      numberOfLines={3}
                    >
                      {item.body || 'Tap to view details.'}
                    </AppText>

                    <AppText style={[styles.itemTime, { color: theme.textMuted }]}>
                      {timeFormatted}
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: theme.isDark ? '#002235' : Palette.white,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.emptyIconCircle}>
              <SymbolView
                name={{ ios: 'bell.slash.fill', android: 'notifications_off', web: 'notifications_off' }}
                size={34}
                tintColor={Palette.slateBlue}
              />
            </View>
            <AppText style={[styles.emptyTitle, { color: theme.text }]}>
              No Notifications
            </AppText>
            <AppText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              You are all caught up! You will receive updates about your bus tickets, wallet top-ups, and security alerts here.
            </AppText>
          </View>
        )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerGradient: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSubtitle: {
    color: Palette.slateBlue,
    fontFamily: FontFamilies.medium,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: Palette.warmCream,
    fontFamily: FontFamilies.extraBold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  unreadBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: Palette.crimsonRed,
  },
  unreadBadgeText: {
    fontFamily: FontFamilies.bold,
    fontSize: 10,
    color: Palette.white,
  },
  markAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  markAllText: {
    fontFamily: FontFamilies.bold,
    fontSize: 12,
    color: Palette.warmCream,
  },
  scrollContent: {
    padding: Spacing.four,
    gap: 16,
  },
  pushBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    shadowColor: Palette.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  pushIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(102, 155, 188, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pushTextGroup: {
    flex: 1,
    gap: 2,
  },
  pushTitle: {
    fontFamily: FontFamilies.bold,
    fontSize: 13,
    lineHeight: 17,
  },
  pushSubtitle: {
    fontFamily: FontFamilies.regular,
    fontSize: 11,
    lineHeight: 15,
  },
  enableBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Palette.crimsonRed,
  },
  enableBtnText: {
    fontFamily: FontFamilies.bold,
    fontSize: 12,
    color: Palette.white,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorText: {
    fontFamily: FontFamilies.medium,
    fontSize: 12,
    flex: 1,
  },
  retryText: {
    fontFamily: FontFamilies.bold,
    fontSize: 12,
    color: Palette.crimsonRed,
    marginLeft: 8,
  },
  centerContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  loadingLabel: {
    fontFamily: FontFamilies.medium,
    fontSize: 13,
  },
  listCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: Palette.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 12,
  },
  itemDivider: {
    borderBottomWidth: 1,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  itemBody: {
    flex: 1,
    gap: 4,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemTitle: {
    fontSize: 14,
    lineHeight: 18,
    flex: 1,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Palette.crimsonRed,
  },
  itemMessage: {
    fontFamily: FontFamilies.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  itemTime: {
    fontFamily: FontFamilies.regular,
    fontSize: 10,
    marginTop: 2,
  },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 36,
    alignItems: 'center',
    gap: 10,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(102, 155, 188, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: FontFamilies.bold,
    fontSize: 17,
  },
  emptySubtitle: {
    fontFamily: FontFamilies.regular,
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 270,
    lineHeight: 19,
  },
});
