import { AppText, AppTextInput } from '@/components/typography/app-text';
import { RewardsSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppBackButton } from '@/components/ui/app-back-button';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Palette, Spacing } from '@/constants/theme';
import { createIdempotencyKey } from '@/features/auth/services/apiClient';
import {
  convertRewardPoints,
  getRewardsDashboard,
  type RewardConversionReceipt,
  type RewardsDashboard,
} from '@/features/passenger/services/passengerApi';
import { useTheme } from '@/hooks/use-theme';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

function formatMinor(minor: bigint): string {
  const whole = (minor / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const paisa = (minor % 100n).toString().padStart(2, '0');
  return `Rs. ${whole}.${paisa}`;
}

function roundedWalletMinor(points: number, pointsPerNpr: number): bigint {
  const numerator = BigInt(points) * 100n;
  const denominator = BigInt(pointsPerNpr);
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return quotient + (remainder * 2n >= denominator ? 1n : 0n);
}

export default function ConvertRewardsScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [dashboard, setDashboard] = useState<RewardsDashboard | null>(null);
  const [pointsInput, setPointsInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [receipt, setReceipt] = useState<RewardConversionReceipt | null>(null);
  const idempotencyKey = useRef<string | null>(null);

  const loadBalance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getRewardsDashboard();
      if (result.ok) setDashboard(result.data);
      else setError(result.message || 'Unable to load your reward balance.');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load your reward balance.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadBalance();
  }, [loadBalance]));

  const parsedPoints = /^\d+$/.test(pointsInput) ? Number(pointsInput) : 0;
  const pointAmountIsSafe = Number.isSafeInteger(parsedPoints);
  const maximum = dashboard?.maximum_conversion_points ?? 0;
  const isValid = Boolean(
    dashboard
    && pointAmountIsSafe
    && parsedPoints >= dashboard.minimum_conversion_points
    && parsedPoints <= dashboard.available_points
    && (maximum === 0 || parsedPoints <= maximum)
    && dashboard.rewards_enabled,
  );

  const walletCredit = useMemo(() => {
    if (!isValid || !dashboard) return null;
    return roundedWalletMinor(parsedPoints, dashboard.points_per_npr);
  }, [dashboard, isValid, parsedPoints]);

  const remainingPoints = dashboard ? Math.max(0, dashboard.available_points - parsedPoints) : 0;
  const conversionOptions = [50, 100, 500, 1000].filter((option) => (
    dashboard
    && option >= dashboard.minimum_conversion_points
    && option <= dashboard.available_points
    && (maximum === 0 || option <= maximum)
  ));

  const handlePointsChange = (value: string) => {
    if (!/^\d*$/.test(value)) return;
    setPointsInput(value);
    idempotencyKey.current = null;
    setError(null);
  };

  const confirmConversion = async () => {
    if (!isValid || !dashboard) return;
    Keyboard.dismiss();
    setSubmitting(true);
    setError(null);
    idempotencyKey.current ??= createIdempotencyKey();

    try {
      const result = await convertRewardPoints(parsedPoints, idempotencyKey.current);
      if (!result.ok) {
        setError(result.message || 'Your conversion could not be completed.');
        if (result.status > 0 && result.status < 500) idempotencyKey.current = null;
        return;
      }
      setReceipt(result.data.conversion);
      setConfirmVisible(false);
      idempotencyKey.current = null;
      await loadBalance();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Your conversion could not be completed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md, borderBottomColor: theme.border }]}>
        <AppBackButton
          accessibilityLabel="Back to rewards"
          fallbackHref="/passenger/rewards"
        />
        <View style={styles.headerText}>
          <AppText style={[styles.title, { color: theme.text }]}>Convert to Wallet</AppText>
          <AppText style={{ color: theme.textSecondary }}>Use earned points for Tap & Pay wallet credit</AppText>
        </View>
      </View>

      {loading && !dashboard ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
          <RewardsSkeleton />
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          {error && <View style={[styles.errorBox, { backgroundColor: theme.surfacePrimary, borderColor: Palette.crimsonRed }]}><AppText style={{ color: theme.text }}>{error}</AppText></View>}
          <View style={[styles.infoCard, { backgroundColor: theme.surfacePrimary, borderColor: theme.border }]}>
            <AppText style={[styles.label, { color: theme.textSecondary }]}>Available points</AppText>
            <AppText style={[styles.available, { color: theme.text }]}>{(dashboard?.available_points ?? 0).toLocaleString()}</AppText>
            <AppText style={{ color: theme.textSecondary }}>
              Rate: {dashboard?.points_per_npr ?? 100} points = NPR 1.00
            </AppText>
            <AppText style={{ color: theme.textSecondary }}>
              Minimum: {(dashboard?.minimum_conversion_points ?? 1).toLocaleString()} points
              {maximum > 0 ? ` · Maximum: ${maximum.toLocaleString()}` : ''}
            </AppText>
          </View>

          <View style={[styles.inputCard, { backgroundColor: theme.surfacePrimary, borderColor: theme.border }]}>
            <AppText style={[styles.label, { color: theme.text }]}>Points to convert</AppText>
            <AppTextInput
              accessibilityLabel="Points to convert"
              value={pointsInput}
              onChangeText={handlePointsChange}
              keyboardType="number-pad"
              placeholder="Enter points"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
              maxLength={16}
            />
            {conversionOptions.length > 0 && (
              <View style={styles.options}>
                {conversionOptions.map((option) => (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    onPress={() => handlePointsChange(String(option))}
                    style={[styles.option, { borderColor: theme.border, backgroundColor: pointsInput === String(option) ? theme.surfaceElevated : theme.background }]}
                  >
                    <AppText style={{ color: theme.text }}>{option.toLocaleString()}</AppText>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View style={[styles.previewCard, { backgroundColor: theme.isDark ? '#002235' : '#FFF8EA', borderColor: theme.border }]}>
            <View style={styles.previewRow}><AppText style={{ color: theme.textSecondary }}>Wallet credit</AppText><AppText style={[styles.previewValue, { color: '#1B8A5A' }]}>{walletCredit === null ? '—' : formatMinor(walletCredit)}</AppText></View>
            <View style={styles.previewRow}><AppText style={{ color: theme.textSecondary }}>Remaining points</AppText><AppText style={[styles.previewValue, { color: theme.text }]}>{isValid ? remainingPoints.toLocaleString() : '—'}</AppText></View>
          </View>

          <PrimaryButton
            label="Review conversion"
            disabled={!isValid || submitting}
            onPress={() => setConfirmVisible(true)}
            style={styles.primaryButton}
          />
        </ScrollView>
      )}

      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.surfacePrimary }]}>
            <AppText style={[styles.modalTitle, { color: theme.text }]}>Confirm conversion</AppText>
            <AppText style={{ color: theme.textSecondary, lineHeight: 22 }}>
              Convert {parsedPoints.toLocaleString()} points at {dashboard?.points_per_npr} points per NPR 1 and credit {walletCredit === null ? '—' : formatMinor(walletCredit)} to your Tap & Pay wallet?
            </AppText>
            <AppText style={{ color: theme.textSecondary }}>Points remaining: {remainingPoints.toLocaleString()}</AppText>
            <PrimaryButton label={submitting ? 'Converting…' : 'Confirm conversion'} disabled={submitting} onPress={() => void confirmConversion()} />
            <Pressable accessibilityRole="button" disabled={submitting} onPress={() => setConfirmVisible(false)} style={styles.cancelButton}>
              <AppText style={{ color: theme.textSecondary }}>Cancel</AppText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={receipt !== null} transparent animationType="fade" onRequestClose={() => setReceipt(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.surfacePrimary }]}>
            <View style={styles.successIcon}><SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={28} tintColor="#FFFFFF" /></View>
            <AppText style={[styles.modalTitle, { color: theme.text }]}>Conversion successful</AppText>
            <AppText style={{ color: theme.textSecondary, textAlign: 'center' }}>
              {receipt?.points_converted.toLocaleString()} points converted into {receipt?.wallet_credit_formatted}.
            </AppText>
            <View style={[styles.receiptBox, { backgroundColor: theme.background }]}>
              <AppText style={{ color: theme.textSecondary }}>Reward points remaining</AppText>
              <AppText style={[styles.receiptAmount, { color: theme.text }]}>{receipt?.points_balance_after.toLocaleString()}</AppText>
              <AppText style={{ color: theme.textSecondary }}>Wallet balance</AppText>
              <AppText style={[styles.receiptAmount, { color: theme.text }]}>
                {receipt ? formatMinor(BigInt(receipt.wallet_balance_after_minor)) : '—'}
              </AppText>
              <AppText style={{ color: theme.textMuted, fontSize: 11 }}>Ref: {receipt?.conversion_reference}</AppText>
            </View>
            <PrimaryButton label="Done" onPress={() => { setReceipt(null); router.replace('/passenger/rewards'); }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  backButton: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 22, fontWeight: '800' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 14 },
  infoCard: { borderRadius: 18, borderWidth: 1, padding: 18, gap: 6 },
  label: { fontSize: 14, fontWeight: '700' },
  available: { fontSize: 34, fontWeight: '800', marginBottom: 4 },
  inputCard: { borderRadius: 18, borderWidth: 1, padding: 18, gap: 12 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  previewCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewValue: { fontSize: 18, fontWeight: '800' },
  primaryButton: { marginTop: 4 },
  errorBox: { borderWidth: 1, borderRadius: 12, padding: 14 },
  modalBackdrop: { flex: 1, backgroundColor: '#00000099', justifyContent: 'center', padding: 24 },
  modalCard: { borderRadius: 20, padding: 22, gap: 14 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  cancelButton: { alignItems: 'center', padding: 8 },
  successIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1B8A5A', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  receiptBox: { borderRadius: 14, padding: 14, alignItems: 'center', gap: 6 },
  receiptAmount: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
});
