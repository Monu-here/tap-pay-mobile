import { Children, forwardRef, type ReactNode } from 'react';
import {
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';

import { getFontFamily } from '@/constants/typography';

const devanagariPattern = /[\u0900-\u097F]/;

function includesDevanagari(children: ReactNode): boolean {
  return Children.toArray(children).some(
    (child) => typeof child === 'string' && devanagariPattern.test(child),
  );
}

function getTypographyStyle(
  style: TextProps['style'] | TextInputProps['style'],
  content: ReactNode,
) {
  const flattenedStyle = StyleSheet.flatten(style) as TextStyle | undefined;
  if (flattenedStyle?.fontFamily) return undefined;

  return {
    fontFamily: getFontFamily(
      flattenedStyle?.fontWeight ?? '400',
      flattenedStyle?.fontStyle === 'italic',
      includesDevanagari(content),
    ),
    fontWeight: 'normal' as const,
    fontStyle: 'normal' as const,
  };
}

export const AppText = forwardRef<
  React.ElementRef<typeof NativeText>,
  TextProps
>(function AppText({ children, style, ...props }, ref) {
  const typographyStyle = getTypographyStyle(style, children);

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
>(function AppTextInput({ style, value, defaultValue, placeholder, ...props }, ref) {
  const typographyStyle = getTypographyStyle(
    style,
    `${value ?? defaultValue ?? ''} ${placeholder ?? ''}`,
  );

  return (
    <NativeTextInput
      ref={ref}
      style={typographyStyle ? [style, typographyStyle] : style}
      value={value}
      defaultValue={defaultValue}
      placeholder={placeholder}
      {...props}
    />
  );
});
