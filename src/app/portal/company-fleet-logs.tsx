import {AppText, AppTextInput } from '@/components/typography/app-text';
import { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import {
  createCompanyFuelExpense,
  createCompanyMaintenance,
  getCompanyBuses,
  getCompanyFuelExpenses,
  getCompanyMaintenance,
  updateCompanyMaintenance,
  type CompanyBus,
  type CompanyFuelExpense,
  type CompanyMaintenanceRecord,
} from '@/features/admin/services/adminApi';

type LogTab = 'maintenance' | 'fuel';

function minorUnits(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(normalized)) return null;
  const [rupees, paisa = ''] = normalized.split('.');
  return Number(rupees) * 100 + Number(paisa.padEnd(2, '0'));
}

export default function CompanyFleetLogsScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<LogTab>('maintenance');
  const [buses, setBuses] = useState<CompanyBus[]>([]);
  const [selectedBusId, setSelectedBusId] = useState<number | null>(null);
  const [maintenance, setMaintenance] = useState<CompanyMaintenanceRecord[]>([]);
  const [fuel, setFuel] = useState<CompanyFuelExpense[]>([]);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [cost, setCost] = useState('');
  const [odometer, setOdometer] = useState('');
  const [liters, setLiters] = useState('');
  const [station, setStation] = useState('');
  const [nextDue, setNextDue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [busResult, maintenanceResult, fuelResult] = await Promise.all([
        getCompanyBuses(),
        getCompanyMaintenance(),
        getCompanyFuelExpenses(),
      ]);
      if (!busResult.ok || !busResult.data || !maintenanceResult.ok || !maintenanceResult.data || !fuelResult.ok || !fuelResult.data) {
        setError(
          (!busResult.ok ? busResult.message : null)
          || (!maintenanceResult.ok ? maintenanceResult.message : null)
          || (!fuelResult.ok ? fuelResult.message : null)
          || 'Unable to load fleet records.',
        );
        return;
      }
      setBuses(busResult.data.buses);
      setSelectedBusId((current) => current ?? busResult.data.buses[0]?.id ?? null);
      setMaintenance(maintenanceResult.data.vehicle_maintenance_records);
      setFuel(fuelResult.data.vehicle_fuel_expenses);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Network error loading fleet records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void load());
    return () => cancelAnimationFrame(frame);
  }, [load]);

  const submitMaintenance = async () => {
    if (selectedBusId === null || !title.trim()) {
      setError('Select a vehicle and enter the maintenance task title.');
      return;
    }
    const costMinor = cost.trim() ? minorUnits(cost) : null;
    if (cost.trim() && costMinor === null) {
      setError('Enter a valid maintenance cost in NPR.');
      return;
    }
    if (odometer.trim() && (!Number.isFinite(Number(odometer)) || Number(odometer) < 0)) {
      setError('Enter a valid odometer reading in kilometres.');
      return;
    }
    if (nextDue.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(nextDue.trim())) {
      setError('Enter the next service due date using YYYY-MM-DD.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await createCompanyMaintenance({
        bus_id: selectedBusId,
        title: title.trim(),
        ...(details.trim() ? { details: details.trim() } : {}),
        scheduled_at: new Date().toISOString(),
        ...(nextDue.trim() ? { next_due_at: new Date(`${nextDue.trim()}T00:00:00`).toISOString() } : {}),
        ...(costMinor !== null ? { cost_minor: costMinor } : {}),
        ...(odometer.trim() ? { odometer_km: Number(odometer) } : {}),
      });
      if (!result.ok || !result.data) {
        setError(result.message || 'Maintenance record was not saved.');
        return;
      }
      setMaintenance((current) => [result.data.maintenance, ...current]);
      setTitle('');
      setDetails('');
      setCost('');
      setOdometer('');
      setNextDue('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Network error saving maintenance record.');
    } finally {
      setSaving(false);
    }
  };

  const submitFuel = async () => {
    const amountMinor = minorUnits(cost);
    if (selectedBusId === null || amountMinor === null || !Number.isFinite(Number(liters)) || Number(liters) <= 0
      || !Number.isFinite(Number(odometer)) || Number(odometer) < 0) {
      setError('Select a vehicle and enter valid amount, litres, and odometer values.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await createCompanyFuelExpense({
        bus_id: selectedBusId,
        amount_minor: amountMinor,
        liters: Number(liters),
        odometer_km: Number(odometer),
        ...(station.trim() ? { station: station.trim() } : {}),
        occurred_at: new Date().toISOString(),
      });
      if (!result.ok || !result.data) {
        setError(result.message || 'Fuel expense was not saved.');
        return;
      }
      setFuel((current) => [result.data.expense, ...current]);
      setCost('');
      setOdometer('');
      setLiters('');
      setStation('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Network error recording fuel expense.');
    } finally {
      setSaving(false);
    }
  };

  const advanceMaintenance = async (record: CompanyMaintenanceRecord) => {
    const status = record.status === 'scheduled' ? 'in_progress' : record.status === 'in_progress' ? 'completed' : null;
    if (!status) return;
    setBusyId(record.id);
    setError(null);
    try {
      const result = await updateCompanyMaintenance(record.id, { status });
      if (!result.ok || !result.data) {
        setError(result.message || 'Maintenance status was not updated.');
        return;
      }
      setMaintenance((current) => current.map((item) => item.id === record.id ? result.data.maintenance : item));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Network error updating maintenance status.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/portal/company')} style={styles.back}>
          <AppText style={styles.backText}>‹ Company Fleet</AppText>
        </Pressable>
        <AppText style={styles.pageTitle}>Maintenance &amp; fuel</AppText>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.tabs}>
          {(['maintenance', 'fuel'] as const).map((tab) => (
            <Pressable key={tab} accessibilityRole="button" onPress={() => { setActiveTab(tab); setError(null); }} style={[styles.tab, activeTab === tab && styles.tabActive]}>
              <AppText style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab === 'fuel' ? 'Fuel expenses' : 'Maintenance'}</AppText>
            </Pressable>
          ))}
        </View>
        <View style={styles.card}>
          <AppText style={styles.label}>Vehicle</AppText>
          <View style={styles.options}>
            {buses.map((bus) => (
              <Pressable key={bus.id} accessibilityRole="button" onPress={() => setSelectedBusId(bus.id)} style={[styles.option, selectedBusId === bus.id && styles.optionActive]}>
                <AppText style={[styles.optionText, selectedBusId === bus.id && styles.optionTextActive]}>{bus.bus_number}</AppText>
              </Pressable>
            ))}
          </View>
          {activeTab === 'maintenance' ? (
            <>
              <AppTextInput value={title} onChangeText={setTitle} placeholder="Maintenance task" placeholderTextColor="#9297A0" style={styles.input} accessibilityLabel="Maintenance task" />
              <AppTextInput value={details} onChangeText={setDetails} placeholder="Details (optional)" placeholderTextColor="#9297A0" multiline style={[styles.input, styles.multiline]} accessibilityLabel="Maintenance details" />
              <AppTextInput value={cost} onChangeText={setCost} placeholder="Cost in NPR (optional)" placeholderTextColor="#9297A0" keyboardType="decimal-pad" style={styles.input} accessibilityLabel="Maintenance cost in NPR" />
              <AppTextInput value={odometer} onChangeText={setOdometer} placeholder="Odometer in km (optional)" placeholderTextColor="#9297A0" keyboardType="decimal-pad" style={styles.input} accessibilityLabel="Maintenance odometer" />
              <AppTextInput value={nextDue} onChangeText={setNextDue} placeholder="Next due date YYYY-MM-DD (optional)" placeholderTextColor="#9297A0" style={styles.input} accessibilityLabel="Next maintenance due date" />
              <Pressable accessibilityRole="button" disabled={saving} onPress={() => void submitMaintenance()} style={styles.primaryButton}>
                {saving ? <ActivityIndicator color="#FFFFFF" /> : <AppText style={styles.primaryText}>Schedule maintenance</AppText>}
              </Pressable>
            </>
          ) : (
            <>
              <AppTextInput value={cost} onChangeText={setCost} placeholder="Total cost in NPR" placeholderTextColor="#9297A0" keyboardType="decimal-pad" style={styles.input} accessibilityLabel="Fuel expense in NPR" />
              <AppTextInput value={liters} onChangeText={setLiters} placeholder="Fuel quantity in litres" placeholderTextColor="#9297A0" keyboardType="decimal-pad" style={styles.input} accessibilityLabel="Fuel quantity in litres" />
              <AppTextInput value={odometer} onChangeText={setOdometer} placeholder="Odometer in km" placeholderTextColor="#9297A0" keyboardType="decimal-pad" style={styles.input} accessibilityLabel="Fuel odometer" />
              <AppTextInput value={station} onChangeText={setStation} placeholder="Fuel station (optional)" placeholderTextColor="#9297A0" style={styles.input} accessibilityLabel="Fuel station" />
              <Pressable accessibilityRole="button" disabled={saving} onPress={() => void submitFuel()} style={styles.primaryButton}>
                {saving ? <ActivityIndicator color="#FFFFFF" /> : <AppText style={styles.primaryText}>Record fuel expense</AppText>}
              </Pressable>
            </>
          )}
          {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
        </View>
        {loading ? <ActivityIndicator color={Brand.white} style={styles.loader} /> : activeTab === 'maintenance' ? (
          maintenance.length === 0 ? <AppText style={styles.empty}>No maintenance records yet.</AppText> : maintenance.map((record) => (
            <View key={record.id} style={styles.record}>
              <AppText style={styles.recordTitle}>{record.title} · {record.bus_number || 'Vehicle'}</AppText>
              <AppText style={styles.recordMeta}>{record.status.replaceAll('_', ' ').toUpperCase()} · {new Date(record.scheduled_at).toLocaleDateString()}</AppText>
              {record.details ? <AppText style={styles.recordMeta}>{record.details}</AppText> : null}
              {record.next_due_at ? <AppText style={styles.recordMeta}>Next due: {new Date(record.next_due_at).toLocaleDateString()}</AppText> : null}
              {record.status === 'scheduled' || record.status === 'in_progress' ? (
                <Pressable disabled={busyId === record.id} onPress={() => void advanceMaintenance(record)} style={styles.secondaryButton}>
                  <AppText style={styles.secondaryText}>{busyId === record.id ? 'Updating…' : record.status === 'scheduled' ? 'Start work' : 'Complete work'}</AppText>
                </Pressable>
              ) : null}
            </View>
          ))
        ) : fuel.length === 0 ? <AppText style={styles.empty}>No fuel expenses recorded.</AppText> : fuel.map((expense) => (
          <View key={expense.id} style={styles.record}>
            <AppText style={styles.recordTitle}>{expense.bus_number || 'Vehicle'} · Rs. {(expense.amount_minor / 100).toFixed(2)}</AppText>
            <AppText style={styles.recordMeta}>{expense.liters} L · {expense.odometer_km} km · {new Date(expense.occurred_at).toLocaleString()}</AppText>
            {expense.station ? <AppText style={styles.recordMeta}>{expense.station}</AppText> : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111318' },
  header: { paddingHorizontal: 18, paddingVertical: 14, gap: 8 },
  back: { alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { color: '#D1D4D8', fontSize: 14, fontWeight: '600' },
  pageTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  content: { paddingHorizontal: 16, gap: 12 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#3A3E46' },
  tabActive: { borderColor: '#FFFFFF', backgroundColor: '#30343C' },
  tabText: { color: '#BFC3C9', fontSize: 12 },
  tabTextActive: { color: '#FFFFFF', fontWeight: '700' },
  card: { padding: 14, borderRadius: 12, backgroundColor: '#1B1E24', gap: 10 },
  label: { color: '#D1D4D8', fontSize: 12, fontWeight: '700' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  option: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#41454D' },
  optionActive: { borderColor: '#FFFFFF', backgroundColor: '#343841' },
  optionText: { color: '#BFC3C9', fontSize: 11 },
  optionTextActive: { color: '#FFFFFF', fontWeight: '700' },
  input: { color: '#FFFFFF', borderColor: '#3A3E46', borderWidth: 1, borderRadius: 9, padding: 11, fontSize: 13 },
  multiline: { minHeight: 65, textAlignVertical: 'top' },
  primaryButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#30343C' },
  primaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  error: { color: '#FFB3B3', fontSize: 12 },
  loader: { padding: 18 },
  empty: { color: '#A8ADB5', fontSize: 13, paddingVertical: 12 },
  record: { padding: 13, borderRadius: 11, backgroundColor: '#1B1E24', gap: 6 },
  recordTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  recordMeta: { color: '#A8ADB5', fontSize: 11, lineHeight: 16 },
  secondaryButton: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 7, borderWidth: 1, borderColor: '#41454D' },
  secondaryText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
});
