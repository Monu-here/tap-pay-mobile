import { AppText, AppTextInput } from "@/components/typography/app-text";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";

import { AddMoneyModal } from "@/features/passenger/components/AddMoneyModal";
import { Palette, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  getDashboard,
  getUnreadNotificationCount,
  type DashboardData,
  type WalletTransaction,
  type TravelRecord,
} from "@/features/passenger/services/passengerApi";
import { getSession } from "@/features/auth/session";
import {
  getNearbyBuses,
  type PublicNearbyBus,
} from "@/features/transit/services/transitApi";

const NEARBY_REFRESH_INTERVAL_MS = 30_000;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const session = getSession();

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [nearbyBuses, setNearbyBuses] = useState<PublicNearbyBus[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(true);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState<boolean | null>(null);
  const [locationCanAskAgain, setLocationCanAskAgain] = useState(true);
  const nearbyLastRequestedAt = useRef(0);
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
  const [busSearchQuery, setBusSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [addMoneyVisible, setAddMoneyVisible] = useState(false);

  const loadNearbyBuses = useCallback(async (force = false, requestPermission = false) => {
    nearbyLastRequestedAt.current = Date.now();
    setNearbyLoading(true);
    setNearbyError(null);

    try {
      const permission = requestPermission
        ? await Location.requestForegroundPermissionsAsync()
        : await Location.getForegroundPermissionsAsync();
      setLocationPermissionGranted(permission.granted);
      setLocationCanAskAgain(permission.canAskAgain);

      if (!permission.granted) {
        setNearbyBuses([]);
        setNearbyError("Allow location access to see buses near you.");
        return;
      }
      if (!(await Location.hasServicesEnabledAsync())) {
        setNearbyBuses([]);
        setNearbyError("Location services are turned off. Enable GPS to find nearby buses.");
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const result = await getNearbyBuses(
        current.coords.latitude,
        current.coords.longitude,
        5,
      );
      if (!result.ok || !result.data) {
        setNearbyBuses([]);
        setNearbyError(result.message || "Nearby bus information is unavailable right now.");
        return;
      }
      setNearbyBuses(result.data.buses);
    } catch (loadError) {
      setNearbyError(loadError instanceof Error
        ? loadError.message
        : "Unable to retrieve nearby buses. Check your location and connection.");
    } finally {
      setNearbyLoading(false);
    }
  }, []);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [dashRes, notifRes] = await Promise.allSettled([
        getDashboard(),
        getUnreadNotificationCount(),
      ]);

      if (dashRes.status === "fulfilled" && dashRes.value.ok && dashRes.value.data) {
        setDashboard(dashRes.value.data);
      }
      if (notifRes.status === "fulfilled" && notifRes.value.ok && notifRes.value.data) {
        setUnreadNotifications(notifRes.value.data.unread_count);
      }
    } catch {
      // Silently fail — content will stay empty/stale
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const refreshAfterPayment = useCallback(() => fetchData(true), [fetchData]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void fetchData();
      void loadNearbyBuses(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [fetchData, loadNearbyBuses]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void fetchData(true);
        void loadNearbyBuses();
      }
    });
    return () => subscription.remove();
  }, [fetchData, loadNearbyBuses]);

  const handleRefresh = useCallback(() => {
    void fetchData(true);
    void loadNearbyBuses(true);
  }, [fetchData, loadNearbyBuses]);

  const userName =
    session.user?.name || (dashboard?.user as any)?.name || "Passenger";
  const userType = session.user?.type || (dashboard?.user as any)?.type;
  const isPrivileged =
    userType === "super_admin" ||
    userType === "company_admin" ||
    userType === "driver";

  const firstName = userName.split(" ")[0];

  const formatNpr = (formatted?: string | null, minor?: number): string => {
    if (formatted) {
      if (formatted.startsWith("NPR") || formatted.startsWith("Rs."))
        return formatted;
      return `NPR ${formatted}`;
    }
    if (typeof minor === "number") {
      return `NPR ${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return "NPR 0.00";
  };

  const searchBuses = () => {
    const query = busSearchQuery.trim();
    if (!query) return;
    router.push({
      pathname: "/(tabs)/transit",
      params: { query },
    } as any);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />

      {/* Gradient Header */}
      <LinearGradient
        colors={["#003049", "#001824"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradientHeader, { paddingTop: insets.top + 12 }]}
      >
        {/* Top row: logo + greeting + notifications */}
        <View style={styles.headerTopRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="eYatra profile"
            onPress={() => router.push("/(tabs)/profile" as any)}
            style={styles.brandButton}
          >
            <Image
              source={require("@/assets/images/eyatra-logo.png")}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <View style={styles.brandTextWrap}>
              <AppText style={styles.greetingText}>{getGreeting()}</AppText>
              <AppText style={styles.userNameText} numberOfLines={1}>{firstName} 👋</AppText>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            onPress={() => router.push("/notifications" as any)}
            style={styles.notifButton}
            hitSlop={8}
          >
            <SymbolView
              name={{ ios: "bell.fill", android: "notifications", web: "notifications" }}
              size={20}
              tintColor="#FDF0D5"
            />
            {unreadNotifications > 0 && (
              <View style={styles.notifBadge}>
                <AppText style={styles.notifBadgeText}>
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </AppText>
              </View>
            )}
          </Pressable>
        </View>

        {/* Search bar */}
        <View style={styles.searchWrapper}>
          <View style={styles.searchBox}>
            <SymbolView
              name={{ ios: "magnifyingglass", android: "search", web: "search" }}
              size={16}
              tintColor="rgba(253,240,213,0.5)"
            />
            <AppTextInput
              accessibilityLabel="Search buses and routes"
              style={styles.searchInput}
              placeholder="Search buses & routes..."
              placeholderTextColor="rgba(253,240,213,0.45)"
              value={busSearchQuery}
              onChangeText={setBusSearchQuery}
              onSubmitEditing={searchBuses}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {busSearchQuery.length > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => setBusSearchQuery("")}
                hitSlop={6}
              >
                <SymbolView
                  name={{ ios: "xmark.circle.fill", android: "cancel", web: "cancel" }}
                  size={16}
                  tintColor="rgba(253,240,213,0.5)"
                />
              </Pressable>
            )}
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#C1121F"
          />
        }
      >
        {/* Privileged Role Switcher */}
        {isPrivileged && (
          <Pressable
            onPress={() => {
              if (userType === "super_admin") router.push("/portal/admin" as any);
              else if (userType === "company_admin") router.push("/portal/company" as any);
              else if (userType === "driver") router.push("/portal/driver" as any);
            }}
            style={[styles.portalBanner, { backgroundColor: theme.surfacePrimary, borderColor: theme.border }]}
          >
            <View style={styles.portalBannerLeft}>
              <SymbolView
                name={{ ios: "shield.fill", android: "admin_panel_settings", web: "admin_panel_settings" }}
                size={16}
                tintColor={theme.actionPrimary}
              />
              <AppText style={[styles.portalBannerText, { color: theme.text }]}>
                Access{" "}
                {userType === "super_admin" ? "Super Admin" : userType === "company_admin" ? "Company Fleet" : "Driver"}{" "}
                Portal
              </AppText>
            </View>
            <SymbolView
              name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }}
              size={14}
              tintColor={theme.textSecondary}
            />
          </Pressable>
        )}

        {/* Loading skeleton */}
        {loading && !refreshing && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#C1121F" />
            <AppText style={[styles.loadingText, { color: theme.textSecondary }]}>
              Syncing transit data...
            </AppText>
          </View>
        )}

        {/* ── Smart Transit Card ── */}
        <View style={styles.nfcCard}>
          {/* Decorative rings */}
          <View style={[styles.ring, styles.ringOne]} />
          <View style={[styles.ring, styles.ringTwo]} />
          <View style={[styles.ring, styles.ringThree]} />

          {/* Top: Brand + NFC icon */}
          <View style={styles.nfcTopRow}>
            <View>
              <AppText style={styles.nfcBrand}>eYatra</AppText>
              <AppText style={styles.nfcType}>SMART TRANSIT PASS</AppText>
            </View>
            <SymbolView
              name={{ ios: "wave.3.right", android: "nfc", web: "nfc" }}
              size={26}
              tintColor="#FDF0D5"
            />
          </View>

          {/* EMV Chip */}
          <View style={styles.nfcChip}>
            <View style={styles.chipLineH1} />
            <View style={styles.chipLineH2} />
            <View style={styles.chipLineV} />
          </View>

          {/* Balance */}
          <View>
            <AppText style={styles.nfcLabel}>AVAILABLE TRANSIT BALANCE</AppText>
            <View style={styles.nfcBalanceRow}>
              <AppText style={styles.nfcBalance} numberOfLines={1}>
                {balanceVisible
                  ? formatNpr(dashboard?.wallet.balance_formatted, dashboard?.wallet.balance_minor)
                  : "NPR ••••••"}
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={balanceVisible ? "Hide balance" : "Show balance"}
                onPress={() => setBalanceVisible((prev) => !prev)}
                style={styles.nfcEyeButton}
                hitSlop={10}
              >
                <SymbolView
                  name={{
                    ios: balanceVisible ? "eye.fill" : "eye.slash.fill",
                    android: balanceVisible ? "visibility" : "visibility_off",
                    web: balanceVisible ? "visibility" : "visibility_off",
                  }}
                  size={16}
                  tintColor="#FDF0D5"
                />
              </Pressable>
            </View>
          </View>

          {/* Bottom: Holder + Top Up */}
          <View style={styles.nfcBottomRow}>
            <View style={styles.nfcHolderWrap}>
              <AppText style={styles.nfcLabel}>PASSENGER</AppText>
              <AppText style={styles.nfcHolder} numberOfLines={1}>
                {userName.toUpperCase()}
              </AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setAddMoneyVisible(true)}
              style={styles.nfcAddButton}
            >
              <SymbolView
                name={{ ios: "plus.circle.fill", android: "add_circle", web: "add_circle" }}
                size={16}
                tintColor="#FFFFFF"
              />
              <AppText style={styles.nfcAddText}>Top Up</AppText>
            </Pressable>
          </View>
        </View>

        {/* ── Featured Action: Scan Driver QR ── */}
        <View style={styles.featuredAction}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scan Driver QR to Pay"
            onPress={() => router.push("/passenger/pay" as any)}
            style={[styles.featuredButton, { backgroundColor: theme.actionPrimary }]}
          >
            <View style={styles.featuredIconWrap}>
              <SymbolView
                name={{ ios: "qrcode.viewfinder", android: "qr_code_scanner", web: "qr_code_scanner" }}
                size={32}
                tintColor="#FFFFFF"
              />
            </View>
            <View style={styles.featuredTextWrap}>
              <AppText style={styles.featuredTitle}>Scan Driver QR to Pay</AppText>
              <AppText style={styles.featuredSubtitle}>
                Position your camera to scan the driver&apos;s Tap & Pay QR code
              </AppText>
            </View>
            <SymbolView
              name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }}
              size={16}
              tintColor="#FFFFFF"
            />
          </Pressable>
        </View>

        {/* ── Quick Actions ── */}
        <View style={styles.quickActionsSection}>
          <View style={styles.sectionHeaderCompact}>
            <AppText style={[styles.sectionTitleCompact, { color: theme.text }]}>Quick Actions</AppText>
          </View>
          <View style={styles.quickActionsGrid}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setAddMoneyVisible(true)}
              style={[styles.quickCard, { backgroundColor: theme.surfacePrimary, borderColor: theme.border, borderWidth: 1 }]}
            >
              <View style={styles.quickCardIconWrap}>
                <SymbolView
                  name={{ ios: "plus.circle.fill", android: "add_circle", web: "add_circle" }}
                  size={26}
                  tintColor={theme.actionPrimary}
                />
              </View>
              <AppText style={[styles.quickCardLabel, { color: theme.text }]}>Add Money</AppText>
              <AppText style={[styles.quickCardSub, { color: theme.textSecondary }]}>Top up wallet</AppText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/passenger/qr" as any)}
              style={[styles.quickCard, { backgroundColor: theme.surfacePrimary, borderColor: theme.border, borderWidth: 1 }]}
            >
              <View style={styles.quickCardIconWrap}>
                <SymbolView
                  name={{ ios: "qrcode", android: "qr_code", web: "qr_code" }}
                  size={26}
                  tintColor={theme.actionPrimary}
                />
              </View>
              <AppText style={[styles.quickCardLabel, { color: theme.text }]}>My QR Code</AppText>
              <AppText style={[styles.quickCardSub, { color: theme.textSecondary }]}>Driver validation</AppText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/passenger/tracking" as any)}
              style={[styles.quickCard, { backgroundColor: theme.surfacePrimary, borderColor: theme.border, borderWidth: 1 }]}
            >
              <View style={styles.quickCardIconWrap}>
                <SymbolView
                  name={{ ios: "location.north.line.fill", android: "near_me", web: "near_me" }}
                  size={26}
                  tintColor="#669BBC"
                />
              </View>
              <AppText style={[styles.quickCardLabel, { color: theme.text }]}>Live Tracking</AppText>
              <AppText style={[styles.quickCardSub, { color: theme.textSecondary }]}>Track buses</AppText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/(tabs)/history" as any)}
              style={[styles.quickCard, { backgroundColor: theme.surfacePrimary, borderColor: theme.border, borderWidth: 1 }]}
            >
              <View style={styles.quickCardIconWrap}>
                <SymbolView
                  name={{ ios: "ticket.fill", android: "confirmation_number", web: "confirmation_number" }}
                  size={26}
                  tintColor={theme.text}
                />
              </View>
              <AppText style={[styles.quickCardLabel, { color: theme.text }]}>My Tickets</AppText>
              <AppText style={[styles.quickCardSub, { color: theme.textSecondary }]}>Travel history</AppText>
            </Pressable>
          </View>
        </View>

        {/* ── Nearby Buses ── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <AppText style={[styles.sectionTitle, { color: theme.text }]}>Nearby Buses</AppText>
            <View style={styles.liveIndicatorPill}>
              <View style={styles.liveDot} />
              <AppText style={styles.liveIndicatorText}>LIVE</AppText>
            </View>
          </View>
          <Pressable onPress={() => router.push("/passenger/tracking" as any)}>
            <AppText style={[styles.viewAllText, { color: theme.actionPrimary }]}>Full Map</AppText>
          </Pressable>
        </View>

        {nearbyLoading ? (
          <View style={[styles.stateCard, { backgroundColor: theme.surfacePrimary, borderColor: theme.border }]}>
            <ActivityIndicator size="small" color={theme.actionPrimary} />
            <AppText style={[styles.stateText, { color: theme.textSecondary }]}>Finding buses near you…</AppText>
          </View>
        ) : nearbyError ? (
          <View style={[styles.stateCard, { backgroundColor: theme.surfacePrimary, borderColor: theme.border }]}>
            <SymbolView
              name={{ ios: "location.slash.fill", android: "location_off", web: "location_off" }}
              size={22}
              tintColor={theme.textMuted}
            />
            <View style={{ flex: 1 }}>
              <AppText style={[styles.stateText, { color: theme.textSecondary }]}>{nearbyError}</AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (locationPermissionGranted === false && !locationCanAskAgain) {
                  void Linking.openSettings();
                } else {
                  void loadNearbyBuses(true, locationPermissionGranted !== true);
                }
              }}
              style={[styles.stateButton, { backgroundColor: theme.actionPrimary }]}
            >
              <AppText style={styles.stateButtonText}>
                {locationPermissionGranted === false && !locationCanAskAgain
                  ? "Settings"
                  : locationPermissionGranted === true ? "Retry" : "Enable"}
              </AppText>
            </Pressable>
          </View>
        ) : nearbyBuses.length > 0 ? (
          <View style={styles.busListContainer}>
            {nearbyBuses.slice(0, 4).map((bus) => (
              <Pressable
                key={bus.bus_id}
                onPress={() => router.push("/passenger/tracking" as any)}
                style={[styles.busCard, { backgroundColor: theme.surfacePrimary, borderColor: theme.border }]}
              >
                <View style={[styles.busIconBox, { backgroundColor: "#003049" }]}>
                  <SymbolView
                    name={{ ios: "bus.fill", android: "directions_bus", web: "directions_bus" }}
                    size={18}
                    tintColor="#FDF0D5"
                  />
                </View>
                <View style={styles.busInfoWrap}>
                  <View style={styles.busTopRow}>
                    <AppText style={[styles.busNumber, { color: theme.text }]}>
                      Bus {bus.bus_number}
                    </AppText>
                    {typeof bus.distance_km === "number" && (
                      <View style={[styles.distancePill, { backgroundColor: theme.surfaceSecondary }]}>
                        <AppText style={[styles.distanceText, { color: theme.textSecondary }]}>
                          {bus.distance_km.toFixed(1)} km
                        </AppText>
                      </View>
                    )}
                  </View>
                  <AppText style={[styles.busRoute, { color: theme.textSecondary }]} numberOfLines={1}>
                    {bus.route.name || "Route unavailable"}
                    {bus.route.destination ? ` → ${bus.route.destination}` : ""}
                  </AppText>
                </View>
                <SymbolView
                  name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }}
                  size={14}
                  tintColor={theme.textMuted}
                />
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={[styles.stateCard, { backgroundColor: theme.surfacePrimary, borderColor: theme.border }]}>
            <SymbolView
              name={{ ios: "bus", android: "directions_bus", web: "directions_bus" }}
              size={22}
              tintColor={theme.textMuted}
            />
            <AppText style={[styles.stateText, { color: theme.textSecondary }]}>
              No buses within 5 km right now.
            </AppText>
          </View>
        )}

        {/* ── Explore Tip Banner ── */}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(tabs)/transit" as any)}
          style={[styles.tipBanner, { backgroundColor: theme.surfacePrimary, borderColor: theme.border }]}
        >
          <View style={[styles.tipIconBox, { backgroundColor: "rgba(193,18,31,0.1)" }]}>
            <SymbolView
              name={{ ios: "map.fill", android: "map", web: "map" }}
              size={20}
              tintColor="#C1121F"
            />
          </View>
          <View style={styles.tipTextWrap}>
            <AppText style={[styles.tipTitle, { color: theme.text }]}>Explore Routes</AppText>
            <AppText style={[styles.tipSub, { color: theme.textSecondary }]}>
              Browse all bus routes, stops & schedules
            </AppText>
          </View>
          <SymbolView
            name={{ ios: "arrow.right.circle.fill", android: "arrow_forward", web: "arrow_forward" }}
            size={22}
            tintColor={theme.actionPrimary}
          />
        </Pressable>

        {/* ── Recent Activity ── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <AppText style={[styles.sectionTitle, { color: theme.text }]}>Recent Activity</AppText>
          </View>
          <Pressable onPress={() => router.push("/(tabs)/wallet" as any)}>
            <AppText style={[styles.viewAllText, { color: theme.actionPrimary }]}>View All Transactions</AppText>
          </Pressable>
        </View>

        {dashboard?.recent_transactions && dashboard.recent_transactions.length > 0 ? (
          <View style={styles.activityListContainer}>
            {dashboard.recent_transactions.slice(0, 3).map((txn: WalletTransaction) => {
              const isCredit = txn.direction === "credit";
              return (
                <Pressable
                  key={txn.reference}
                  onPress={() => router.push(`/wallet/transaction/${txn.reference}` as any)}
                  style={styles.activityItem}
                >
                  <View style={[styles.activityIconBox, isCredit ? styles.activityIconCredit : styles.activityIconDebit]}>
                    <SymbolView
                      name={{
                        ios: isCredit ? "arrow.down.left" : "arrow.up.right",
                        android: isCredit ? "arrow_downward" : "arrow_upward",
                        web: isCredit ? "arrow_downward" : "arrow_upward",
                      }}
                      size={16}
                      tintColor={isCredit ? "#1B8A5A" : "#C1121F"}
                    />
                  </View>
                  <View style={styles.activityInfoWrap}>
                    <AppText style={[styles.activityTitle, { color: theme.text }]} numberOfLines={1}>
                      {txn.description || txn.type}
                    </AppText>
                    <AppText style={[styles.activitySubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                      {txn.reference}
                    </AppText>
                  </View>
                  <AppText style={[styles.activityAmount, isCredit ? styles.activityAmountCredit : styles.activityAmountDebit]}>
                    {isCredit ? "+" : "-"}NPR {(txn.amount_minor / 100).toFixed(2)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={[styles.stateCard, { backgroundColor: theme.surfacePrimary, borderColor: theme.border }]}>
            <SymbolView
              name={{ ios: "clock", android: "history", web: "history" }}
              size={20}
              tintColor={theme.textMuted}
            />
            <AppText style={[styles.stateText, { color: theme.textSecondary }]}>
              No recent activity yet. Your transactions will appear here.
            </AppText>
          </View>
        )}

      </ScrollView>

      <AddMoneyModal
        visible={addMoneyVisible}
        wallet={dashboard?.wallet ?? null}
        onClose={() => setAddMoneyVisible(false)}
        onPaymentVerified={refreshAfterPayment}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  /* ── Gradient Header ── */
  gradientHeader: {
    paddingHorizontal: Spacing.four,
    paddingBottom: 20,
    gap: 14,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  headerLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  brandTextWrap: {
    flex: 1,
  },
  greetingText: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(253,240,213,0.65)",
    letterSpacing: 0.3,
  },
  userNameText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FDF0D5",
    letterSpacing: -0.2,
  },
  notifButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(253,240,213,0.12)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  notifBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "#C1121F",
    borderRadius: 6,
    minWidth: 12,
    height: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  notifBadgeText: {
    color: "#FFFFFF",
    fontSize: 7,
    fontWeight: "800",
  },

  /* ── Search ── */
  searchWrapper: {},
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(253,240,213,0.1)",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 42,
    borderWidth: 1,
    borderColor: "rgba(253,240,213,0.15)",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "400",
    color: "#FDF0D5",
    paddingVertical: 0,
  },

  /* ── Scroll Content ── */
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.three,
  },

  /* ── Portal Banner ── */
  portalBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  portalBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  portalBannerText: {
    fontSize: 13,
    fontWeight: "600",
  },

  /* ── Loading ── */
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 4,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "400",
  },

  /* ── NFC / Transit Card ── */
  nfcCard: {
    backgroundColor: "#002B49",
    borderRadius: 22,
    padding: 20,
    minHeight: 210,
    justifyContent: "space-between",
    overflow: "hidden",
    shadowColor: "#001824",
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(253, 240, 213, 0.12)",
  },
  ring: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(253, 240, 213, 0.07)",
  },
  ringOne: { width: 180, height: 180, top: -60, right: -50 },
  ringTwo: { width: 260, height: 260, top: -100, right: -90 },
  ringThree: { width: 340, height: 340, top: -140, right: -130 },
  nfcTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  nfcBrand: {
    color: "#FDF0D5",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  nfcType: {
    color: "#669BBC",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.5,
    marginTop: 2,
  },
  nfcChip: {
    width: 42,
    height: 30,
    borderRadius: 6,
    backgroundColor: "#DFB86C",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  chipLineH1: {
    position: "absolute",
    top: 10,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  chipLineH2: {
    position: "absolute",
    top: 20,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  chipLineV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  nfcLabel: {
    color: "#8DAEC7",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1.4,
  },
  nfcBalanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  nfcBalance: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  nfcEyeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(253, 240, 213, 0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  nfcBottomRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  nfcHolderWrap: {
    flex: 1,
  },
  nfcHolder: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: 3,
  },
  nfcAddButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#C1121F",
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 18,
    shadowColor: "#C1121F",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  nfcAddText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  /* ── Quick Actions 2×2 Grid ── */
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  quickCard: {
    width: "47.5%",
    borderRadius: 18,
    padding: 16,
    gap: 6,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  quickCardIconWrap: {
    marginBottom: 4,
  },
  quickCardLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  quickCardSub: {
    fontSize: 12,
    fontWeight: "400",
    color: "rgba(255,255,255,0.7)",
  },

  /* ── Section Headers ── */
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  liveIndicatorPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(27, 138, 90, 0.12)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#1B8A5A",
  },
  liveIndicatorText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#1B8A5A",
    letterSpacing: 0.6,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: "600",
  },

  /* ── State Cards ── */
  stateCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    minHeight: 60,
  },
  stateText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "400",
  },
  stateButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
  },
  stateButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  /* ── Bus Cards ── */
  busListContainer: {
    gap: 8,
  },
  busCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  busIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  busInfoWrap: {
    flex: 1,
    gap: 3,
  },
  busTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  busNumber: {
    fontSize: 14,
    fontWeight: "700",
  },
  distancePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: "600",
  },
  busRoute: {
    fontSize: 12,
    fontWeight: "400",
  },

  /* ── Tip Banner ── */
  tipBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginTop: 4,
  },
  tipIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tipTextWrap: {
    flex: 1,
    gap: 2,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  tipSub: {
    fontSize: 12,
    fontWeight: "400",
  },

  /* ── Featured Action ── */
  featuredAction: {
    marginTop: Spacing.two,
    marginBottom: Spacing.two,
  },
  featuredButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
    borderRadius: 18,
    gap: 14,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 5,
  },
  featuredIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "rgba(253,253,253,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  featuredTextWrap: {
    flex: 1,
    gap: 2,
  },
  featuredTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  featuredSubtitle: {
    fontSize: 12,
    fontWeight: "400",
    color: "rgba(255,255,255,0.8)",
    lineHeight: 18,
  },

  /* ── Quick Actions Section ── */
  quickActionsSection: {
    marginTop: Spacing.two,
    marginBottom: Spacing.two,
  },
  sectionHeaderCompact: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitleCompact: {
    fontSize: 17,
    fontWeight: "700",
    color: Palette.prussianNavy,
  },
  /* ── Recent Activity ── */
  activityListContainer: {
    gap: 8,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.prussianNavy,
  },
  activityIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  activityIconCredit: {
    backgroundColor: "rgba(27, 138, 90, 0.12)",
  },
  activityIconDebit: {
    backgroundColor: "rgba(193, 18, 31, 0.12)",
  },
  activityInfoWrap: {
    flex: 1,
    gap: 2,
  },
  activityTitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  activitySubtitle: {
    fontSize: 11,
    fontWeight: "400",
  },
  activityAmount: {
    fontSize: 14,
    fontWeight: "700",
  },
  activityAmountCredit: {
    color: "#1B8A5A",
  },
  activityAmountDebit: {
    color: "#C1121F",
  },
});