import { AppText, AppTextInput } from '@/components/typography/app-text';
import { Monochrome, Spacing } from '@/constants/theme';
import { getSession } from '@/features/auth/session';
import { changeMpin, getMpinStatus, resetMpin, setMpin } from '@/features/passenger/services/passengerApi';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

type RecoveryMode = 'change' | 'reset';

export default function MpinSettingsScreen() {
  const insets = useSafeAreaInsets();
  const role = getSession().user?.type;
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [recoveryMode, setRecoveryMode] = useState<RecoveryMode>('change');
  const [currentMpin, setCurrentMpin] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newMpin, setNewMpin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getMpinStatus();
      if (!result.ok) {
        setError(result.message || 'Could not load MPIN status.');
        return;
      }
      setConfigured(result.data.configured);
      setRecoveryMode('change');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load MPIN status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadStatus();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadStatus]);

  const submit = async () => {
    setError(null);
    setSuccess(null);
    if (!/^\d{4}$/.test(newMpin)) {
      setError('Choose a four-digit MPIN.');
      return;
    }
    if (newMpin !== confirmation) {
      setError('The MPIN entries do not match.');
      return;
    }
    if (configured && recoveryMode === 'change' && !/^\d{4}$/.test(currentMpin)) {
      setError('Enter your current four-digit MPIN.');
      return;
    }
    if (configured && recoveryMode === 'reset' && !currentPassword) {
      setError('Enter your account password to verify your identity.');
      return;
    }

    setSaving(true);
    try {
      const result = !configured
        ? await setMpin(newMpin, confirmation)
        : recoveryMode === 'reset'
          ? await resetMpin(currentPassword, newMpin, confirmation)
          : await changeMpin(currentMpin, newMpin, confirmation);

      if (!result.ok) {
        setError(result.message || 'MPIN could not be saved. Please try again.');
        if (result.status === 429) setCurrentMpin('');
        return;
      }

      setConfigured(true);
      setCurrentMpin('');
      setCurrentPassword('');
      setNewMpin('');
      setConfirmation('');
      setRecoveryMode('change');
      setSuccess(!configured ? 'Your MPIN is ready to authorize payments.' : 'Your MPIN was updated securely.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const title = configured
    ? recoveryMode === 'reset' ? 'Reset MPIN' : 'Change MPIN'
    : 'Set Up MPIN';

  if (role !== 'passenger' && role !== 'driver') {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <AppText style={styles.title}>MPIN is unavailable for this account</AppText>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.backButton}>
          <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={19} tintColor={Monochrome.textPrimary} />
        </Pressable>
        <AppText style={styles.headerTitle}>Security &amp; MPIN</AppText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View style={styles.shield}>
            <SymbolView name={{ ios: 'lock.shield.fill', android: 'security', web: 'security' }} size={27} tintColor={Monochrome.textPrimary} />
          </View>
          <AppText style={styles.title}>{loading ? 'Checking your security…' : title}</AppText>
          <AppText style={styles.description}>
            Your four-digit MPIN authorizes payments from your wallet. It is stored as a secure hash on Tap &amp; Pay servers and is never saved on this device.
          </AppText>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={Monochrome.textPrimary} style={styles.loader} />
        ) : (
          <>
            <View style={styles.formCard}>
              {configured && recoveryMode === 'change' ? (
                <PinField label="Current MPIN" value={currentMpin} onChangeText={setCurrentMpin} />
              ) : null}

              {configured && recoveryMode === 'reset' ? (
                <View style={styles.field}>
                  <AppText style={styles.label}>Account password</AppText>
                  <AppTextInput
                    accessibilityLabel="Current account password"
                    style={styles.input}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Verify your account password"
                    placeholderTextColor={Monochrome.textMuted}
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="current-password"
                    textContentType="password"
                  />
                  <AppText style={styles.helper}>Forgot your MPIN? Re-authenticate with your account password to replace it.</AppText>
                </View>
              ) : null}

              <PinField label={configured ? 'New MPIN' : 'Four-digit MPIN'} value={newMpin} onChangeText={setNewMpin} />
              <PinField label="Confirm MPIN" value={confirmation} onChangeText={setConfirmation} />

              {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
              {success ? <AppText accessibilityLiveRegion="polite" style={styles.success}>{success}</AppText> : null}

              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() => void submit()}
                style={[styles.primaryButton, saving && styles.disabled]}
              >
                {saving
                  ? <ActivityIndicator color={Monochrome.actionPrimaryText} />
                  : <AppText style={styles.primaryText}>{title}</AppText>}
              </Pressable>
            </View>

            {configured ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setRecoveryMode((mode) => mode === 'change' ? 'reset' : 'change');
                  setCurrentMpin('');
                  setCurrentPassword('');
                  setNewMpin('');
                  setConfirmation('');
                  setError(null);
                  setSuccess(null);
                }}
                style={styles.secondaryButton}
              >
                <AppText style={styles.secondaryText}>
                  {recoveryMode === 'reset' ? 'I remember my current MPIN' : 'Forgot MPIN? Reset with account password'}
                </AppText>
              </Pressable>
            ) : null}

            <View style={styles.notice}>
              <SymbolView name={{ ios: 'info.circle.fill', android: 'info', web: 'info' }} size={16} tintColor={Monochrome.textSecondary} />
              <AppText style={styles.noticeText}>Never share your MPIN. Tap &amp; Pay staff will never ask you for it.</AppText>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PinField({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <AppText style={styles.label}>{label}</AppText>
      <AppTextInput
        accessibilityLabel={label}
        style={styles.input}
        value={value}
        onChangeText={(text) => onChangeText(text.replace(/\D/g, '').slice(0, 4))}
        placeholder="••••"
        placeholderTextColor={Monochrome.textMuted}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={4}
        autoComplete="off"
        autoCorrect={false}
      />
      <AppText style={styles.helper}>Enter exactly four digits.</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Monochrome.background },
  centered: { justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Monochrome.border,
  },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { color: Monochrome.textPrimary, fontSize: 17, fontWeight: '700' },
  headerSpacer: { width: 40 },
  content: { padding: Spacing.lg },
  hero: { alignItems: 'center', paddingVertical: Spacing.xl },
  shield: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: Monochrome.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: { color: Monochrome.textPrimary, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  description: { color: Monochrome.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: Spacing.sm },
  loader: { marginTop: Spacing.xl },
  formCard: {
    padding: Spacing.lg,
    borderRadius: 20,
    backgroundColor: Monochrome.surfaceSecondary,
    borderWidth: 1,
    borderColor: Monochrome.border,
    gap: Spacing.md,
  },
  field: { gap: 7 },
  label: { color: Monochrome.textPrimary, fontSize: 13, fontWeight: '600' },
  input: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Monochrome.border,
    backgroundColor: Monochrome.surfacePrimary,
    paddingHorizontal: 14,
    color: Monochrome.textPrimary,
    fontSize: 18,
    letterSpacing: 5,
  },
  helper: { color: Monochrome.textMuted, fontSize: 12, lineHeight: 17 },
  error: { color: '#B42318', fontSize: 13, lineHeight: 18 },
  success: { color: '#137A54', fontSize: 13, lineHeight: 18 },
  primaryButton: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Monochrome.actionPrimary,
    marginTop: Spacing.sm,
  },
  primaryText: { color: Monochrome.actionPrimaryText, fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.55 },
  secondaryButton: { alignItems: 'center', padding: Spacing.md },
  secondaryText: { color: Monochrome.textPrimary, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  notice: { flexDirection: 'row', gap: 9, padding: Spacing.md, marginTop: Spacing.sm },
  noticeText: { flex: 1, color: Monochrome.textMuted, fontSize: 12, lineHeight: 17 },
});
