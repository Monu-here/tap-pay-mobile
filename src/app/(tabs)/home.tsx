import { AppText } from '@/components/typography/app-text';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { Monochrome, Spacing } from '@/constants/theme';
import {
  getDashboard,
  getUnreadNotificationCount,
  getRoutes,
  type DashboardData,
  type RouteInfo,
  type TravelRecord,
  type WalletTransaction,
} from '@/features/passenger/services/passengerApi';
import { getSession } from '@/features/auth/session';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const session = getSession();

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [activityTab, setActivityTab] = useState<'trips' | 'wallet'>('trips');

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [dashRes, routesRes, notifRes] = await Promise.allSettled([
        getDashboard(),
        getRoutes(),
        getUnreadNotificationCount(),
      ]);

      if (dashRes.status === 'fulfilled' && dashRes.value.ok && dashRes.value.data) {
        setDashboard(dashRes.value.data);
      } else if (dashRes.status === 'fulfilled' && !dashRes.value.ok) {
        setError(dashRes.value.message || 'Unable to sync dashboard data.');
      }

      if (routesRes.status === 'fulfilled' && routesRes.value.ok && routesRes.value.data?.routes) {
        setRoutes(routesRes.value.data.routes.slice(0, 3));
      }

      if (notifRes.status === 'fulfilled' && notifRes.value.ok && notifRes.value.data) {
        setUnreadNotifications(notifRes.value.data.unread_count);
      }
    } catch {
      setError('Connection failure. Please check your internet connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void fetchData();
    });
    return () => cancelAnimationFrame(frame);
  }, [fetchData]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void fetchData(true);
    });
    return () => subscription.remove();
  }, [fetchData]);

  const userName = session.user?.name || (dashboard?.user as any)?.name || 'Passenger';
  const userType = session.user?.type || (dashboard?.user as any)?.type;
  const isPrivileged = userType === 'super_admin' || userType === 'company_admin' || userType === 'driver';

  const formatNpr = (formatted?: string | null, minor?: number): string => {
    if (formatted) {
      if (formatted.startsWith('NPR') || formatted.startsWith('Rs.')) return formatted;
      return `NPR ${formatted}`;
    }
    if (typeof minor === 'number') {
      return `NPR ${(minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return 'NPR 0.00';
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Header Section */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(tabs)/profile' as any)}
          style={styles.profileButton}
        >
          <View style={styles.avatar}>
            <AppText style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</AppText>
          </View>
          <View style={styles.greetingWrap}>
            <View style={styles.brandRow}>
              <AppText style={styles.brandName}>TAP &amp; PAY</AppText>
              <View style={styles.brandBadge}>
                <AppText style={styles.brandBadgeText}>TRANSIT</AppText>
              </View>
            </View>
            <AppText style={styles.userName} numberOfLines={1}>
              {userName}
            </AppText>
          </View>
        </Pressable>

        <View style={styles.headerRightActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/notifications' as any)}
            style={styles.headerIconButton}
            hitSlop={8}
          >
            <SymbolView
              name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
              size={18}
              tintColor={Monochrome.textPrimary}
            />
            {unreadNotifications > 0 && (
              <View style={styles.unreadBadge}>
                <AppText style={styles.unreadBadgeText}>
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </AppText>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchData(true)}
            tintColor={Monochrome.textPrimary}
          />
        }
      >
        {/* Privileged Role Switcher */}
        {isPrivileged && (
          <Pressable
            onPress={() => {
              if (userType === 'super_admin') router.push('/portal/admin' as any);
              else if (userType === 'company_admin') router.push('/portal/company' as any);
              else if (userType === 'driver') router.push('/portal/driver' as any);
            }}
            style={styles.portalBanner}
          >
            <View style={styles.portalBannerLeft}>
              <SymbolView
                name={{ ios: 'shield.fill', android: 'admin_panel_settings', web: 'admin_panel_settings' }}
                size={16}
                tintColor={Monochrome.textPrimary}
              />
              <AppText style={styles.portalBannerText}>
                Access {userType === 'super_admin' ? 'Super Admin' : userType === 'company_admin' ? 'Company Fleet' : 'Driver'} Portal
              </AppText>
            </View>
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              size={14}
              tintColor={Monochrome.textSecondary}
            />
          </Pressable>
        )}

        {/* Error State */}
        {error && !loading && (
          <View style={styles.errorBox}>
            <View style={styles.errorTextRow}>
              <SymbolView
                name={{ ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' }}
                size={16}
                tintColor={Monochrome.textPrimary}
              />
              <AppText style={styles.errorText}>{error}</AppText>
            </View>
            <Pressable onPress={() => fetchData()} style={styles.retryButton}>
              <AppText style={styles.retryText}>Retry</AppText>
            </Pressable>
          </View>
        )}

        {/* Loading Indicator */}
        {loading && !refreshing && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={Monochrome.textPrimary} />
            <AppText style={styles.loadingText}>Syncing wallet &amp; transit services...</AppText>
          </View>
        )}

        {/* Virtual Wallet Card (Fasset style black card) */}
        <View style={styles.walletCard}>
          <View style={styles.walletTopRow}>
            <View style={styles.walletLabelGroup}>
              <View style={styles.walletDot} />
              <AppText style={styles.walletLabel}>TAP &amp; PAY DIGITAL WALLET</AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setBalanceVisible((prev) => !prev)}
              style={styles.eyeButton}
              hitSlop={8}
            >
              <SymbolView
                name={{
                  ios: balanceVisible ? 'eye.fill' : 'eye.slash.fill',
                  android: balanceVisible ? 'visibility' : 'visibility_off',
                  web: balanceVisible ? 'visibility' : 'visibility_off',
                }}
                size={16}
                tintColor={Monochrome.textSecondary}
              />
              <AppText style={styles.eyeButtonText}>{balanceVisible ? 'Hide' : 'Show'}</AppText>
            </Pressable>
          </View>

          <View style={styles.balanceWrap}>
            <AppText style={styles.balanceAmount}>
              {balanceVisible
                ? formatNpr(dashboard?.wallet.balance_formatted, dashboard?.wallet.balance_minor)
                : '••••••••'}
            </AppText>
            <AppText style={styles.balanceCurrencyTag}>NPR • Contactless Transit</AppText>
          </View>

          {/* Quick Actions */}
          <View style={styles.walletActionRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(tabs)/wallet' as any)}
              style={[styles.walletActionBtn, styles.walletActionPrimary]}
            >
              <SymbolView
                name={{ ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' }}
                size={16}
                tintColor={Monochrome.actionPrimaryText}
              />
              <AppText style={styles.walletActionPrimaryText}>Add Money</AppText>
            </Pressable>

            

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(tabs)/wallet' as any)}
              style={[styles.walletActionBtn, styles.walletActionSecondary]}
            >
              <SymbolView
                name={{ ios: 'list.bullet.rectangle.portrait.fill', android: 'receipt_long', web: 'receipt_long' }}
                size={16}
                tintColor={Monochrome.textPrimary}
              />
              <AppText style={styles.walletActionSecondaryText}>Ledger</AppText>
            </Pressable>
          </View>
        </View>

        {/* Primary Payment Hero Action */}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/passenger/pay' as any)}
          style={styles.heroScanButton}
        >
          <View style={styles.heroScanLeft}>
            <View style={styles.heroScanIconBox}>
              <SymbolView
                name={{ ios: 'qrcode.viewfinder', android: 'qr_code_scanner', web: 'qr_code_scanner' }}
                size={24}
                tintColor={Monochrome.textPrimary}
              />
            </View>
            <View style={styles.heroScanTextWrap}>
              <AppText style={styles.heroScanTitle}>Scan Driver QR to Pay</AppText>
              <AppText style={styles.heroScanSubtitle}>
                Instant contactless transit fare payment
              </AppText>
            </View>
          </View>
          <View style={styles.heroScanArrow}>
            <SymbolView
              name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
              size={16}
              tintColor={Monochrome.textPrimary}
            />
          </View>
        </Pressable>

        {/* Payment Actions Grid */}
        <View style={styles.actionsGrid}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/passenger/qr' as any)}
            style={styles.actionGridCard}
          >
            <View style={styles.actionIconBox}>
              <SymbolView
                name={{ ios: 'qrcode', android: 'qr_code', web: 'qr_code' }}
                size={20}
                tintColor={Monochrome.textPrimary}
              />
            </View>
            <AppText style={styles.actionCardTitle}>My QR Pass</AppText>
            <AppText style={styles.actionCardDesc}>Show to driver</AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(tabs)/wallet' as any)}
            style={styles.actionGridCard}
          >
            <View style={styles.actionIconBox}>
              <SymbolView
                name={{ ios: 'creditcard.fill', android: 'payments', web: 'payments' }}
                size={20}
                tintColor={Monochrome.textPrimary}
              />
            </View>
            <AppText style={styles.actionCardTitle}>Top Up</AppText>
            <AppText style={styles.actionCardDesc}>eSewa / Khalti</AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/travel' as any)}
            style={styles.actionGridCard}
          >
            <View style={styles.actionIconBox}>
              <SymbolView
                name={{ ios: 'ticket.fill', android: 'confirmation_number', web: 'confirmation_number' }}
                size={20}
                tintColor={Monochrome.textPrimary}
              />
            </View>
            <AppText style={styles.actionCardTitle}>My Tickets</AppText>
            <AppText style={styles.actionCardDesc}>Trip receipts</AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(tabs)/cards' as any)}
            style={styles.actionGridCard}
          >
            <View style={styles.actionIconBox}>
              <SymbolView
                name={{ ios: 'wave.3.right', android: 'nfc', web: 'nfc' }}
                size={20}
                tintColor={Monochrome.textPrimary}
              />
            </View>
            <AppText style={styles.actionCardTitle}>Transit Cards</AppText>
            <AppText style={styles.actionCardDesc}>Manage travel cards</AppText>
          </Pressable>
        </View>

        {/* Travel & Transit Section */}
        <View style={styles.sectionHeader}>
          <View>
            <AppText style={styles.sectionTitle}>Transit Routes</AppText>
            <AppText style={styles.sectionSubtitle}>Public transit network</AppText>
          </View>
          <Pressable onPress={() => router.push('/(tabs)/transit' as any)}>
            <AppText style={styles.viewAllText}>View All ›</AppText>
          </Pressable>
        </View>

        {routes.length > 0 ? (
          <View style={styles.routesContainer}>
            {routes.map((route) => (
              <Pressable
                key={route.id}
                onPress={() => router.push('/(tabs)/transit' as any)}
                style={styles.routeItemCard}
              >
                <View style={styles.routeIconBox}>
                  <SymbolView
                    name={{ ios: 'bus.fill', android: 'directions_bus', web: 'directions_bus' }}
                    size={18}
                    tintColor={Monochrome.textPrimary}
                  />
                </View>
                <View style={styles.routeInfoWrap}>
                  <View style={styles.routeCodeRow}>
                    <AppText style={styles.routeCodeBadge}>{route.code || 'ROUTE'}</AppText>
                    {Boolean(route.company_name) && (
                      <AppText style={styles.routeCompanyText}>{route.company_name}</AppText>
                    )}
                  </View>
                  <AppText style={styles.routeNameText}>{route.name}</AppText>
                  <AppText style={styles.routeStopsText}>
                    {route.origin_stop && route.destination_stop
                      ? `${route.origin_stop} ⇄ ${route.destination_stop}`
                      : 'Kathmandu Transit Route'}
                  </AppText>
                </View>
                <SymbolView
                  name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                  size={14}
                  tintColor={Monochrome.textMuted}
                />
              </Pressable>
            ))}

            <Pressable
              onPress={() => router.push('/passenger/tracking' as any)}
              style={styles.liveTrackingBanner}
            >
              <SymbolView
                name={{ ios: 'location.north.line.fill', android: 'near_me', web: 'near_me' }}
                size={16}
                tintColor={Monochrome.textPrimary}
              />
              <AppText style={styles.liveTrackingText}>
                Open Live GPS Bus Tracking Map
              </AppText>
            </Pressable>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <AppText style={styles.emptyCardText}>No transit routes found nearby</AppText>
          </View>
        )}

        {/* Recent Activity */}
        <View style={styles.sectionHeader}>
          <AppText style={styles.sectionTitle}>Recent Activity</AppText>
          <Pressable
            onPress={() => {
              if (activityTab === 'trips') router.push('/travel' as any);
              else router.push('/(tabs)/wallet' as any);
            }}
          >
            <AppText style={styles.viewAllText}>
              {activityTab === 'trips' ? 'All Journeys ›' : 'Full Ledger ›'}
            </AppText>
          </Pressable>
        </View>

        {/* Segmented Filter */}
        <View style={styles.segmentedControl}>
          <Pressable
            onPress={() => setActivityTab('trips')}
            style={[styles.segmentBtn, activityTab === 'trips' && styles.segmentBtnActive]}
          >
            <AppText
              style={[
                styles.segmentText,
                activityTab === 'trips' && styles.segmentTextActive,
              ]}
            >
              Bus Trips
            </AppText>
          </Pressable>
          <Pressable
            onPress={() => setActivityTab('wallet')}
            style={[styles.segmentBtn, activityTab === 'wallet' && styles.segmentBtnActive]}
          >
            <AppText
              style={[
                styles.segmentText,
                activityTab === 'wallet' && styles.segmentTextActive,
              ]}
            >
              Wallet Activity
            </AppText>
          </Pressable>
        </View>

        {/* Trips List */}
        {activityTab === 'trips' && (
          <View style={styles.activityCard}>
            {dashboard?.recent_trips && dashboard.recent_trips.length > 0 ? (
              dashboard.recent_trips.slice(0, 4).map((trip: TravelRecord, idx: number) => (
                <Pressable
                  key={trip.travel_uid || trip.id}
                  onPress={() => router.push(`/travel/${trip.travel_uid}` as any)}
                  style={[styles.activityRow, idx > 0 && styles.rowBorder]}
                >
                  <View style={styles.activityIconBox}>
                    <SymbolView
                      name={{ ios: 'bus.fill', android: 'directions_bus', web: 'directions_bus' }}
                      size={16}
                      tintColor={Monochrome.textPrimary}
                    />
                  </View>
                  <View style={styles.activityInfo}>
                    <AppText style={styles.activityTitle}>{trip.route_name || 'Bus Journey'}</AppText>
                    <AppText style={styles.activitySub}>
                      {trip.boarding_stop && trip.exit_stop
                        ? `${trip.boarding_stop} → ${trip.exit_stop}`
                        : trip.bus_number ? `Bus: ${trip.bus_number}` : 'Public Bus'}
                    </AppText>
                    <AppText style={styles.activityDate}>
                      {trip.boarded_at ? new Date(trip.boarded_at).toLocaleDateString() : 'Recent'}
                    </AppText>
                  </View>
                  <View style={styles.activityRight}>
                    <AppText style={styles.tripFareText}>
                      {formatNpr(trip.fare_formatted, trip.fare_minor)}
                    </AppText>
                    <View style={styles.statusBadge}>
                      <AppText style={styles.statusBadgeText}>Paid</AppText>
                    </View>
                  </View>
                </Pressable>
              ))
            ) : (
              <View style={styles.emptyListWrap}>
                <SymbolView
                  name={{ ios: 'ticket', android: 'confirmation_number', web: 'confirmation_number' }}
                  size={28}
                  tintColor={Monochrome.textMuted}
                />
                <AppText style={styles.emptyListText}>No recent bus trips recorded</AppText>
                <AppText style={styles.emptyListSub}>Scan a driver QR to pay your next fare</AppText>
              </View>
            )}
          </View>
        )}

        {/* Wallet Transactions List */}
        {activityTab === 'wallet' && (
          <View style={styles.activityCard}>
            {dashboard?.recent_transactions && dashboard.recent_transactions.length > 0 ? (
              dashboard.recent_transactions.slice(0, 4).map((txn: WalletTransaction, idx: number) => {
                const isCredit = txn.direction === 'credit';
                return (
                  <Pressable
                    key={txn.reference || txn.id}
                    onPress={() => router.push(`/wallet/transaction/${txn.reference}` as any)}
                    style={[styles.activityRow, idx > 0 && styles.rowBorder]}
                  >
                    <View style={styles.activityIconBox}>
                      <SymbolView
                        name={{
                          ios: isCredit ? 'arrow.down.left' : 'arrow.up.right',
                          android: isCredit ? 'arrow_downward' : 'arrow_upward',
                          web: isCredit ? 'arrow_downward' : 'arrow_upward',
                        }}
                        size={16}
                        tintColor={Monochrome.textPrimary}
                      />
                    </View>
                    <View style={styles.activityInfo}>
                      <AppText style={styles.activityTitle}>{txn.description || txn.type}</AppText>
                      <AppText style={styles.activityRef}>{txn.reference}</AppText>
                      <AppText style={styles.activityDate}>
                        {txn.created_at ? new Date(txn.created_at).toLocaleDateString() : 'Recent'}
                      </AppText>
                    </View>
                    <View style={styles.activityRight}>
                      <AppText style={styles.walletAmountText}>
                        {isCredit ? '+' : '-'}{formatNpr(undefined, txn.amount_minor)}
                      </AppText>
                      <View style={styles.statusBadge}>
                        <AppText style={styles.statusBadgeText}>{txn.status}</AppText>
                      </View>
                    </View>
                  </Pressable>
                );
              })
            ) : (
              <View style={styles.emptyListWrap}>
                <SymbolView
                  name={{ ios: 'creditcard', android: 'credit_card', web: 'credit_card' }}
                  size={28}
                  tintColor={Monochrome.textMuted}
                />
                <AppText style={styles.emptyListText}>No recent wallet transactions</AppText>
                <AppText style={styles.emptyListSub}>Add money using eSewa or Khalti</AppText>
              </View>
            )}
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
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    backgroundColor: Monochrome.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: Monochrome.border,
  },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Monochrome.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  greetingWrap: {
    flex: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandName: {
    fontSize: 11,
    fontWeight: '900',
    color: Monochrome.textPrimary,
    letterSpacing: 1.2,
  },
  brandBadge: {
    backgroundColor: Monochrome.surfaceElevated,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  brandBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: Monochrome.textSecondary,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: Monochrome.textPrimary,
    marginTop: 2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: Monochrome.actionPrimary,
    borderRadius: 7,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  unreadBadgeText: {
    color: Monochrome.actionPrimaryText,
    fontSize: 8,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.four,
  },
  portalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Monochrome.surfaceSecondary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  portalBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  portalBannerText: {
    color: Monochrome.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  errorText: {
    color: Monochrome.textPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: Monochrome.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  retryText: {
    color: Monochrome.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  loadingText: {
    color: Monochrome.textSecondary,
    fontSize: 13,
  },
  walletCard: {
    backgroundColor: Monochrome.surfacePrimary,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  walletTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walletLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  walletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Monochrome.textPrimary,
  },
  walletLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Monochrome.textSecondary,
    letterSpacing: 1.1,
  },
  eyeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Monochrome.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  eyeButtonText: {
    color: Monochrome.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  balanceWrap: {
    marginTop: 14,
    marginBottom: 18,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: Monochrome.textPrimary,
    letterSpacing: -0.5,
  },
  balanceCurrencyTag: {
    color: Monochrome.textMuted,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
  },
  walletActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  walletActionBtn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  walletActionPrimary: {
    backgroundColor: Monochrome.actionPrimary,
  },
  walletActionPrimaryText: {
    color: Monochrome.actionPrimaryText,
    fontSize: 13,
    fontWeight: '700',
  },
  walletActionSecondary: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  walletActionSecondaryText: {
    color: Monochrome.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  heroScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Monochrome.borderLight,
  },
  heroScanLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  heroScanIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroScanTextWrap: {
    flex: 1,
  },
  heroScanTitle: {
    color: Monochrome.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  heroScanSubtitle: {
    color: Monochrome.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  heroScanArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionGridCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  actionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  actionCardDesc: {
    fontSize: 11,
    color: Monochrome.textMuted,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Monochrome.textMuted,
    marginTop: 2,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: Monochrome.textSecondary,
  },
  routesContainer: {
    gap: 10,
  },
  routeItemCard: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  routeIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeInfoWrap: {
    flex: 1,
  },
  routeCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routeCodeBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: Monochrome.textPrimary,
    backgroundColor: Monochrome.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  routeCompanyText: {
    fontSize: 11,
    color: Monochrome.textMuted,
  },
  routeNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: Monochrome.textPrimary,
    marginTop: 2,
  },
  routeStopsText: {
    fontSize: 12,
    color: Monochrome.textSecondary,
    marginTop: 2,
  },
  liveTrackingBanner: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  liveTrackingText: {
    color: Monochrome.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  emptyCardText: {
    color: Monochrome.textMuted,
    fontSize: 13,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  segmentBtnActive: {
    backgroundColor: Monochrome.surfaceElevated,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '500',
    color: Monochrome.textMuted,
  },
  segmentTextActive: {
    color: Monochrome.textPrimary,
    fontWeight: '700',
  },
  activityCard: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: Monochrome.surfaceElevated,
  },
  activityIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Monochrome.textPrimary,
  },
  activitySub: {
    fontSize: 12,
    color: Monochrome.textSecondary,
    marginTop: 2,
  },
  activityRef: {
    fontSize: 11,
    color: Monochrome.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  activityDate: {
    fontSize: 11,
    color: Monochrome.textMuted,
    marginTop: 2,
  },
  activityRight: {
    alignItems: 'flex-end',
  },
  tripFareText: {
    fontSize: 14,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  statusBadge: {
    backgroundColor: Monochrome.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Monochrome.textSecondary,
    textTransform: 'capitalize',
  },
  walletAmountText: {
    fontSize: 14,
    fontWeight: '700',
    color: Monochrome.textPrimary,
  },
  emptyListWrap: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  emptyListText: {
    fontSize: 14,
    fontWeight: '600',
    color: Monochrome.textPrimary,
  },
  emptyListSub: {
    fontSize: 12,
    color: Monochrome.textMuted,
  },
});
