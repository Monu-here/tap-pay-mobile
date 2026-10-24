import { AppText, AppTextInput } from "@/components/typography/app-text";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import * as Location from "expo-location";

import { AddMoneyModal } from "@/features/passenger/components/AddMoneyModal";
import { JourneyPlanner } from "@/features/passenger/components/JourneyPlanner";
import { Monochrome, Spacing } from "@/constants/theme";
import {
  getDashboard,
  getUnreadNotificationCount,
  getRoutes,
  getPassengerFavorites,
  type DashboardData,
  type RouteInfo,
} from "@/features/passenger/services/passengerApi";
import { getSession } from "@/features/auth/session";
import {
  getNearbyBuses,
  type PublicNearbyBus,
} from "@/features/transit/services/transitApi";

const NEARBY_REFRESH_INTERVAL_MS = 30_000;
const LIVE_LOCATION_MAX_AGE_MS = 120_000;

function getBusLocationFreshness(lastSeenAt: string | null, status: string | null): { isLive: boolean; label: string } {
  if (!lastSeenAt) return { isLive: false, label: "Location time unavailable" };
  const timestamp = Date.parse(lastSeenAt);
  if (!Number.isFinite(timestamp)) return { isLive: false, label: "Location time unavailable" };
  const ageMs = Date.now() - timestamp;
  const label = `Updated ${Math.max(0, Math.floor(ageMs / 60_000))} min ago`;
  return { isLive: status === "active" && ageMs <= LIVE_LOCATION_MAX_AGE_MS, label };
}

