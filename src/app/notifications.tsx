import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { Brand, Spacing } from '@/constants/theme';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@/features/passenger/services/passengerApi';

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await getNotifications();
      if (res.ok && res.data) {
        setNotifications(res.data.notifications || []);
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
      );
    } catch {
      // Ignored
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: new Date().toISOString() })),
      );
    } catch {
      // Ignored
    }
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
            size={22}
            tintColor={Brand.text}
          />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 ? (
          <Pressable onPress={handleMarkAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadNotifications(true)} tintColor={Brand.teal.primary} />
        }
      >
        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Brand.teal.primary} />
            <Text style={styles.loadingText}>Fetching updates...</Text>
          </View>
        ) : notifications.length > 0 ? (
          <View style={styles.listCard}>
            {notifications.map((item, idx) => {
              const isUnread = !item.read_at;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => isUnread && handleMarkRead(item.id)}
                  style={[styles.itemRow, idx > 0 && styles.rowDivider, isUnread && styles.unreadRow]}
                >
                  <View style={[styles.iconWrap, isUnread ? styles.iconUnread : styles.iconRead]}>
                    <SymbolView
                      name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
                      size={18}
                      tintColor={isUnread ? Brand.teal.primary : Brand.textSecondary}
                    />
                  </View>

                  <View style={styles.contentWrap}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.itemTitle, isUnread && styles.itemTitleBold]}>
                        {item.title || 'Transit Alert'}
                      </Text>
                      {isUnread && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.itemBody}>{item.body || 'No details provided.'}</Text>
                    <Text style={styles.itemTime}>
                      {new Date(item.created_at).toLocaleString()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <SymbolView
              name={{ ios: 'bell.slash', android: 'notifications_off', web: 'notifications_off' }}
              size={44}
              tintColor={Brand.textSecondary}
            />
            <Text style={styles.emptyTitle}>All Caught Up</Text>
            <Text style={styles.emptySubtitle}>You have no unread notifications or transit alerts.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    backgroundColor: Brand.white,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    padding: Spacing.one,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Brand.text,
  },
  markAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  markAllText: {
    fontSize: 13,
    color: Brand.primary,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  loadingBox: {
    padding: Spacing.six,
    alignItems: 'center',
    gap: Spacing.two,
  },
  loadingText: {
    fontSize: 14,
    color: Brand.textSecondary,
  },
  listCard: {
    backgroundColor: Brand.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'flex-start',
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  unreadRow: {
    backgroundColor: '#F0FDFA',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  iconUnread: {
    backgroundColor: Brand.teal.soft,
  },
  iconRead: {
    backgroundColor: '#F1F5F9',
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
    color: Brand.text,
    fontWeight: '600',
  },
  itemTitleBold: {
    fontWeight: '700',
    color: '#0F172A',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Brand.teal.primary,
  },
  itemBody: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  itemTime: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  emptyBox: {
    backgroundColor: Brand.white,
    borderRadius: 16,
    padding: Spacing.six,
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: Spacing.four,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Brand.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Brand.textSecondary,
    textAlign: 'center',
  },
});
