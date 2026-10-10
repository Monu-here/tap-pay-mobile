import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import { useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/primary-button';
import { Brand, Spacing } from '@/constants/theme';

type SymbolName = { ios: SFSymbol; android: AndroidSymbol; web: AndroidSymbol };

type LoginTextFieldProps = TextInputProps & {
  label: string;
  icon: SymbolName;
  trailing?: ReactNode;
};

function LoginTextField({ label, icon, trailing, style, ...rest }: LoginTextFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldInputContainer}>
        <SymbolView name={icon} size={18} tintColor={Brand.textSecondary} />
        <TextInput
          placeholderTextColor={Brand.textSecondary}
          style={[styles.fieldInput, style]}
          {...rest}
        />
        {trailing}
      </View>
    </View>
  );
}

/**
 * Visual-only login screen. No authentication logic is wired up yet.
 * TODO: replace placeholder copy/layout with the supplied login design.
 */
export function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + Spacing.five,
          paddingBottom: insets.bottom + Spacing.four,
          paddingHorizontal: Spacing.four,
        },
      ]}
    >
      <StatusBar style="dark" />

      <View style={styles.logoContainer}>
        <View style={styles.logoMark}>
          <SymbolView
            name={{ ios: 'creditcard.fill', android: 'credit_card', web: 'credit_card' }}
            size={30}
            tintColor={Brand.white}
          />
        </View>
        <Text style={styles.logoText}>Tap & Pay</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Log in to continue to Tap & Pay</Text>

        <View style={styles.form}>
          <LoginTextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            icon={{ ios: 'envelope.fill', android: 'email', web: 'email' }}
          />
          <LoginTextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            secureTextEntry={!isPasswordVisible}
            icon={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
            trailing={
              <Pressable
                onPress={() => setIsPasswordVisible((visible) => !visible)}
                accessibilityRole="button"
                accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
                hitSlop={8}
                style={styles.visibilityToggle}
              >
                <SymbolView
                  name={{
                    ios: isPasswordVisible ? 'eye.slash.fill' : 'eye.fill',
                    android: isPasswordVisible ? 'visibility_off' : 'visibility',
                    web: isPasswordVisible ? 'visibility_off' : 'visibility',
                  }}
                  size={18}
                  tintColor={Brand.textSecondary}
                />
              </Pressable>
            }
          />
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            style={styles.forgotButton}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Pressable>
        </View>
      </View>

      <PrimaryButton label="Log in" onPress={() => {}} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Don&apos;t have an account?</Text>
        <Pressable accessibilityRole="button" hitSlop={8}>
          <Text style={styles.footerLink}>Sign up</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Brand.white,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  logoMark: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.primary,
    experimental_backgroundImage: `linear-gradient(160deg, ${Brand.gradientStart}, ${Brand.gradientEnd})`,
  },
  logoText: {
    color: Brand.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.four,
  },
  title: {
    color: Brand.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: Brand.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    marginTop: -Spacing.two,
  },
  form: {
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  field: {
    gap: Spacing.one,
  },
  fieldLabel: {
    color: Brand.text,
    fontSize: 14,
    fontWeight: '600',
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
  visibilityToggle: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forgotButton: {
    alignSelf: 'flex-end',
    paddingVertical: Spacing.one,
  },
  forgotText: {
    color: Brand.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.three,
  },
  footerText: {
    color: Brand.textSecondary,
    fontSize: 14,
  },
  footerLink: {
    color: Brand.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