// NFC card colors are fixed so the card always looks like a physical card.
const CARD = {
  bg: "#0B0B0C",
  ring: "rgba(255,255,255,0.07)",
  textPrimary: "#FFFFFF",
  textSecondary: "rgba(255,255,255,0.62)",
  textMuted: "rgba(255,255,255,0.4)",
  chip: "#D4D4D8",
  chipLine: "rgba(0,0,0,0.28)",
  pill: "rgba(255,255,255,0.12)",
  button: "#FFFFFF",
  buttonText: "#0B0B0C",
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const session = getSession();

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [savedRouteIds, setSavedRouteIds] = useState<number[]>([]);
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
  const [error, setError] = useState<string | null>(null);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [addMoneyVisible, setAddMoneyVisible] = useState(false);

  const loadNearbyBuses = useCallback(async (force = false, requestPermission = false) => {
    if (!force && Date.now() - nearbyLastRequestedAt.current < NEARBY_REFRESH_INTERVAL_MS) return;
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
    setError(null);

    try {
      const [dashRes, routesRes, notifRes, favoritesRes] = await Promise.allSettled([
        getDashboard(),
        getRoutes(),
        getUnreadNotificationCount(),
        getPassengerFavorites(),
      ]);

      if (
        dashRes.status === "fulfilled" &&
        dashRes.value.ok &&
        dashRes.value.data
      ) {
        setDashboard(dashRes.value.data);
      } else if (dashRes.status === "fulfilled" && !dashRes.value.ok) {
        setError(dashRes.value.message || "Unable to sync dashboard data.");
      }

      if (
        routesRes.status === "fulfilled" &&
        routesRes.value.ok &&
        routesRes.value.data?.routes
      ) {
        setRoutes(routesRes.value.data.routes);
      }
      if (
        favoritesRes.status === "fulfilled" &&
        favoritesRes.value.ok &&
        favoritesRes.value.data
      ) {
        setSavedRouteIds(favoritesRes.value.data.route_ids);
      }

      if (
        notifRes.status === "fulfilled" &&
        notifRes.value.ok &&
        notifRes.value.data
      ) {
        setUnreadNotifications(notifRes.value.data.unread_count);
      }
    } catch {
      setError("Connection failure. Please check your internet connection.");
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
      if (state === "active") void fetchData(true);
      if (state === "active") void loadNearbyBuses();
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/(tabs)/profile" as any)}
            style={styles.profileButton}
          >
            <View style={styles.avatar}>
              <AppText style={styles.avatarText}>
                {userName.charAt(0).toUpperCase()}
              </AppText>
            </View>
            {/* <View style={styles.greetingWrap}>
              <View style={styles.brandRow}>
                <AppText style={styles.brandName}>TAP &amp; PAY</AppText>
                <View style={styles.brandBadge}>
                  <AppText style={styles.brandBadgeText}>TRANSIT</AppText>
                </View>
              </View>
              <AppText style={styles.userName} numberOfLines={1}>
                {userName}
              </AppText>
            </View> */}
          </Pressable>

          <View style={styles.busSearchBox}>
            <SymbolView
              name={{ ios: "magnifyingglass", android: "search", web: "search" }}
              size={17}
              tintColor={Monochrome.textMuted}
            />
            <AppTextInput
              accessibilityLabel="Search buses and routes"
              style={styles.busSearchInput}
              placeholder="Search buses and routes..."
              placeholderTextColor={Monochrome.textMuted}
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
                accessibilityLabel="Clear bus search"
                onPress={() => setBusSearchQuery("")}
                hitSlop={6}
              >
                <SymbolView
                  name={{ ios: "xmark.circle.fill", android: "cancel", web: "cancel" }}
                  size={16}
                  tintColor={Monochrome.textMuted}
                />
              </Pressable>
            )}
          </View>

          <View style={styles.headerRightActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              onPress={() => router.push("/notifications" as any)}
              style={styles.headerIconButton}
              hitSlop={8}
            >
              <SymbolView
                name={{
                  ios: "bell.fill",
                  android: "notifications",
                  web: "notifications",
                }}
                size={18}
                tintColor={Monochrome.textPrimary}
              />
              {unreadNotifications > 0 && (
                <View style={styles.unreadBadge}>
                  <AppText style={styles.unreadBadgeText}>
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
                  </AppText>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Monochrome.textPrimary}
          />
        }
      >
        {/* Privileged Role Switcher */}
        {isPrivileged && (
          <Pressable
            onPress={() => {
              if (userType === "super_admin")
                router.push("/portal/admin" as any);
              else if (userType === "company_admin")
                router.push("/portal/company" as any);
              else if (userType === "driver")
                router.push("/portal/driver" as any);
            }}
            style={styles.portalBanner}
          >
            <View style={styles.portalBannerLeft}>
              <SymbolView
                name={{
                  ios: "shield.fill",
                  android: "admin_panel_settings",
                  web: "admin_panel_settings",
                }}
                size={16}
                tintColor={Monochrome.textPrimary}
              />
              <AppText style={styles.portalBannerText}>
                Access{" "}
                {userType === "super_admin"
                  ? "Super Admin"
                  : userType === "company_admin"
                    ? "Company Fleet"
                    : "Driver"}{" "}
                Portal
              </AppText>
            </View>
            <SymbolView
              name={{
                ios: "chevron.right",
                android: "chevron_right",
                web: "chevron_right",
              }}
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
                name={{
                  ios: "exclamationmark.circle.fill",
                  android: "error",
                  web: "error",
                }}
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
            <AppText style={styles.loadingText}>
              Syncing wallet &amp; transit services...
            </AppText>
          </View>
        )}

        {/* NFC Wallet Card */}
        <View style={styles.nfcCard}>
          {/* Decorative rings */}
          <View style={[styles.ring, styles.ringOne]} />
          <View style={[styles.ring, styles.ringTwo]} />
          <View style={[styles.ring, styles.ringThree]} />

          {/* Top: brand + contactless */}
          <View style={styles.nfcTopRow}>
            <View>
              <AppText style={styles.nfcBrand}>TAP &amp; PAY</AppText>
              <AppText style={styles.nfcType}>WALLET CARD</AppText>
            </View>
            <SymbolView
              name={{ ios: "wave.3.right", android: "nfc", web: "nfc" }}
              size={28}
              tintColor={CARD.textPrimary}
            />
          </View>

          {/* Chip */}
          <View style={styles.nfcChip}>
            <View style={styles.chipLineH1} />
            <View style={styles.chipLineH2} />
            <View style={styles.chipLineV} />
          </View>

          {/* Balance */}
          <View>
            <AppText style={styles.nfcLabel}>AVAILABLE BALANCE</AppText>
            <View style={styles.nfcBalanceRow}>
              <AppText style={styles.nfcBalance} numberOfLines={1}>
                {balanceVisible
                  ? formatNpr(
                      dashboard?.wallet.balance_formatted,
                      dashboard?.wallet.balance_minor,
                    )
                  : "********"}
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  balanceVisible ? "Hide balance" : "Show balance"
                }
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
                  tintColor={CARD.textPrimary}
                />
              </Pressable>
            </View>
          </View>

          {/* Bottom: holder + add money */}
          <View style={styles.nfcBottomRow}>
            <View style={styles.nfcHolderWrap}>
              <AppText style={styles.nfcLabel}>CARD HOLDER</AppText>
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
                name={{
                  ios: "plus.circle.fill",
                  android: "add_circle",
                  web: "add_circle",
                }}
                size={16}
                tintColor={CARD.buttonText}
              />
              <AppText style={styles.nfcAddText}>Top Up</AppText>
            </Pressable>
          </View>
        </View>

        {/* Payment Actions Grid */}
        <View style={styles.actionsGrid}>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/travel" as any)}
            style={styles.actionGridCard}
          >
            <View style={styles.actionIconBox}>
              <SymbolView
                name={{
                  ios: "ticket.fill",
                  android: "confirmation_number",
                  web: "confirmation_number",
                }}
                size={20}
                tintColor={Monochrome.textPrimary}
              />
            </View>
            <AppText style={styles.actionCardTitle}>My Trips</AppText>
            <AppText style={styles.actionCardDesc}>Trip receipts</AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/(tabs)/cards" as any)}
            style={styles.actionGridCard}
          >
            <View style={styles.actionIconBox}>
              <SymbolView
                name={{ ios: "wave.3.right", android: "nfc", web: "nfc" }}
                size={20}
                tintColor={Monochrome.textPrimary}
              />
            </View>
            <AppText style={styles.actionCardTitle}>Cards</AppText>
            <AppText style={styles.actionCardDesc}>Travel cards</AppText>
          </Pressable>
        </View>

        <JourneyPlanner />

        {/* Nearby live buses */}
        <View style={styles.sectionHeader}>
          <View>
            <AppText style={styles.sectionTitle}>Nearby Buses</AppText>
            <AppText style={styles.sectionSubtitle}>
              Vehicle reports include freshness so stale locations are clear
            </AppText>
          </View>
        </View>

        {nearbyLoading ? (
          <View style={styles.nearbyStateCard}>
            <ActivityIndicator size="small" color={Monochrome.textPrimary} />
            <AppText style={styles.nearbyStateText}>Finding buses near you…</AppText>
          </View>
        ) : nearbyError ? (
          <View style={styles.nearbyStateCard}>
            <AppText style={styles.nearbyStateText}>{nearbyError}</AppText>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (locationPermissionGranted === false && !locationCanAskAgain) {
                  void Linking.openSettings();
                } else {
                  void loadNearbyBuses(true, locationPermissionGranted !== true);
                }
              }}
              style={styles.nearbyRetryButton}
            >
              <AppText style={styles.nearbyRetryText}>
                {locationPermissionGranted === false && !locationCanAskAgain
                  ? "Open Settings"
                  : locationPermissionGranted === true ? "Retry" : "Enable Location"}
              </AppText>
            </Pressable>
          </View>
        ) : nearbyBuses.length > 0 ? (
          <View style={styles.routesContainer}>
            {nearbyBuses.slice(0, 3).map((bus) => {
              const freshness = getBusLocationFreshness(bus.last_seen_at, bus.status);

              return (
              <Pressable
                key={bus.bus_id}
                onPress={() => router.push("/passenger/tracking" as any)}
                style={styles.routeItemCard}
              >
                <View style={styles.routeIconBox}>
                  <SymbolView
                    name={{
                      ios: "bus.fill",
                      android: "directions_bus",
                      web: "directions_bus",
                    }}
                    size={18}
                    tintColor={Monochrome.textPrimary}
                  />
                </View>
                <View style={styles.routeInfoWrap}>
                  <View style={styles.routeCodeRow}>
                    <AppText style={styles.routeCodeBadge}>
                      Bus {bus.bus_number}
                    </AppText>
                    {typeof bus.distance_km === "number" && (
                      <AppText style={styles.routeCompanyText}>
                        {bus.distance_km.toFixed(1)} km away
                      </AppText>
                    )}
                  </View>
                  <AppText style={styles.routeNameText}>
                    {bus.route.name || "Route unavailable"}
                  </AppText>
                  <AppText style={styles.routeStopsText}>
                    {bus.route.destination
                      ? `Towards ${bus.route.destination}`
                      : bus.company.name || "Destination unavailable"}
                  </AppText>
                  <AppText style={styles.nearbyFreshnessText}>
                    {freshness.isLive ? `Live · ${freshness.label}` : `Not live · ${freshness.label}`}
                  </AppText>
                </View>
                <SymbolView
                  name={{
                    ios: "chevron.right",
                    android: "chevron_right",
                    web: "chevron_right",
                  }}
                  size={14}
                  tintColor={Monochrome.textMuted}
                />
              </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.nearbyStateCard}>
            <AppText style={styles.nearbyStateText}>
              No buses are reporting a location within 5 km right now.
            </AppText>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/passenger/tracking" as any)}
          style={styles.liveTrackingBanner}
        >
          <SymbolView
            name={{ ios: "location.north.line.fill", android: "near_me", web: "near_me" }}
            size={18}
            tintColor={Monochrome.actionPrimaryText}
          />
          <AppText style={styles.liveTrackingText}>Live Bus Tracking</AppText>
          <SymbolView
            name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }}
            size={14}
            tintColor={Monochrome.actionPrimaryText}
          />
        </Pressable>

        <View style={styles.sectionHeader}>
          <View>
            <AppText style={styles.sectionTitle}>Saved Routes</AppText>
            <AppText style={styles.sectionSubtitle}>Your routes, saved to your account</AppText>
          </View>
          {/* <Pressable onPress={() => router.push("/(tabs)/transit?section=saved" as any)}>
            <AppText style={styles.nearbyRetryText}>View all</AppText>
          </Pressable> */}
        </View>
        {routes.filter((route) => savedRouteIds.includes(route.id)).slice(0, 3).length > 0 ? (
          <View style={styles.routesContainer}>
            {routes.filter((route) => savedRouteIds.includes(route.id)).slice(0, 3).map((route) => (
              <Pressable
                key={route.id}
                onPress={() => router.push("/(tabs)/transit?section=saved" as any)}
                style={styles.routeItemCard}
              >
                <View style={styles.routeIconBox}>
                  <SymbolView name={{ ios: "star.fill", android: "star", web: "star" }} size={18} tintColor={Monochrome.textPrimary} />
                </View>
                <View style={styles.routeInfoWrap}>
                  <AppText style={styles.routeNameText}>{route.name}</AppText>
                  <AppText style={styles.routeStopsText}>
                    {route.origin_stop && route.destination_stop
                      ? `${route.origin_stop} ⇄ ${route.destination_stop}`
                      : route.code}
                  </AppText>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.nearbyStateCard}>
            <AppText style={styles.nearbyStateText}>No saved routes yet.</AppText>
            {/* <Pressable onPress={() => router.push("/(tabs)/transit" as any)}>
              <AppText style={styles.nearbyRetryText}>Explore routes</AppText>
            </Pressable> */}
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
    backgroundColor: Monochrome.background,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    backgroundColor: Monochrome.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: Monochrome.border,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  profileButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Monochrome.surfaceElevated,
    borderWidth: 1,
    borderColor: Monochrome.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: Monochrome.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  greetingWrap: {
    flex: 1,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  brandName: {
    fontSize: 11,
    fontWeight: "900",
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
    fontWeight: "700",
    color: Monochrome.textSecondary,
  },
  userName: {
    fontSize: 15,
    fontWeight: "700",
    color: Monochrome.textPrimary,
    marginTop: 2,
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  busSearchBox: {
    flex: 1,
    minWidth: 0,
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.two,
    borderRadius: 19,
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  busSearchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    fontSize: 12,
    color: Monochrome.textPrimary,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  unreadBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: Monochrome.actionPrimary,
    borderRadius: 7,
    minWidth: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  unreadBadgeText: {
    color: Monochrome.actionPrimaryText,
    fontSize: 8,
    fontWeight: "800",
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.four,
  },
  portalBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Monochrome.surfaceSecondary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  portalBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  portalBannerText: {
    color: Monochrome.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  errorBox: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  errorTextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  errorText: {
    color: Monochrome.textPrimary,
    fontSize: 13,
    fontWeight: "500",
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
    fontWeight: "600",
  },
  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 6,
  },
  loadingText: {
    color: Monochrome.textSecondary,
    fontSize: 13,
  },

  /* ---------- NFC card ---------- */
  nfcCard: {
    backgroundColor: CARD.bg,
    borderRadius: 26,
    padding: 22,
    minHeight: 240,
    justifyContent: "space-between",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.28,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  ring: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: CARD.ring,
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
    color: CARD.textPrimary,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1.6,
  },
  nfcType: {
    color: CARD.textSecondary,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.8,
    marginTop: 3,
  },
  nfcChip: {
    width: 44,
    height: 33,
    borderRadius: 7,
    backgroundColor: CARD.chip,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  chipLineH1: {
    position: "absolute",
    top: 11,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: CARD.chipLine,
  },
  chipLineH2: {
    position: "absolute",
    top: 22,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: CARD.chipLine,
  },
  chipLineV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: CARD.chipLine,
  },
  nfcLabel: {
    color: CARD.textMuted,
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1.6,
  },
  nfcBalanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  nfcBalance: {
    color: CARD.textPrimary,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  nfcEyeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: CARD.pill,
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
    color: CARD.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 3,
  },
  nfcAddButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: CARD.button,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 19,
  },
  nfcAddText: {
    color: CARD.buttonText,
    fontSize: 13,
    fontWeight: "700",
  },

  /* ---------- Actions ---------- */
  actionsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  actionGridCard: {
    flex: 1,
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
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  actionCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Monochrome.textPrimary,
  },
  actionCardDesc: {
    fontSize: 11,
    color: Monochrome.textMuted,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: Spacing.two,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Monochrome.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Monochrome.textMuted,
    marginTop: 2,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: Monochrome.textSecondary,
  },
  routesContainer: {
    gap: 10,
  },
  nearbyStateCard: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Monochrome.border,
    minHeight: 68,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  nearbyStateText: {
    color: Monochrome.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  nearbyRetryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: Monochrome.surfaceElevated,
  },
  nearbyRetryText: {
    color: Monochrome.textPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  nearbyFreshnessText: {
    color: Monochrome.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  routeItemCard: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
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
    alignItems: "center",
    justifyContent: "center",
  },
  routeInfoWrap: {
    flex: 1,
  },
  routeCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  routeCodeBadge: {
    fontSize: 10,
    fontWeight: "700",
    color: Monochrome.textPrimary,
    backgroundColor: Monochrome.surfaceElevated,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  routeCompanyText: {
    fontSize: 11,
    color: Monochrome.textMuted,
  },
  routeNameText: {
    fontSize: 14,
    fontWeight: "600",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  liveTrackingText: {
    color: Monochrome.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  emptyCard: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  emptyCardText: {
    color: Monochrome.textMuted,
    fontSize: 13,
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  segmentBtnActive: {
    backgroundColor: Monochrome.surfaceElevated,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "500",
    color: Monochrome.textMuted,
  },
  segmentTextActive: {
    color: Monochrome.textPrimary,
    fontWeight: "700",
  },
  activityCard: {
    backgroundColor: Monochrome.surfaceSecondary,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: Monochrome.border,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
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
    alignItems: "center",
    justifyContent: "center",
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: "600",
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
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 2,
  },
  activityDate: {
    fontSize: 11,
    color: Monochrome.textMuted,
    marginTop: 2,
  },
  activityRight: {
    alignItems: "flex-end",
  },
  tripFareText: {
    fontSize: 14,
    fontWeight: "700",
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
    fontWeight: "600",
    color: Monochrome.textSecondary,
    textTransform: "capitalize",
  },
  walletAmountText: {
    fontSize: 14,
    fontWeight: "700",
    color: Monochrome.textPrimary,
  },
  emptyListWrap: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 6,
  },
  emptyListText: {
    fontSize: 14,
    fontWeight: "600",
    color: Monochrome.textPrimary,
  },
  emptyListSub: {
    fontSize: 12,
    color: Monochrome.textMuted,
  },
});