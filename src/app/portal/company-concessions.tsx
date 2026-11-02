import { AppText } from '@/components/typography/app-text';
import { Brand, Spacing } from '@/constants/theme';
import { API_BASE_URL } from '@/config/api';
import { getSession } from '@/features/auth/session';
import {
  getCompanyConcessionReport,
  getCompanyConcessionTransactions,
  type CompanyConcessionTransaction,
} from '@/features/admin/services/adminApi';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CompanyConcessionsScreen() {
  const insets = useSafeAreaInsets();
  const [transactions, setTransactions] = useState<CompanyConcessionTransaction[]>([]);
  const [summary, setSummary] = useState<{
    trip_count: number;
    regular_fare_minor: number;
    discount_minor: number;
    passenger_payable_minor: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [transactionResult, reportResult] = await Promise.all([
        getCompanyConcessionTransactions(),
        getCompanyConcessionReport(),
      ]);
      if (!transactionResult.ok || !transactionResult.data) {
        setError(transactionResult.message || 'Unable to load concession transactions.');
      } else {
        setTransactions(transactionResult.data.transactions);
      }
      if (!reportResult.ok || !reportResult.data) {
        setError(reportResult.message || 'Unable to load concession report.');
      } else {
        setSummary(reportResult.data.summary);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void load());
    return () => cancelAnimationFrame(frame);
  }, [load]);

  const exportCsv = async () => {
    setExporting(true);
    setError(null);
    try {
      const session = getSession();
      const response = await fetch(`${API_BASE_URL}/admin/company/concessions/reports?format=csv`, {
        headers: session.token ? { Authorization: `Bearer ${session.token}` } : {},
      });
      if (!response.ok) {
        setError('The company concession export could not be generated.');
        return;
      }
      const csv = await response.text();
      await Share.share({ title: 'Company concession transactions', message: csv });
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Unable to export concession transactions.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <AppText style={styles.link}>‹  Back</AppText>
        </Pressable>
        <AppText style={styles.title}>Concession reports</AppText>
        <View style={styles.spacer} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        {summary ? (
          <View style={styles.summary}>
            <AppText style={styles.label}>Company-scoped report</AppText>
            <AppText style={styles.value}>{summary.trip_count} discounted trips</AppText>
            <AppText style={styles.detail}>Regular fare: Rs. {(summary.regular_fare_minor / 100).toFixed(2)}</AppText>
            <AppText style={styles.detail}>Concessions: Rs. {(summary.discount_minor / 100).toFixed(2)}</AppText>
            <AppText style={styles.detail}>Passenger paid: Rs. {(summary.passenger_payable_minor / 100).toFixed(2)}</AppText>
          </View>
        ) : null}
        <Pressable accessibilityRole="button" disabled={exporting} onPress={() => void exportCsv()} style={styles.export}>
          {exporting ? <ActivityIndicator color="#fff" /> : <AppText style={styles.exportText}>Export concession CSV</AppText>}
        </Pressable>
        {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
        <AppText style={styles.section}>Concession transactions</AppText>
        {loading ? <ActivityIndicator color={Brand.teal.primary} /> : transactions.length === 0 ? (
          <AppText style={styles.detail}>No concession transactions were found for this company.</AppText>
        ) : transactions.map((transaction) => (
          <View key={transaction.travel_uid} style={styles.transaction}>
            <AppText style={styles.value}>
              {transaction.category === 'student' ? 'Student' : 'Senior citizen'}
              {transaction.discount_percentage ? ` · ${transaction.discount_percentage}%` : ''}
            </AppText>
            <AppText style={styles.detail}>
              {transaction.passenger?.name_en || transaction.passenger?.name || 'Passenger'} · Bus {transaction.bus_number || '—'}
            </AppText>
            <AppText style={styles.detail}>
              {transaction.boarding_point || 'Boarding'} → {transaction.exit_point || 'Exit'}
            </AppText>
            <AppText style={styles.detail}>
              Regular Rs. {(transaction.regular_fare_minor / 100).toFixed(2)}
              {' · '}Discount Rs. {(transaction.discount_minor / 100).toFixed(2)}
            </AppText>
            <AppText style={styles.detail}>
              Passenger paid Rs. {(transaction.passenger_payable_minor / 100).toFixed(2)}
              {' · '}Operator payable Rs. {(transaction.operator_settlement_minor / 100).toFixed(2)}
            </AppText>
            <AppText style={styles.hint}>
              Policy v{transaction.policy_version ?? '—'} · {transaction.paid_at ? new Date(transaction.paid_at).toLocaleString() : 'Unpaid'}
            </AppText>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.background },
  header: { minHeight: 54, paddingHorizontal: Spacing.three, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { minWidth: 70, paddingVertical: Spacing.two },
  link: { color: Brand.teal.primary, fontWeight: '700' },
  title: { color: Brand.text, fontSize: 18, fontWeight: '700' },
  spacer: { width: 70 },
  content: { padding: Spacing.three, gap: Spacing.two },
  summary: { backgroundColor: '#fff', borderWidth: 1, borderColor: Brand.divider, borderRadius: 12, padding: Spacing.three, gap: Spacing.one },
  label: { color: Brand.teal.primary, fontWeight: '700' },
  value: { color: Brand.text, fontWeight: '700' },
  detail: { color: Brand.textSecondary, lineHeight: 20 },
  hint: { color: Brand.textSecondary, fontSize: 12 },
  export: { minHeight: 48, borderRadius: 12, backgroundColor: Brand.teal.primary, alignItems: 'center', justifyContent: 'center' },
  exportText: { color: '#fff', fontWeight: '700' },
  error: { color: Brand.error },
  section: { color: Brand.text, fontWeight: '700', fontSize: 17, marginTop: Spacing.two },
  transaction: { backgroundColor: '#fff', borderWidth: 1, borderColor: Brand.divider, borderRadius: 12, padding: Spacing.three, gap: Spacing.one },
});
