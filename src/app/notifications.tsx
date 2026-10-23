import {AppText, AppTextInput } from '@/components/typography/app-text';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Monochrome, Spacing } from '@/constants/theme';
import { fcmDestination, isFcmAvailable, registerCurrentDeviceForFcm } from '@/features/notifications/fcm';
import { getSession } from '@/features/auth/session';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  getProfile,
  updateProfile,
  type NotificationItem,
} from '@/features/passenger/services/passengerApi';

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const isPassenger = getSession().user?.type === 'passenger';

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lowBalanceEnabled, setLowBalanceEnabled] = useState(false);
  const [lowBalanceThreshold, setLowBalanceThreshold] = useState('5000');
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [registeringPush, setRegisteringPush] = useState(false);

  const loadNotifications = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [res, profileResult] = await Promise.all([
        getNotifications(),
        isPassenger ? getProfile() : Promise.resolve(null),
      ]);
      if (res.ok && res.data) {
        setNotifications(res.data.notifications || []);
      } else {
        setPreferenceError(res.message || 'Could not load notifications.');
      }
      if (profileResult?.ok && profileResult.data) {
        const userValue = profileResult.data.user;
        const user = userValue && typeof userValue === 'object' && !Array.isArray(userValue)
          ? userValue as Record<string, unknown>
          : profileResult.data;
        const preferencesValue = user.preferences;
        const preferences = preferencesValue && typeof preferencesValue === 'object' && !Array.isArray(preferencesValue)
          ? preferencesValue as Record<string, unknown>
          : {};
        setLowBalanceEnabled(preferences.low_balance_alerts_enabled === true);
        setLowBalanceThreshold(String(preferences.low_balance_threshold_minor ?? 5000));
      } else if (profileResult && !profileResult.ok) {
        setPreferenceError(profileResult.message || 'Could not load notification preferences.');
      }
    } catch (error) {
      setPreferenceError(error instanceof Error ? error.message : 'Network error loading notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isPassenger]);

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

  const handleMarkRead = async (id: string) => {
    try {
      const result = await markNotificationRead(id);
      if (!result.ok) {
        Alert.alert('Notification not updated', result.message || 'Please try again.');
        return;
      }
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
      );
    } catch (error) {
      Alert.alert('Notification not updated', error instanceof Error ? error.message : 'Network error.');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const result = await markAllNotificationsRead();
      if (!result.ok) {
        Alert.alert('Notifications not updated', result.message || 'Please try again.');
        return;
      }
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: new Date().toISOString() })),
      );
    } catch (error) {
      Alert.alert('Notifications not updated', error instanceof Error ? error.message : 'Network error.');
    }
  };

  const savePreferences = async () => {
    const thresholdMinor = Number(lowBalanceThreshold);
    if (!Number.isSafeInteger(thresholdMinor) || thresholdMinor < 1 || thresholdMinor > 10000000) {
      setPreferenceError('Set a whole-paisa threshold from 1 to 10000000 when alerts are enabled.');
      return;
    }
    setSavingPreferences(true);
    setPreferenceError(null);
    try {
      const result = await updateProfile({
        preferences: {
          low_balance_alerts_enabled: lowBalanceEnabled,
          low_balance_threshold_minor: thresholdMinor,
        },
      });
      if (!result.ok) {
        setPreferenceError(result.message || 'Could not save notification preferences.');
        return;
      }
      Alert.alert('Preferences saved', lowBalanceEnabled
        ? `You will be notified when your wallet falls below NPR ${(thresholdMinor / 100).toFixed(2)}.`
        : 'Low-balance notifications are turned off.');
    } catch (error) {
      setPreferenceError(error instanceof Error ? error.message : 'Network error saving preferences.');
    } finally {
      setSavingPreferences(false);
    }
  };

  const enablePush = async () => {
    setRegisteringPush(true);
    setPreferenceError(null);
    try {
      const result = await registerCurrentDeviceForFcm(true);
      if (!result.ok) {
        setPushEnabled(false);
        setPreferenceError(result.message);
        return;
      }
      setPushEnabled(true);
    } catch (error) {
      setPreferenceError(error instanceof Error ? error.message : 'FCM push registration failed.');
    } finally {
      setRegisteringPush(false);
    }
  };

  const openNotification = async (item: NotificationItem) => {
    if (!item.read_at) await handleMarkRead(item.id);
    const resource = (item.resource ?? item.data?.resource) as Record<string, unknown> | undefined;
    router.push(fcmDestination({
      ...(item.data ?? {}),
      eventType: item.data?.event_type ?? item.type,
      resourceType: typeof resource?.type === 'string' ? resource.type : undefined,
      resourceReference: typeof resource?.reference === 'string' ? resource.reference : undefined,
    }) as never);
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <SymbolView
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            size={18}
            tintColor={Monochrome.textPrimary}
          />
        </Pressable>
        <AppText style={styles.headerTitle}>Notifications</AppText>
        {unreadCount > 0 ? (
          <Pressable onPress={handleMarkAllRead} style={styles.markAllBtn}>
            <AppText style={styles.markAllText}>Mark all read</AppText>
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadNotifications(true)}
            tintColor={Monochrome.textPrimary}
          />
        }
      >
        <View style={styles.preferenceCard}>
          {isPassenger ? (
            <>
              <View style={styles.preferenceTitleRow}>
                <View style={styles.preferenceCopy}>
                  <AppText style={styles.preferenceTitle}>Low wallet balance</AppText>
                  <AppText style={styles.preferenceDescription}>In-app alert when a fare payment takes your balance below the threshold.</AppText>
                </View>
                <Switch
                  accessibilityLabel="Enable low wallet balance alerts"
                  value={lowBalanceEnabled}
                  onValueChange={setLowBalanceEnabled}
                  trackColor={{ false: Monochrome.border, true: Monochrome.textSecondary }}
                  thumbColor={Monochrome.textPrimary}
                />
              </View>
              <AppText style={styles.preferenceLabel}>Alert below (paisa)</AppText>
              <AppTextInput
                accessibilityLabel="Low balance threshold in paisa"
                style={styles.thresholdInput}
                value={lowBalanceThreshold}
                onChangeText={setLowBalanceThreshold}
                keyboardType="number-pad"
                editable={!savingPreferences}
              />
              <AppText style={styles.preferenceHint}>For example, 5000 paisa equals NPR 50.00. In-app history is available even when push is disabled.</AppText>
            </>
          ) : null}
          <View style={styles.pushRow}>
            <View style={styles.preferenceCopy}>
              <AppText style={styles.preferenceTitle}>Device push notifications</AppText>
              <AppText style={styles.preferenceDescription}>
                {pushEnabled ? 'Push permission is enabled on this device.' : 'Enable optional push alerts for account updates.'}
              </AppText>
            </View>
            {!pushEnabled ? (
              <Pressable
                accessibilityRole="button"
                disabled={registeringPush}
                onPress={() => void enablePush()}
                style={[styles.pushButton, registeringPush && styles.disabledButton]}
              >
                {registeringPush
                  ? <ActivityIndicator color={Monochrome.actionPrimaryText} />
                  : <AppText style={styles.savePreferencesText}>Enable</AppText>}
              </Pressable>
            ) : null}
          </View>
          {preferenceError ? <AppText accessibilityRole="alert" style={styles.preferenceError}>{preferenceError}</AppText> : null}
          {isPassenger ? (
            <Pressable accessibilityRole="button" disabled={savingPreferences} onPress={() => void savePreferences()} style={[styles.savePreferencesButton, savingPreferences && styles.disabledButton]}>
              {savingPreferences ? <ActivityIndicator color={Monochrome.actionPrimaryText} /> : <AppText style={styles.savePreferencesText}>Save preferences</AppText>}
            </Pressable>
          ) : null}
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Monochrome.textPrimary} />
            <AppText style={styles.loadingText}>Fetching updates...</AppText>
          </View>
        ) : notifications.length > 0 ? (
          <View style={styles.listCard}>
            {notifications.map((item, idx) => {
              const isUnread = !item.read_at;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => void openNotification(item)}
                  style={[styles.itemRow, idx > 0 && styles.rowDivider, isUnread && styles.unreadRow]}
                >
                  <View style={[styles.iconWrap, isUnread ? styles.iconUnread : styles.iconRead]}>
                    <SymbolView
                      name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
                      size={18}
                      tintColor={isUnread ? Monochrome.textPrimary : Monochrome.textMuted}
                    />
                  </View>

                  <View style={styles.contentWrap}>
                    <View style={styles.titleRow}>
                      <AppText style={[styles.itemTitle, isUnread && styles.itemTitleBold]}>
                        {item.title || 'Transit Alert'}
                      </AppText>
                      {isUnread && <View style={styles.unreadDot} />}
                    </View>
                    <AppText style={styles.itemBody}>{item.body || 'No details provided.'}</AppText>
                    <AppText style={styles.itemTime}>
                      {new Date(item.created_at).toLocaleString()}
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <SymbolView
              name={{ ios: 'bell.slash', android: 'notifications_off', web: 'notifications_off' }}
              size={40}
              tintColor={Monochrome.textMuted}
            />
            <AppText style={styles.emptyTitle}>All Caught Up</AppText>
            <AppText style={styles.emptySubtitle}>You have no unread notifications or transit alerts.</AppText>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Monochrome.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Monochrome.background,
    borderBottomWidth: 1,
    borderBottomColor: Monochrome.border,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  markAllBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
    borderRadius: 8,
  },
  markAllText: {
    fontSize: 12,
    color: Monochrome.textSecondary,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  loadingBox: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: 14,
    color: Monochrome.textSecondary,
  },
  preferenceCard: {
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  preferenceTitleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  preferenceCopy: { flex: 1, gap: 4 },
  preferenceTitle: { color: Monochrome.textPrimary, fontSize: 15, fontWeight: '700' },
  preferenceDescription: { color: Monochrome.textSecondary, fontSize: 12, lineHeight: 17 },
  preferenceLabel: { color: Monochrome.textSecondary, fontSize: 12, fontWeight: '700' },
  thresholdInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: Monochrome.border,
    borderRadius: 10,
    backgroundColor: Monochrome.surfacePrimary,
    color: Monochrome.textPrimary,
    paddingHorizontal: 12,
  },
  preferenceHint: { color: Monochrome.textMuted, fontSize: 11, lineHeight: 16 },
  pushRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.sm },
  pushButton: { minWidth: 82, minHeight: 40, borderRadius: 10, backgroundColor: Monochrome.actionPrimary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.sm },
  preferenceError: { color: Monochrome.textPrimary, fontSize: 12 },
  savePreferencesButton: { minHeight: 44, borderRadius: 11, backgroundColor: Monochrome.actionPrimary, alignItems: 'center', justifyContent: 'center' },
  disabledButton: { opacity: 0.55 },
  savePreferencesText: { color: Monochrome.actionPrimaryText, fontSize: 13, fontWeight: '700' },
  listCard: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Monochrome.border,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: 12,
    alignItems: 'flex-start',
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: Monochrome.border,
  },
  unreadRow: {
    backgroundColor: Monochrome.surfaceElevated,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginTop: 2,
  },
  iconUnread: {
    backgroundColor: Monochrome.surfaceElevated,
    borderColor: Monochrome.border,
  },
  iconRead: {
    backgroundColor: Monochrome.surfacePrimary,
    borderColor: Monochrome.border,
  },
  contentWrap: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemTitle: {
    fontSize: 15,
    color: Monochrome.textSecondary,
    fontWeight: '600',
  },
  itemTitleBold: {
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Monochrome.textPrimary,
  },
  itemBody: {
    fontSize: 13,
    color: Monochrome.textSecondary,
    lineHeight: 18,
  },
  itemTime: {
    fontSize: 11,
    color: Monochrome.textMuted,
    marginTop: 2,
  },
  emptyBox: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 20,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Monochrome.border,
    marginTop: Spacing.md,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Monochrome.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
