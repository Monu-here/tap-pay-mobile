/**
 * Screen 7 — Registration success.
 *
 * Only reachable once both channels are verified: the guards redirect to
 * whichever channel is still outstanding, so this screen cannot be
 * skipped to.
 *
 * The signup request itself is made earlier, on the review screen
 * (`ReviewScreen`), so by the time the user arrives here the account
 * already exists and both contact channels are verified. This screen
 * confirms the outcome and returns the user to the login screen,
 * where they sign in with the credentials they just registered.
 */

import { Redirect, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { PrimaryButton } from '@/components/ui/primary-button';
import { Brand, Spacing } from '@/constants/theme';

import { useRegistration } from '../RegistrationContext';
import type { UserType } from '../types';
import { formatNepalPhone } from '../utils/phone';

const USER_TYPE_LABELS: Record<UserType, string> = {
  student: 'Student',
  general: 'General',
  senior: 'Senior Citizen',
};

const SUCCESS_SYMBOL = { ios: 'checkmark', android: 'check', web: 'check' } as const;

export function SuccessScreen() {
  const insets = useSafeAreaInsets();
  const { data, isChannelVerified, resetRegistration } = useRegistration();

  const emailVerified = isChannelVerified('email');
  const phoneVerified = isChannelVerified('phone');

  // Guard: bounce to whichever channel still needs verifying. Declared
  // after the hooks above so hook order stays stable across renders.
  if (!emailVerified) return <Redirect href="/register/email-otp" />;
  if (!phoneVerified) return <Redirect href="/register/phone-otp" />;

  const personal = data.personal;
  const userTypeLabel = data.userType ? USER_TYPE_LABELS[data.userType] : 'Not selected';

  const handleDone = () => {
    resetRegistration();
    router.replace('/login');
  };

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
      <View style={styles.content}>
        <View style={styles.badge}>
          <SymbolView name={SUCCESS_SYMBOL} size={40} tintColor={Brand.white} />
        </View>

        <Text style={styles.title}>Contact details verified</Text>
        <Text style={styles.subtitle}>
          Your email and phone number have both been verified.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Verified contacts</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={styles.rowValue} numberOfLines={1}>
              {personal.email.trim() || '—'}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Phone</Text>
            <Text style={styles.rowValue}>
              {personal.phoneNumber.trim() ? formatNepalPhone(personal.phoneNumber) : '—'}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>User type</Text>
            <Text style={styles.rowValue}>{userTypeLabel}</Text>
          </View>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Your account has been created. Your identity documents are reviewed by our team
            before your account is fully approved.
          </Text>
        </View>
      </View>

      <PrimaryButton label="Done" onPress={handleDone} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Brand.white,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
  },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Brand.teal.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.two,
  },
  title: {
    color: Brand.text,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitle: {
    color: Brand.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  card: {
    marginTop: Spacing.two,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Brand.divider,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardTitle: {
    color: Brand.text,
    fontSize: 15,
    fontWeight: '700',
    borderBottomWidth: 1,
    borderBottomColor: Brand.divider,
    paddingBottom: Spacing.two,
  },
  row: {
    gap: 2,
  },
  rowLabel: {
    color: Brand.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  rowValue: {
    color: Brand.text,
    fontSize: 15,
    lineHeight: 21,
  },
  notice: {
    padding: Spacing.three,
    borderRadius: 12,
    backgroundColor: Brand.teal.light,
    borderLeftWidth: 3,
    borderLeftColor: Brand.teal.primary,
  },
  noticeText: {
    color: Brand.teal.text,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
});
