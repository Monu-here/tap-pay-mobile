/**
 * Six-box OTP input.
 *
 * Behaviours that matter on a phone:
 *  - typing a digit advances focus to the next box
 *  - backspace on an empty box clears the previous box and moves back
 *  - pasting a full code (from an SMS or email) fills every box at once
 *  - only digits are accepted
 *
 * The code is stored as one string in the parent, so a parent can read the
 * complete value without assembling it from six children.
 */

import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Brand, Spacing } from '@/constants/theme';

export type OtpInputRef = {
  focus: () => void;
  clear: () => void;
};

export type OtpInputProps = {
  value: string;
  onChange: (code: string) => void;
  length?: number;
  hasError?: boolean;
  editable?: boolean;
};

export const OtpInput = forwardRef<OtpInputRef, OtpInputProps>(function OtpInput(
  { value, onChange, length = 6, hasError = false, editable = true },
  ref,
) {
  const inputs = useRef<(TextInput | null)[]>([]);

  const focusBox = (index: number) => {
    inputs.current[index]?.focus();
  };

  useImperativeHandle(ref, () => ({
    focus: () => focusBox(0),
    clear: () => {
      onChange('');
      focusBox(0);
    },
  }));

  /** Writes a code and moves focus to its last filled box. */
  const applyCode = (code: string) => {
    onChange(code);
    const nextIndex = Math.min(code.length, length - 1);
    focusBox(nextIndex);
  };

  const handleChangeText = (text: string, index: number) => {
    // A paste arrives as several characters at once; take the digits and
    // spread them across the boxes.
    if (text.length > 1) {
      const digits = text.replace(/\D/g, '').slice(0, length);
      if (digits) applyCode(digits);
      return;
    }

    const digit = text.replace(/\D/g, '');
    if (!digit) {
      // Deletion of the last character in this box.
      const next = value.slice(0, index) + value.slice(index + 1);
      onChange(next);
      return;
    }

    const next = (value.slice(0, index) + digit + value.slice(index + 1)).slice(0, length);
    applyCode(next);
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key !== 'Backspace') return;

    // Box already filled: let the default backspace clear it.
    if (value[index]) return;

    // Box is empty: step back and clear the previous box, so a run of
    // backspaces walks backwards instead of clearing only the last box.
    if (index > 0) {
      const next = value.slice(0, index - 1) + value.slice(index);
      onChange(next);
      focusBox(index - 1);
    }
  };

  return (
    <View style={styles.container}>
      {Array.from({ length }, (_, index) => {
        const char = value[index] ?? '';
        const isActive = index === value.length;

        return (
          <TextInput
            key={index}
            ref={(input) => {
              inputs.current[index] = input;
            }}
            value={char}
            onChangeText={(text) => handleChangeText(text, index)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
            onFocus={() => {
              // Tapping a filled box should continue from the end, not from
              // where it was tapped.
              if (index > value.length) focusBox(value.length);
            }}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            maxLength={index === 0 ? length : 1}
            editable={editable}
            selectTextOnFocus
            style={[
              styles.box,
              isActive && !hasError && styles.boxActive,
              hasError && styles.boxError,
            ]}
          />
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  box: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    backgroundColor: Brand.inputBackground,
    borderWidth: 1.5,
    borderColor: 'transparent',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: Brand.text,
  },
  boxActive: {
    borderColor: Brand.primary,
    backgroundColor: Brand.white,
  },
  boxError: {
    borderColor: Brand.error,
  },
});
