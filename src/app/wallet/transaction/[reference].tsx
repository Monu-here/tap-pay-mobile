import { AppText } from '@/components/typography/app-text';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { Palette, SemanticColors, Spacing } from '@/constants/theme';
import { getWalletTransaction } from '@/features/passenger/services/passengerApi';
import { useTheme } from '@/hooks/use-theme';
import { LinearGradient } from 'expo-linear-gradient';

export default function TransactionDetailScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { reference } = useLocalSearchParams<{ reference: string }>();

  const [loading, setLoading] = useState(true);
  const [txn, setTxn] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reference) return;
    (async () => {
      setLoading(true);
      try {
        const res = await getWalletTransaction(reference);
        if (res.ok && res.data) {
          setTxn(res.data.transaction);
        } else {
          setError(res.message || 'Transaction not found.');
        }
      } catch {
        setError('Connection error fetching transaction.');
      } finally {
        setLoading(false);
      }
    })();
  }, [reference]);

  const isCredit = txn?.direction === 'credit';
  const amountMinor = txn?.amount_minor ?? txn?.amount?.amount_minor ?? 0;
  const amountFormatted = txn?.amount?.formatted ?? `Rs. ${(amountMinor / 100).toFixed(2)}`;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style="light" />

      <LinearGradient
        colors={['#003049', '#001824']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={8}
        >
          <SymbolView
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            size={20}
            tintColor={Palette.warmCream}
          />
        </Pressable>
        <AppText style={styles.headerTitle}>Transaction Detail</AppText>
        <View style={styles.headerSpacer} />
      </LinearGradient>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={theme.actionPrimary} />
            <AppText style={[styles.loadingText, { color: theme.textSecondary }]}>Loading ledger transaction...</AppText>
          </View>
        ) : error ? (
          <View style={[styles.errorBox, { backgroundColor: theme.surfacePrimary, borderColor: theme.border }]}>
            <AppText style={[styles.errorText, { color: theme.text }]}>{error}</AppText>
          </View>
        ) : txn ? (
          <View style={[styles.receiptCard, { backgroundColor: theme.surfacePrimary, borderColor: theme.border }]}>
            <LinearGradient
              colors={['#003049', '#001824']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardHeader}
            >
              <View style={styles.statusIconBox}>
                <SymbolView
                  name={{
                    ios: isCredit ? 'arrow.down.left' : 'arrow.up.right',
                    android: isCredit ? 'arrow_downward' : 'arrow_upward',
                    web: isCredit ? 'arrow_downward' : 'arrow_upward',
                  }}
                  size={26}
                  tintColor={isCredit ? SemanticColors.success : Palette.crimsonRed}
                />
              </View>
              <AppText style={styles.transactionTitle}>{txn.description || txn.type}</AppText>
              <AppText style={styles.amountValue}>
                {isCredit ? '+' : '-'}{amountFormatted}
              </AppText>
              <View style={styles.statusPill}>
                <AppText style={styles.statusPillText}>{txn.status?.toUpperCase() || 'SUCCESSFUL'}</AppText>
              </View>
            </LinearGradient>

            <View style={styles.perforationRow}>
              <View style={[styles.circleCutLeft, { backgroundColor: theme.background }]} />
              <View style={[styles.dashedLine, { borderColor: theme.border }]} />
              <View style={[styles.circleCutRight, { backgroundColor: theme.background }]} />
            </View>
            <View style={styles.detailsGroup}>
              <View style={styles.detailRow}>
                <AppText style={[styles.rowLabel, { color: theme.textMuted }]}>Reference</AppText>
                <AppText style={[styles.rowValue, styles.mono, { color: theme.text }]}>{txn.reference || reference}</AppText>
              </View>

              <View style={styles.detailRow}>
                <AppText style={[styles.rowLabel, { color: theme.textMuted }]}>Type</AppText>
                <AppText style={[styles.rowValue, { color: theme.text }]}>{txn.type_label || txn.type}</AppText>
              </View>

              <View style={styles.detailRow}>
                <AppText style={[styles.rowLabel, { color: theme.textMuted }]}>Direction</AppText>
                <AppText style={[styles.rowValue, { color: theme.text }]}>{txn.direction_label || txn.direction}</AppText>
              </View>

              <View style={styles.detailRow}>
                <AppText style={[styles.rowLabel, { color: theme.textMuted }]}>Currency</AppText>
                <AppText style={[styles.rowValue, { color: theme.text }]}>{txn.currency || 'NPR'}</AppText>
              </View>

              {txn.balance_before && (
                <View style={styles.detailRow}>
                  <AppText style={[styles.rowLabel, { color: theme.textMuted }]}>Balance Before</AppText>
                  <AppText style={[styles.rowValue, { color: theme.text }]}>{txn.balance_before.formatted || `Rs. ${(txn.balance_before.amount_minor / 100).toFixed(2)}`}</AppText>
                </View>
              )}

              {txn.balance_after && (
                <View style={styles.detailRow}>
                  <AppText style={[styles.rowLabel, { color: theme.textMuted }]}>Balance After</AppText>
                  <AppText style={[styles.rowValue, { color: theme.text }]}>{txn.balance_after.formatted || `Rs. ${(txn.balance_after.amount_minor / 100).toFixed(2)}`}</AppText>
                </View>
              )}

              {txn.card && (
                <View style={styles.detailRow}>
                  <AppText style={[styles.rowLabel, { color: theme.textMuted }]}>Transit Card</AppText>
                  <AppText style={[styles.rowValue, { color: theme.text }]}>{txn.card.masked_code || txn.card.card_uid}</AppText>
                </View>
              )}

              <View style={styles.detailRow}>
                <AppText style={[styles.rowLabel, { color: theme.textMuted }]}>Timestamp</AppText>
                <AppText style={[styles.rowValue, { color: theme.text }]}>
                  {txn.created_at ? new Date(txn.created_at).toLocaleString() : 'Not available'}
                </AppText>
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingBottom: 20,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(253,240,213,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 38,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Palette.warmCream,
    letterSpacing: -0.2,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  loadingBox: {
    padding: Spacing.six,
    alignItems: 'center',
    gap: Spacing.two,
  },
  loadingText: {
    fontSize: 13,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 18,
    padding: Spacing.four,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
  },
  receiptCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#001824',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 210,
    justifyContent: 'center',
  },
  statusIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(253,240,213,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  transactionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(253,240,213,0.72)',
    textAlign: 'center',
  },
  amountValue: {
    fontSize: 34,
    fontWeight: '800',
    color: Palette.warmCream,
    letterSpacing: -0.5,
    marginVertical: Spacing.one,
  },
  statusPill: {
    backgroundColor: 'rgba(253,240,213,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(253,240,213,0.16)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 2,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: Palette.warmCream,
    letterSpacing: 0.6,
  },
  perforationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 24,
  },
  circleCutLeft: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: -10,
  },
  circleCutRight: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: -10,
  },
  dashedLine: {
    flex: 1,
    height: 1,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginHorizontal: Spacing.two,
  },
  detailsGroup: {
    padding: Spacing.five,
    gap: Spacing.three,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    maxWidth: '65%',
  },
  mono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
  },
});
