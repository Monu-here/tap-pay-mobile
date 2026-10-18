import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
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
import { getDashboard, type DashboardData, type TravelRecord, type WalletTransaction } from '@/features/passenger/services/passengerApi';
import { getSession } from '@/features/auth/session';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const session = getSession();

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balanceVisible, setBalanceVisible] = useState(true);

  const fetchDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await getDashboard();
      if (res.ok && res.data) {
        setDashboard(res.data);
      } else {
        setError(res.message || 'Unable to load dashboard.');
      }
    } catch {
      setError('Connection failure. Check backend connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const userName = session.user?.name || (dashboard?.user as any)?.name || 'Passenger';
  const userType = session.user?.type || (dashboard?.user as any)?.type;
  const isPrivileged = userType === 'super_admin' || userType === 'company_admin' || userType === 'driver';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Header Bar */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName} numberOfLines={1}>{userName}</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/passenger/qr' as any)}
            style={styles.iconButton}
          >
            <SymbolView
              name={{ ios: 'qrcode', android: 'qr_code', web: 'qr_code' }}
              size={22}
              tintColor={Brand.teal.primary}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/notifications' as any)}
            style={styles.iconButton}
          >
            <SymbolView
              name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
              size={22}
              tintColor={Brand.text}
            />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchDashboard(true)} tintColor={Brand.teal.primary} />
        }
      >
        {/* Privileged Role Banner */}
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
                size={20}
                tintColor={Brand.white}
              />
              <Text style={styles.portalBannerText}>
                Access {userType === 'super_admin' ? 'Super-Admin' : userType === 'company_admin' ? 'Company Fleet' : 'Driver'} Portal
              </Text>
            </View>
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              size={18}
              tintColor={Brand.white}
            />
          </Pressable>
        )}

        {/* Loading State */}
        {loading && !refreshing && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Brand.teal.primary} />
            <Text style={styles.loadingText}>Syncing wallet & transit records...</Text>
          </View>
        )}

        {/* Error State */}
        {error && !loading && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => fetchDashboard()} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry Sync</Text>
            </Pressable>
          </View>
        )}

        {/* Balance & Wallet Card */}
        <View style={styles.walletCard}>
          <View style={styles.walletHeader}>
            <View style={styles.walletLabelGroup}>
              <SymbolView
                name={{ ios: 'wallet.pass.fill', android: 'account_balance_wallet', web: 'account_balance_wallet' }}
                size={18}
                tintColor={Brand.white}
              />
              <Text style={styles.walletLabel}>TAP & PAY DIGITAL WALLET</Text>
            </View>
            <Pressable onPress={() => setBalanceVisible(!balanceVisible)} hitSlop={8}>
              <SymbolView
                name={{
                  ios: balanceVisible ? 'eye.fill' : 'eye.slash.fill',
                  android: balanceVisible ? 'visibility' : 'visibility_off',
                  web: balanceVisible ? 'visibility' : 'visibility_off',
                }}
                size={20}
                tintColor={Brand.white}
              />
            </Pressable>
          </View>

          <Text style={styles.balanceAmount}>
            {balanceVisible
              ? (dashboard?.wallet.balance_formatted || 'Rs. 0.00')
              : '••••••••'}
          </Text>

          <View style={styles.walletActions}>
            <Pressable
              onPress={() => router.push('/passenger/qr' as any)}
              style={[styles.walletButton, { backgroundColor: Brand.teal.primary }]}
            >
              <SymbolView
                name={{ ios: 'qrcode', android: 'qr_code', web: 'qr_code' }}
                size={18}
                tintColor={Brand.white}
              />
              <Text style={[styles.walletButtonTextSecondary, { fontWeight: '700' }]}>My QR Pass</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/(tabs)/wallet' as any)}
              style={[styles.walletButton, styles.walletButtonPrimary]}
            >
              <SymbolView
                name={{ ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' }}
                size={18}
                tintColor={Brand.teal.text}
              />
              <Text style={styles.walletButtonTextPrimary}>Add Money</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/(tabs)/cards' as any)}
              style={[styles.walletButton, styles.walletButtonSecondary]}
            >
              <SymbolView
                name={{ ios: 'creditcard.fill', android: 'credit_card', web: 'credit_card' }}
                size={18}
                tintColor={Brand.white}
              />
              <Text style={styles.walletButtonTextSecondary}>Cards</Text>
            </Pressable>
          </View>
        </View>

        {/* Primary NFC Card Badge */}
        {dashboard?.primary_card ? (
          <View style={styles.primaryCardBox}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconGroup}>
                <SymbolView
                  name={{ ios: 'wave.3.right.circle.fill', android: 'nfc', web: 'nfc' }}
                  size={24}
                  tintColor={Brand.teal.primary}
                />
                <View>
                  <Text style={styles.cardTitle}>{dashboard.primary_card.label || 'Primary Travel Card'}</Text>
                  <Text style={styles.cardSubtitle}>
                    {dashboard.primary_card.last_four ? `•••• ${dashboard.primary_card.last_four}` : dashboard.primary_card.uid}
                  </Text>
                </View>
              </View>
              <View style={[
                styles.statusPill,
                dashboard.primary_card.status === 'active' ? styles.statusPillActive : styles.statusPillInactive,
              ]}>
                <Text style={styles.statusPillText}>{dashboard.primary_card.status.toUpperCase()}</Text>
              </View>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => router.push('/(tabs)/cards' as any)} style={styles.noCardBox}>
            <SymbolView
              name={{ ios: 'creditcard.and.123', android: 'add_card', web: 'add_card' }}
              size={24}
              tintColor={Brand.primary}
            />
            <View style={styles.noCardTextGroup}>
              <Text style={styles.noCardTitle}>No NFC Card Registered</Text>
              <Text style={styles.noCardSubtitle}>Tap to link an NFC card for instant bus boarding</Text>
            </View>
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              size={18}
              tintColor={Brand.textSecondary}
            />
          </Pressable>
        )}

        {/* Quick Action Shortcuts Grid */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Transit Services</Text>
        </View>

        <View style={styles.shortcutsGrid}>
          <Pressable onPress={() => router.push('/passenger/qr' as any)} style={styles.shortcutItem}>
            <View style={[styles.shortcutIcon, { backgroundColor: '#CCFBF1' }]}>
              <SymbolView
                name={{ ios: 'qrcode', android: 'qr_code', web: 'qr_code' }}
                size={22}
                tintColor={Brand.teal.primary}
              />
            </View>
            <Text style={styles.shortcutLabel}>My QR</Text>
          </Pressable>

          <Pressable onPress={() => router.push('/passenger/pay' as any)} style={styles.shortcutItem}>
            <View style={[styles.shortcutIcon, { backgroundColor: '#CCFBF1' }]}>
              <SymbolView
                name={{ ios: 'qrcode.viewfinder', android: 'qr_code_scanner', web: 'qr_code_scanner' }}
                size={22}
                tintColor={Brand.teal.primary}
              />
            </View>
            <Text style={styles.shortcutLabel}>Pay Bus Fare</Text>
          </Pressable>

          <Pressable onPress={() => router.push('/(tabs)/transit' as any)} style={styles.shortcutItem}>
            <View style={[styles.shortcutIcon, { backgroundColor: '#E0F2FE' }]}>
              <SymbolView
                name={{ ios: 'bus.fill', android: 'directions_bus', web: 'directions_bus' }}
                size={22}
                tintColor="#0284C7"
              />
            </View>
            <Text style={styles.shortcutLabel}>Bus Routes</Text>
          </Pressable>

          <Pressable onPress={() => router.push('/(tabs)/wallet' as any)} style={styles.shortcutItem}>
            <View style={[styles.shortcutIcon, { backgroundColor: '#DCFCE7' }]}>
              <SymbolView
                name={{ ios: 'arrow.left.arrow.right', android: 'sync_alt', web: 'sync_alt' }}
                size={22}
                tintColor="#16A34A"
              />
            </View>
            <Text style={styles.shortcutLabel}>Transactions</Text>
          </Pressable>

          <Pressable onPress={() => router.push('/travel' as any)} style={styles.shortcutItem}>
            <View style={[styles.shortcutIcon, { backgroundColor: '#F3E8FF' }]}>
              <SymbolView
                name={{ ios: 'clock.fill', android: 'history', web: 'history' }}
                size={22}
                tintColor="#9333EA"
              />
            </View>
            <Text style={styles.shortcutLabel}>Travel History</Text>
          </Pressable>

          <Pressable onPress={() => router.push('/(tabs)/cards' as any)} style={styles.shortcutItem}>
            <View style={[styles.shortcutIcon, { backgroundColor: '#FEF3C7' }]}>
              <SymbolView
                name={{ ios: 'creditcard.fill', android: 'credit_card', web: 'credit_card' }}
                size={22}
                tintColor="#D97706"
              />
            </View>
            <Text style={styles.shortcutLabel}>Cards</Text>
          </Pressable>

          <Pressable onPress={() => router.push('/passenger/tracking' as any)} style={styles.shortcutItem}>
            <View style={[styles.shortcutIcon, { backgroundColor: '#DBEAFE' }]}>
              <SymbolView
                name={{ ios: 'map.fill', android: 'map', web: 'map' }}
                size={22}
                tintColor="#2563EB"
              />
            </View>
            <Text style={styles.shortcutLabel}>Live Bus Tracking</Text>
          </Pressable>
        </View>

        {/* Monthly Activity Stats */}
        {dashboard?.stats && (
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{dashboard.stats.total_trips}</Text>
              <Text style={styles.statLabel}>Trips Completed</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{dashboard.stats.monthly_spent_formatted || 'Rs. 0'}</Text>
              <Text style={styles.statLabel}>Monthly Transit</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{dashboard.stats.active_cards_count}</Text>
              <Text style={styles.statLabel}>Active Cards</Text>
            </View>
          </View>
        )}

        {/* Recent Trips Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Journeys</Text>
          <Pressable onPress={() => router.push('/travel' as any)}>
            <Text style={styles.viewAllText}>View All</Text>
          </Pressable>
        </View>

        {dashboard?.recent_trips && dashboard.recent_trips.length > 0 ? (
          <View style={styles.listCard}>
            {dashboard.recent_trips.slice(0, 4).map((trip: TravelRecord, index: number) => (
              <Pressable
                key={trip.travel_uid || trip.id}
                onPress={() => router.push(`/travel/${trip.travel_uid}` as any)}
                style={[styles.listItem, index > 0 && styles.listDivider]}
              >
                <View style={styles.tripIconBox}>
                  <SymbolView
                    name={{ ios: 'bus.fill', android: 'directions_bus', web: 'directions_bus' }}
                    size={20}
                    tintColor={Brand.primary}
                  />
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle}>{trip.route_name || 'Transit Route'}</Text>
                  <Text style={styles.itemSubtitle}>
                    {trip.boarding_stop && trip.exit_stop
                      ? `${trip.boarding_stop} → ${trip.exit_stop}`
                      : trip.bus_number ? `Bus: ${trip.bus_number}` : 'Public Bus'}
                  </Text>
                  <Text style={styles.itemTime}>{trip.boarded_at ? new Date(trip.boarded_at).toLocaleDateString() : 'Recent'}</Text>
                </View>
                <View style={styles.itemRight}>
                  <Text style={styles.fareText}>
                    {trip.fare_formatted || `Rs. ${(trip.fare_minor / 100).toFixed(2)}`}
                  </Text>
                  <Text style={styles.statusCompleted}>Completed</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No recent bus journeys recorded</Text>
          </View>
        )}

        {/* Recent Wallet Transactions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Wallet Activity</Text>
          <Pressable onPress={() => router.push('/(tabs)/wallet' as any)}>
            <Text style={styles.viewAllText}>View Ledger</Text>
          </Pressable>
        </View>

        {dashboard?.recent_transactions && dashboard.recent_transactions.length > 0 ? (
          <View style={styles.listCard}>
            {dashboard.recent_transactions.slice(0, 4).map((txn: WalletTransaction, index: number) => {
              const isCredit = txn.direction === 'credit';
              return (
                <Pressable
                  key={txn.reference || txn.id}
                  onPress={() => router.push(`/wallet/transaction/${txn.reference}` as any)}
                  style={[styles.listItem, index > 0 && styles.listDivider]}
                >
                  <View style={[styles.tripIconBox, isCredit ? styles.iconBoxCredit : styles.iconBoxDebit]}>
                    <SymbolView
                      name={{
                        ios: isCredit ? 'arrow.down.left' : 'arrow.up.right',
                        android: isCredit ? 'arrow_downward' : 'arrow_upward',
                        web: isCredit ? 'arrow_downward' : 'arrow_upward',
                      }}
                      size={18}
                      tintColor={isCredit ? '#16A34A' : '#DC2626'}
                    />
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle}>{txn.description || txn.type}</Text>
                    <Text style={styles.itemSubtitle}>{txn.reference}</Text>
                  </View>
                  <View style={styles.itemRight}>
                    <Text style={[styles.amountText, isCredit ? styles.amountCredit : styles.amountDebit]}>
                      {isCredit ? '+' : '-'}Rs. {(txn.amount_minor / 100).toFixed(2)}
                    </Text>
                    <Text style={styles.txnStatus}>{txn.status}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No recent wallet transactions</Text>
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
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Brand.teal.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: Brand.white,
  },
  greeting: {
    fontSize: 12,
    color: Brand.textSecondary,
    fontWeight: '500',
  },
  userName: {
    fontSize: 17,
    fontWeight: '700',
    color: Brand.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.four,
  },
  portalBanner: {
    backgroundColor: Brand.primaryDark,
    borderRadius: 14,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  portalBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  portalBannerText: {
    color: Brand.white,
    fontSize: 14,
    fontWeight: '600',
  },
  loadingBox: {
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  loadingText: {
    fontSize: 13,
    color: Brand.textSecondary,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: Spacing.three,
    alignItems: 'center',
    gap: Spacing.two,
  },
  errorText: {
    color: Brand.error,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    backgroundColor: Brand.error,
    borderRadius: 8,
  },
  retryText: {
    color: Brand.white,
    fontSize: 13,
    fontWeight: '600',
  },
  walletCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walletLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  walletLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    color: '#94A3B8',
    fontWeight: '700',
  },
  balanceAmount: {
    fontSize: 34,
    fontWeight: '800',
    color: Brand.white,
    letterSpacing: -0.5,
    marginVertical: Spacing.one,
  },
  walletActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  walletButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: 12,
    borderRadius: 12,
  },
  walletButtonPrimary: {
    backgroundColor: Brand.teal.soft,
  },
  walletButtonTextPrimary: {
    color: Brand.teal.text,
    fontSize: 14,
    fontWeight: '700',
  },
  walletButtonSecondary: {
    backgroundColor: '#1E293B',
  },
  walletButtonTextSecondary: {
    color: Brand.white,
    fontSize: 14,
    fontWeight: '600',
  },
  primaryCardBox: {
    backgroundColor: Brand.white,
    borderRadius: 16,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardIconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.text,
  },
  cardSubtitle: {
    fontSize: 13,
    color: Brand.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusPillActive: {
    backgroundColor: '#DCFCE7',
  },
  statusPillInactive: {
    backgroundColor: '#FEE2E2',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  noCardBox: {
    backgroundColor: Brand.white,
    borderRadius: 16,
    padding: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  noCardTextGroup: {
    flex: 1,
  },
  noCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.text,
  },
  noCardSubtitle: {
    fontSize: 12,
    color: Brand.textSecondary,
    marginTop: 2,
  },
  sectionTitleRow: {
    marginTop: Spacing.one,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Brand.text,
  },
  viewAllText: {
    fontSize: 14,
    color: Brand.primary,
    fontWeight: '600',
  },
  shortcutsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  shortcutItem: {
    alignItems: 'center',
    gap: Spacing.one,
    flex: 1,
  },
  shortcutIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.text,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Brand.white,
    borderRadius: 16,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statNumber: {
    fontSize: 17,
    fontWeight: '700',
    color: Brand.text,
  },
  statLabel: {
    fontSize: 11,
    color: Brand.textSecondary,
  },
  statDivider: {
    width: 1,
    height: '60%',
    backgroundColor: '#E2E8F0',
  },
  listCard: {
    backgroundColor: Brand.white,
    borderRadius: 16,
    paddingHorizontal: Spacing.four,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  listDivider: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  tripIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxCredit: {
    backgroundColor: '#DCFCE7',
  },
  iconBoxDebit: {
    backgroundColor: '#FEE2E2',
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.text,
  },
  itemSubtitle: {
    fontSize: 12,
    color: Brand.textSecondary,
    marginTop: 2,
  },
  itemTime: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  fareText: {
    fontSize: 15,
    fontWeight: '700',
    color: Brand.text,
  },
  statusCompleted: {
    fontSize: 11,
    color: '#16A34A',
    fontWeight: '600',
    marginTop: 2,
  },
  amountText: {
    fontSize: 15,
    fontWeight: '700',
  },
  amountCredit: {
    color: '#16A34A',
  },
  amountDebit: {
    color: '#DC2626',
  },
  txnStatus: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  emptyCard: {
    backgroundColor: Brand.white,
    borderRadius: 16,
    padding: Spacing.five,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyText: {
    fontSize: 14,
    color: Brand.textSecondary,
  },
});
