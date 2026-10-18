import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/primary-button';
import { Brand, Spacing } from '@/constants/theme';

import { UserTypeCard, type SymbolName } from '../components/UserTypeCard';
import { useRegistration } from '../RegistrationContext';
import type { UserType } from '../types';

const USER_TYPE_OPTIONS: {
  type: UserType;
  icon: SymbolName;
  title: string;
  description: string;
}[] = [
  {
    type: 'student',
    icon: { ios: 'graduationcap.fill', android: 'school', web: 'school' },
    title: 'Student',
    description: 'For college and university students.',
  },
  {
    type: 'general',
    icon: { ios: 'person.fill', android: 'person', web: 'person' },
    title: 'General',
    description: 'For regular passengers.',
  },
  {
    type: 'senior',
    icon: { ios: 'figure.walk', android: 'elderly', web: 'elderly' },
    title: 'Senior Citizen',
    description: 'For senior passengers.',
  },
];

export function UserTypeScreen() {
  const insets = useSafeAreaInsets();
  const { data, setUserType } = useRegistration();
  const [selected, setSelected] = useState<UserType | null>(data.userType);

  const handleContinue = () => {
    if (!selected) return;
    setUserType(selected);
    router.push('/register/documents');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View
        style={[
          styles.headerRow,
          { paddingTop: insets.top + Spacing.two, paddingHorizontal: Spacing.four },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <View style={styles.stepIndicator}>
          <Text style={styles.stepLabel}>Step 2 of 7</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: "29%" }]} />
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.five },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headingBlock}>
          <Text style={styles.title}>Select User Type</Text>
          <Text style={styles.subtitle}>Choose the category that best describes you</Text>
        </View>

        <View style={styles.cards}>
          {USER_TYPE_OPTIONS.map((option) => (
            <UserTypeCard
              key={option.type}
              icon={option.icon}
              title={option.title}
              description={option.description}
              selected={selected === option.type}
              onPress={() => setSelected(option.type)}
            />
          ))}
        </View>

        <View style={styles.footer}>
          <PrimaryButton
            label="Continue"
            onPress={handleContinue}
            disabled={!selected}
            style={!selected ? styles.buttonDisabled : undefined}
          />
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.back()}
            style={styles.backTextButton}
          >
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Brand.white,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: Spacing.two,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Brand.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 18,
    color: Brand.text,
    fontWeight: '600',
  },
  stepIndicator: {
    flex: 1,
    gap: Spacing.one,
  },
  stepLabel: {
    color: Brand.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Brand.divider,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Brand.teal.primary,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    gap: Spacing.four,
  },
  headingBlock: {
    gap: Spacing.one,
  },
  title: {
    color: Brand.text,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: Brand.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  cards: {
    gap: Spacing.three,
  },
  footer: {
    gap: Spacing.two,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  backTextButton: {
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  backText: {
    color: Brand.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
});