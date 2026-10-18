/**
 * Shared form text-field component used across the registration screens.
 *
 * Reuses the visual language established in `LoginScreen` (rounded,
 * icon-led, light-grey input background) so every screen in the flow feels
 * consistent. Includes label, optional leading icon, optional trailing
 * node (e.g. show/hide password), and inline error messaging.
 */

import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Brand, Spacing } from '@/constants/theme';

type SymbolName = { ios: SFSymbol; android: AndroidSymbol; web: AndroidSymbol };

export type FormTextFieldProps = TextInputProps & {
  label: string;
  icon?: SymbolName;
  error?: string | null;
  trailing?: ReactNode;
  required?: boolean;
  /** Static prefix rendered before the input, e.g. `+977`. */
  prefix?: string;
};

export function FormTextField({
  label,
  icon,
  error,
  trailing,
  required,
  prefix,
  style,
  ...rest
}: FormTextFieldProps) {
  const hasError = Boolean(error);

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {required && <Text style={styles.requiredMark}>*</Text>}
      </View>
      <View
        style={[
          styles.fieldInputContainer,
          hasError && styles.fieldInputContainerError,
        ]}
      >
        {icon && (
          <SymbolView
            name={icon}
            size={18}
            tintColor={hasError ? Brand.error : Brand.textSecondary}
          />
        )}
        {prefix && <Text style={styles.prefix}>{prefix}</Text>}
        <TextInput
          placeholderTextColor={Brand.textSecondary}
          style={[styles.fieldInput, style]}
          {...rest}
        />
        {trailing}
      </View>
      {hasError && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );
}

export function VisibilityToggle({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={visible ? 'Hide password' : 'Show password'}
      hitSlop={8}
      style={styles.visibilityToggle}
    >
      <SymbolView
        name={{
          ios: visible ? 'eye.slash.fill' : 'eye.fill',
          android: visible ? 'visibility_off' : 'visibility',
          web: visible ? 'visibility_off' : 'visibility',
        }}
        size={18}
        tintColor={Brand.textSecondary}
      />
    </Pressable>
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
  fieldInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: Brand.inputBackground,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    height: 52,
  },
  fieldInput: {
    flex: 1,
    color: Brand.text,
    fontSize: 16,
    height: '100%',
  },
  prefix: {
    color: Brand.text,
    fontSize: 16,
    fontWeight: '600',
  },
  fieldInputContainerError: {
    borderWidth: 1,
    borderColor: Brand.error,
  },
  fieldError: {
    color: Brand.error,
    fontSize: 12,
    marginTop: Spacing.half,
  },
  visibilityToggle: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});