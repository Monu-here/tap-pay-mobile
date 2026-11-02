import { AppText, AppTextInput } from '@/components/typography/app-text';
import { Brand, Spacing } from '@/constants/theme';
import {
  approvePlatformConcessionFunding,
  createPlatformConcessionPolicy,
  getPlatformConcessionPolicies,
  setPlatformConcessionPolicyStatus,
  type PlatformConcessionPolicy,
} from '@/features/admin/services/adminApi';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Category = PlatformConcessionPolicy['category'];
type FundingModel = PlatformConcessionPolicy['funding_model'];

const today = () => new Date().toISOString().slice(0, 10);

export default function ConcessionPoliciesScreen() {
  const insets = useSafeAreaInsets();
  const [policies, setPolicies] = useState<PlatformConcessionPolicy[]>([]);
  const [category, setCategory] = useState<Category>('student');
  const [percentage, setPercentage] = useState('45');
  const [minimumAge, setMinimumAge] = useState('');
  const [validityMonths, setValidityMonths] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(today());
  const [effectiveUntil, setEffectiveUntil] = useState('');
  const [maximumDiscount, setMaximumDiscount] = useState('');
  const [documents, setDocuments] = useState('college_id_card');
  const [companies, setCompanies] = useState('');
  const [vehicleTypes, setVehicleTypes] = useState('');
  const [fareRules, setFareRules] = useState('');
  const [fundingModel, setFundingModel] = useState<FundingModel | null>(null);
  const [approvalReference, setApprovalReference] = useState('');
  const [renewalRequired, setRenewalRequired] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getPlatformConcessionPolicies();
      if (!result.ok || !result.data) {
        setError(result.message || 'Unable to load concession policies.');
      } else {
        setPolicies(result.data.policies);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load policies.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void load());
    return () => cancelAnimationFrame(frame);
  }, [load]);

  const chooseCategory = (value: Category) => {
    setCategory(value);
    setPercentage(value === 'student' ? '45' : '50');
    setMinimumAge(value === 'student' ? '' : minimumAge);
    setDocuments(value === 'student' ? 'college_id_card' : 'senior_citizen_card,citizenship_certificate');
  };

  const create = async () => {
    const parsedPercentage = Number(percentage);
    if (!Number.isFinite(parsedPercentage) || parsedPercentage < 0 || parsedPercentage > 100) {
      setError('Discount percentage must be between 0 and 100.');
      return;
    }
    if (!fundingModel) {
      setError('Choose an approved funding model; none is selected by default.');
      return;
    }
    let parsedFareRules: Record<string, unknown> | null = null;
    if (fareRules.trim()) {
      try {
        const parsed: unknown = JSON.parse(fareRules);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          setError('Fare rules must be a JSON object.');
          return;
        }
        parsedFareRules = parsed as Record<string, unknown>;
      } catch {
        setError('Fare rules must be valid JSON.');
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      const result = await createPlatformConcessionPolicy({
        category,
        discount_percentage: percentage,
        minimum_eligibility_age: category === 'senior_citizen' ? Number(minimumAge) : null,
        verification_required: true,
        document_types: documents.split(',').map((item) => item.trim()).filter(Boolean),
        validity_months: validityMonths.trim() ? Number(validityMonths) : null,
        renewal_required: renewalRequired,
        company_ids: companies.trim()
          ? companies.split(',').map((item) => Number(item.trim())).filter(Number.isInteger)
          : null,
        vehicle_types: vehicleTypes.trim()
          ? vehicleTypes.split(',').map((item) => item.trim()).filter(Boolean)
          : null,
        effective_from: effectiveFrom,
        effective_until: effectiveUntil || null,
        maximum_discount_minor: maximumDiscount.trim() ? Number(maximumDiscount) : null,
        fare_rules: parsedFareRules,
        funding_model: fundingModel,
      });
      if (!result.ok || !result.data) {
        setError(result.message || 'Could not create policy version.');
        return;
      }

      if (!approvalReference.trim()) {
        setError('Policy created disabled. Add the documented funding approval reference to activate it.');
        await load();
        return;
      }
      const approved = await approvePlatformConcessionFunding(
        result.data.policy.id,
        approvalReference.trim(),
      );
      if (!approved.ok) {
        setError(approved.message || 'Policy created, but funding approval could not be recorded.');
        await load();
        return;
      }
      const activated = await setPlatformConcessionPolicyStatus(result.data.policy.id, true);
      if (!activated.ok) {
        setError(activated.message || 'Funding is approved, but policy activation failed.');
        await load();
        return;
      }
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save policy.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (policy: PlatformConcessionPolicy) => {
    if (policy.enabled) {
      const result = await setPlatformConcessionPolicyStatus(policy.id, false);
      if (!result.ok) setError(result.message || 'Could not deactivate policy.');
      else await load();
      return;
    }
    Alert.alert(
      'Activate concession policy?',
      `Enable version ${policy.version} for ${policy.category.replace('_', ' ')}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate',
          onPress: () => void (async () => {
            const result = await setPlatformConcessionPolicyStatus(policy.id, true);
            if (!result.ok) setError(result.message || 'Could not activate policy.');
            else await load();
          })(),
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <AppText style={styles.link}>‹  Back</AppText>
        </Pressable>
        <AppText style={styles.title}>Concession policies</AppText>
        <View style={styles.spacer} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <AppText style={styles.intro}>
          New versions are disabled by default. Configure and approve funding explicitly before activation.
        </AppText>
        <AppText style={styles.section}>Create policy version</AppText>
        <View style={styles.categoryRow}>
          {(['student', 'senior_citizen'] as const).map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected: category === item }}
              onPress={() => chooseCategory(item)}
              style={[styles.category, category === item && styles.categorySelected]}
            >
              <AppText style={category === item ? styles.selectedText : styles.text}>
                {item === 'student' ? 'Student' : 'Senior citizen'}
              </AppText>
            </Pressable>
          ))}
        </View>
        <AppTextInput accessibilityLabel="Discount percentage" value={percentage} onChangeText={setPercentage} keyboardType="decimal-pad" placeholder="Discount percentage" style={styles.input} />
        {category === 'senior_citizen' ? (
          <AppTextInput accessibilityLabel="Minimum eligibility age" value={minimumAge} onChangeText={setMinimumAge} keyboardType="number-pad" placeholder="Minimum eligibility age" style={styles.input} />
        ) : null}
        <AppTextInput accessibilityLabel="Accepted document types" value={documents} onChangeText={setDocuments} placeholder="Document types, comma separated" style={styles.input} />
        <AppTextInput accessibilityLabel="Validity in months" value={validityMonths} onChangeText={setValidityMonths} keyboardType="number-pad" placeholder="Validity period in months (optional)" style={styles.input} />
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: renewalRequired }} onPress={() => setRenewalRequired((value) => !value)} style={styles.checkRow}>
          <AppText style={styles.selectedText}>{renewalRequired ? '☑' : '☐'}</AppText>
          <AppText style={styles.text}>Renewal required</AppText>
        </Pressable>
        <AppTextInput accessibilityLabel="Applicable company IDs" value={companies} onChangeText={setCompanies} placeholder="Company IDs (blank = all companies)" style={styles.input} />
        <AppTextInput accessibilityLabel="Applicable vehicle types" value={vehicleTypes} onChangeText={setVehicleTypes} placeholder="Vehicle types: bus, minibus, micro, electric" style={styles.input} />
        <AppTextInput accessibilityLabel="Effective from" value={effectiveFrom} onChangeText={setEffectiveFrom} placeholder="Effective from (YYYY-MM-DD)" style={styles.input} />
        <AppTextInput accessibilityLabel="Effective until" value={effectiveUntil} onChangeText={setEffectiveUntil} placeholder="Effective until (optional)" style={styles.input} />
        <AppTextInput accessibilityLabel="Maximum discount" value={maximumDiscount} onChangeText={setMaximumDiscount} keyboardType="number-pad" placeholder="Maximum discount in paisa (optional)" style={styles.input} />
        <AppTextInput accessibilityLabel="Fare rules JSON" value={fareRules} onChangeText={setFareRules} placeholder='Fare rules JSON, e.g. {"fare_rule_ids":[1,2]}' style={styles.input} />
        <AppText style={styles.section}>Funding model</AppText>
        <View style={styles.categoryRow}>
          {([
            ['operator_funded', 'Operator'],
            ['platform_funded', 'Platform'],
            ['government_funded', 'Government'],
          ] as const).map(([value, label]) => (
            <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: fundingModel === value }} onPress={() => setFundingModel(value)} style={[styles.category, fundingModel === value && styles.categorySelected]}>
              <AppText style={fundingModel === value ? styles.selectedText : styles.text}>{label}</AppText>
            </Pressable>
          ))}
        </View>
        <AppTextInput accessibilityLabel="Funding approval reference" value={approvalReference} onChangeText={setApprovalReference} placeholder="Approved funding reference" style={styles.input} />
        {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
        <Pressable accessibilityRole="button" disabled={saving} onPress={() => void create()} style={styles.primary}>
          {saving ? <ActivityIndicator color="#fff" /> : <AppText style={styles.primaryText}>Create, approve funding & activate</AppText>}
        </Pressable>

        <AppText style={styles.section}>Policy history</AppText>
        {loading ? <ActivityIndicator color={Brand.teal.primary} /> : policies.map((policy) => (
          <View key={policy.id} style={styles.policy}>
            <View style={styles.policyTop}>
              <AppText style={styles.policyTitle}>
                {policy.category === 'student' ? 'Student' : 'Senior citizen'} · v{policy.version}
              </AppText>
              <AppText style={policy.enabled ? styles.active : styles.inactive}>
                {policy.enabled ? 'ACTIVE' : 'DISABLED'}
              </AppText>
            </View>
            <AppText style={styles.text}>
              {policy.discount_percentage}% · {policy.funding_model.replace('_funded', '')} funded
            </AppText>
            <AppText style={styles.hint}>
              Funding approval: {policy.funding_approval_reference || 'not recorded'}
            </AppText>
            <Pressable accessibilityRole="button" onPress={() => void toggle(policy)} style={styles.secondary}>
              <AppText style={styles.link}>{policy.enabled ? 'Deactivate' : 'Activate'}</AppText>
            </Pressable>
          </View>
        ))}
        {!loading && policies.length === 0 ? <AppText style={styles.hint}>No policy versions have been configured.</AppText> : null}
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
  intro: { color: Brand.textSecondary, lineHeight: 21 },
  section: { color: Brand.text, fontSize: 17, fontWeight: '700', marginTop: Spacing.two },
  categoryRow: { flexDirection: 'row', gap: Spacing.two },
  category: { flex: 1, borderWidth: 1, borderColor: Brand.divider, borderRadius: 10, padding: Spacing.two, alignItems: 'center', backgroundColor: '#fff' },
  categorySelected: { borderColor: Brand.teal.primary, backgroundColor: '#EAF7F6' },
  selectedText: { color: Brand.teal.primary, fontWeight: '700' },
  text: { color: Brand.text },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: Brand.divider, borderRadius: 10, paddingHorizontal: Spacing.two, paddingVertical: 13, color: Brand.text },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
  primary: { minHeight: 50, borderRadius: 12, backgroundColor: Brand.teal.primary, justifyContent: 'center', alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
  policy: { padding: Spacing.three, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: Brand.divider, gap: Spacing.one },
  policyTop: { flexDirection: 'row', justifyContent: 'space-between' },
  policyTitle: { color: Brand.text, fontWeight: '700' },
  active: { color: '#16803C', fontWeight: '800', fontSize: 12 },
  inactive: { color: Brand.textSecondary, fontWeight: '800', fontSize: 12 },
  hint: { color: Brand.textSecondary, fontSize: 13 },
  secondary: { alignSelf: 'flex-start', paddingVertical: Spacing.one },
  error: { color: Brand.error },
});
