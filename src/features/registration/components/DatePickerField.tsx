import { AppText } from '@/components/typography/app-text';
/**
 * Pressable date field used on the Personal Information screen.
 *
 * Looks and lays out like `FormTextField` (same label row, rounded grey
 * container, 52px height, inline error) but is a `Pressable` that opens a
 * picker modal rather than a `TextInput` — dates are chosen, never typed.
 */

import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { Brand, Spacing } from '@/constants/theme';

type SymbolName = { ios: SFSymbol; android: AndroidSymbol; web: AndroidSymbol };

export type DatePickerFieldProps = {
  label: string;
  /** Currently selected value, already formatted for display. */
  value: string | null;
  placeholder: string;
  onPress: () => void;
  error?: string | null;
  required?: boolean;
  /** Small suffix shown on the right, e.g. `BS`. */
  suffix?: string;
};

export function DatePickerField({
  label,
  value,
  placeholder,
  onPress,
  error,
  required,
  suffix,
}: DatePickerFieldProps) {
  const hasError = Boolean(error);
  const icon: SymbolName = { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' };

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <AppText style={styles.fieldLabel}>{label}</AppText>
        {required && <AppText style={styles.requiredMark}>*</AppText>}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={[styles.container, hasError && styles.containerError]}
      >
        <SymbolView
          name={icon}
          size={18}
          tintColor={hasError ? Brand.error : Brand.textSecondary}
        />
        <AppText style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
          {value ?? placeholder}
        </AppText>
        {suffix && <AppText style={styles.suffix}>{suffix}</AppText>}
      </Pressable>
      {hasError && <AppText style={styles.fieldError}>{error}</AppText>}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.one,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
  },
  fieldLabel: {
    color: Brand.text,
    fontSize: 14,
    fontWeight: '600',
  },
  requiredMark: {
    color: Brand.error,
    fontSize: 14,
    fontWeight: '700',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: Brand.inputBackground,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    height: 52,
  },
  containerError: {
    borderWidth: 1,
    borderColor: Brand.error,
  },
  value: {
    flex: 1,
    color: Brand.text,
    fontSize: 16,
  },
  placeholder: {
    color: Brand.textSecondary,
  },
  suffix: {
    color: Brand.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  fieldError: {
    color: Brand.error,
    fontSize: 12,
    marginTop: Spacing.half,
  },
});