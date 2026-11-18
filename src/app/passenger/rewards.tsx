import { AppText } from '@/components/typography/app-text';
import { RewardsSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppBackButton } from '@/components/ui/app-back-button';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Palette, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  getRewardTransactions,
  getRewardsDashboard,
  type RewardTransaction,
  type RewardsDashboard,
} from '@/features/passenger/services/passengerApi';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

function transactionLabel(transaction: RewardTransaction): string {
  if (transaction.type === 'earn') return 'Fare reward earned';
  if (transaction.type === 'conversion') return 'Converted to wallet';
  if (transaction.type === 'adjustment') return 'Reward balance adjustment';
  if (transaction.type === 'expiry') return 'Points expired';
  if (transaction.type === 'reversal') return 'Reward reversed';
  return 'Points redeemed';
}

export default function PassengerRewardsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [dashboard, setDashboard] = useState<RewardsDashboard | null>(null);
  const [transactions, setTransactions] = useState<RewardTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRewards = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [balanceResult, historyResult] = await Promise.all([
        getRewardsDashboard(),
        getRewardTransactions(30),
      ]);
      if (!balanceResult.ok || !historyResult.ok) {
        setError(balanceResult.ok ? historyResult.message : balanceResult.message);
        return;
      }
      setDashboard(balanceResult.data);
      setTransactions(historyResult.data.transactions);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load rewards.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadRewards();
  }, [loadRewards]));

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md, borderBottomColor: theme.border }]}>
        <AppBackButton
          accessibilityLabel="Back to wallet"
          fallbackHref="/(tabs)/wallet"
        />
        <View style={styles.headerText}>
          <AppText style={[styles.title, { color: theme.text }]}>Rewards</AppText>
          <AppText style={{ color: theme.textSecondary }}>Earn points when you pay eligible QR fares</AppText>
        </View>
      </View>

      {loading && !dashboard ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
          <RewardsSkeleton />
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadRewards(true)} tintColor={Palette.crimsonRed} />}
        >
          {error && (
            <View style={[styles.errorCard, { backgroundColor: theme.surfacePrimary, borderColor: Palette.crimsonRed }]}>
              <AppText style={{ color: theme.text }}>{error}</AppText>
              <Pressable accessibilityRole="button" onPress={() => void loadRewards(true)}><AppText style={styles.retry}>Retry</AppText></Pressable>
            </View>
          )}

          <View style={[styles.balanceCard, { backgroundColor: theme.surfacePrimary, borderColor: theme.border }]}>
            <View style={styles.balanceHeading}>
              <View style={[styles.iconCircle, { backgroundColor: theme.isDark ? '#1F384C' : '#FDF0D5' }]}>
                <SymbolView name={{ ios: 'sparkles', android: 'stars', web: 'stars' }} size={24} tintColor={Palette.crimsonRed} />
              </View>
              <AppText style={[styles.balanceLabel, { color: theme.textSecondary }]}>Available reward points</AppText>
            </View>
            <AppText style={[styles.points, { color: theme.text }]}>{(dashboard?.available_points ?? 0).toLocaleString()}</AppText>
            <AppText style={[styles.equivalent, { color: theme.textSecondary }]}>
              Worth {dashboard?.equivalent_npr_formatted ?? 'Rs. 0.00'} in your wallet
            </AppText>
            <View style={[styles.rateBox, { backgroundColor: theme.isDark ? '#001824' : '#FAF4EB' }]}>
              <AppText style={{ color: theme.textSecondary }}>
                {dashboard?.points_per_npr ?? 100} points = NPR 1.00
              </AppText>
              <AppText style={{ color: theme.textSecondary }}>
                Minimum conversion: {dashboard?.minimum_conversion_points ?? 1} points
              </AppText>
            </View>
            {!dashboard?.rewards_enabled && (
              <AppText style={styles.disabledText}>Reward conversions are temporarily unavailable.</AppText>
            )}
            <PrimaryButton
              label="Convert to Wallet"
              onPress={() => router.push('/passenger/rewards/convert')}
              disabled={!dashboard?.rewards_enabled
                || (dashboard?.available_points ?? 0) < (dashboard?.minimum_conversion_points ?? 1)}
              style={styles.convertButton}
            />
          </View>

          <View style={styles.historyHeading}>
            <AppText style={[styles.sectionTitle, { color: theme.text }]}>Reward history</AppText>
            <AppText style={{ color: theme.textSecondary }}>{transactions.length} recent entries</AppText>
          </View>
          {transactions.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.surfacePrimary, borderColor: theme.border }]}>
              <AppText style={{ color: theme.textSecondary }}>Your earned points and conversions will appear here.</AppText>
            </View>
          ) : transactions.map((transaction) => (
            <View key={transaction.reference} style={[styles.historyRow, { backgroundColor: theme.surfacePrimary, borderColor: theme.border }]}>
              <View style={styles.historyCopy}>
                <AppText style={[styles.historyTitle, { color: theme.text }]}>{transactionLabel(transaction)}</AppText>
                <AppText style={{ color: theme.textSecondary, fontSize: 12 }}>
                  {new Date(transaction.created_at).toLocaleString()}
                </AppText>
              </View>
              <AppText style={[styles.historyPoints, { color: transaction.direction === 'credit' ? '#1B8A5A' : Palette.crimsonRed }]}>
                {transaction.direction === 'credit' ? '+' : '-'}{transaction.points.toLocaleString()}
              </AppText>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  backButton: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 24, fontWeight: '800' },
  content: { padding: 20, gap: 14 },
  balanceCard: { borderWidth: 1, borderRadius: 22, padding: 20 },
  balanceHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  balanceLabel: { fontSize: 14, fontWeight: '600' },
  points: { fontSize: 42, fontWeight: '800', marginTop: 16 },
  equivalent: { fontSize: 15, marginTop: 2 },
  rateBox: { borderRadius: 12, padding: 12, marginTop: 18, gap: 6 },
  disabledText: { color: Palette.crimsonRed, marginTop: 12 },
  convertButton: { marginTop: 16 },
  historyHeading: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  emptyCard: { borderWidth: 1, borderRadius: 14, padding: 18 },
  historyRow: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  historyCopy: { flex: 1, gap: 4 },
  historyTitle: { fontSize: 14, fontWeight: '600' },
  historyPoints: { fontSize: 16, fontWeight: '800' },
  errorCard: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 8 },
  retry: { color: Palette.crimsonRed, fontWeight: '700' },
});
