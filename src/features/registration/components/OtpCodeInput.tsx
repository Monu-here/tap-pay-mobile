import {AppText, AppTextInput } from '@/components/typography/app-text';
/**
 * 6-digit OTP input.
 *
 * A single `TextInput` (so paste, SMS autofill and the numeric keyboard all
 * work) rendered behind a row of digit boxes for a native feel. Auto-submits
 * the moment the final digit lands. Exposes `focus()` for callers to re-focus
 * after a failed attempt or a resend.
 */

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Brand, Spacing } from '@/constants/theme';

export type OtpCodeInputHandle = {
  focus: () => void;
};

export type OtpCodeInputProps = {
  value: string;
  onChange: (code: string) => void;
  /** Fired once, when the final digit is entered. */
  onComplete: (code: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  hasError?: boolean;
  length?: number;
};

export const OtpCodeInput = forwardRef<OtpCodeInputHandle, OtpCodeInputProps>(
  function OtpCodeInput(
    {
      value,
      onChange,
      onComplete,
      disabled = false,
      autoFocus = false,
      hasError = false,
      length = 6,
    },
    ref,
  ) {
    const inputRef = useRef<TextInput>(null);
    const [focused, setFocused] = useState(false);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
    }));

    const handleChange = (text: string) => {
      const digits = text.replace(/\D/g, '').slice(0, length);
      onChange(digits);
      if (digits.length === length) onComplete(digits);
    };

    return (
      <View style={styles.container}>
        <Pressable
          accessibilityLabel="Verification code input"
          hitSlop={8}
          onPress={() => inputRef.current?.focus()}
          style={styles.boxes}
        >
          {Array.from({ length }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.box,
                focused && !hasError && styles.boxFocused,
                hasError && styles.boxError,
                Boolean(value[index]) && styles.boxFilled,
              ]}
            >
              <AppText style={styles.boxText}>{value[index] ?? ''}</AppText>
            </View>
          ))}
        </Pressable>

        <AppTextInput
          ref={inputRef}
          value={value}
          onChangeText={handleChange}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={length}
          autoFocus={autoFocus}
          editable={!disabled}
          selectionColor={Brand.primary}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={() => {
            if (value.length === length) onComplete(value);
          }}
          style={styles.hiddenInput}
          caretHidden
        />
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  boxes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  box: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Brand.divider,
    backgroundColor: Brand.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFocused: {
    borderColor: Brand.primary,
  },
  boxError: {
    borderColor: Brand.error,
  },
  boxFilled: {
    borderColor: Brand.primary,
    backgroundColor: Brand.white,
  },
  boxText: {
    color: Brand.text,
    fontSize: 22,
    fontWeight: '700',
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 56,
    opacity: 0,
  },
});
