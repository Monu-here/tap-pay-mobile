import { forwardRef, useCallback, useRef } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  View,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';

import { getFontFamily } from '@/constants/typography';
import { useKeyboardInputRegistration } from '@/components/keyboard/KeyboardManagementProvider';

let inputAccessoryCounter = 0;

function getTypographyStyle(
  style: TextProps['style'] | TextInputProps['style'],
) {
  const flattenedStyle = StyleSheet.flatten(style) as TextStyle | undefined;

  return {
    fontFamily: getFontFamily(
      flattenedStyle?.fontWeight ?? '400',
      flattenedStyle?.fontStyle === 'italic',
    ),
    fontWeight: 'normal' as const,
    fontStyle: 'normal' as const,
  };
}

export const AppText = forwardRef<
  React.ElementRef<typeof NativeText>,
  TextProps
>(function AppText({ children, style, ...props }, ref) {
  const typographyStyle = getTypographyStyle(style);

  return (
    <NativeText
      ref={ref}
      style={typographyStyle ? [style, typographyStyle] : style}
      {...props}
    >
      {children}
    </NativeText>
  );
});

export const AppTextInput = forwardRef<
  React.ElementRef<typeof NativeTextInput>,
  TextInputProps
>(function AppTextInput(
  {
    style,
    value,
    defaultValue,
    placeholder,
    multiline,
    keyboardType,
    returnKeyType,
    inputAccessoryViewID,
    onSubmitEditing,
    ...props
  },
  ref,
) {
  const registerInput = useKeyboardInputRegistration();
  const inputRef = useRef<React.ElementRef<typeof NativeTextInput> | null>(null);
  const accessoryId = useRef<string | null>(null);
  const needsDoneAccessory =
    Platform.OS === 'ios' &&
    !inputAccessoryViewID &&
    ['decimal-pad', 'number-pad', 'numeric', 'phone-pad'].includes(keyboardType ?? '');
  if (needsDoneAccessory && !accessoryId.current) {
    accessoryId.current = `app-input-done-${inputAccessoryCounter++}`;
  }
  const setInputRef = useCallback(
    (input: React.ElementRef<typeof NativeTextInput> | null) => {
      if (inputRef.current) registerInput(inputRef.current, false);
      inputRef.current = input;
      if (input) registerInput(input, true);

      if (typeof ref === 'function') ref(input);
      else if (ref) ref.current = input;
    },
    [ref, registerInput],
  );
  const effectiveReturnKeyType =
    returnKeyType ?? (multiline ? undefined : 'done');
  const handleSubmitEditing = useCallback(
    (event: Parameters<NonNullable<TextInputProps['onSubmitEditing']>>[0]) => {
      const hasNextHandler = effectiveReturnKeyType === 'next' && onSubmitEditing;
      if (!multiline && !hasNextHandler) Keyboard.dismiss();
      onSubmitEditing?.(event);
    },
    [effectiveReturnKeyType, multiline, onSubmitEditing],
  );
  const typographyStyle = getTypographyStyle(style);

  return (
    <>
      <NativeTextInput
        ref={setInputRef}
        style={typographyStyle ? [style, typographyStyle] : style}
        value={value}
        defaultValue={defaultValue}
        placeholder={placeholder}
        multiline={multiline}
        keyboardType={keyboardType}
        inputAccessoryViewID={
          needsDoneAccessory ? accessoryId.current ?? undefined : inputAccessoryViewID
        }
        returnKeyType={effectiveReturnKeyType}
        onSubmitEditing={handleSubmitEditing}
        {...props}
      />
      {needsDoneAccessory && accessoryId.current ? (
        <InputAccessoryView nativeID={accessoryId.current}>
          <View style={styles.keyboardAccessory}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss keyboard"
              onPress={Keyboard.dismiss}
              style={styles.keyboardAccessoryButton}
            >
              <AppText style={styles.keyboardAccessoryText}>Done</AppText>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
    </>
  );
});

const styles = StyleSheet.create({
  keyboardAccessory: {
    alignItems: 'flex-end',
    backgroundColor: '#F6F6F6',
    borderTopColor: '#D1D1D6',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  keyboardAccessoryButton: {
    minWidth: 48,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboardAccessoryText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
