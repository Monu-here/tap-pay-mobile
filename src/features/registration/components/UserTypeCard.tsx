import { AppText } from '@/components/typography/app-text';
/**
 * Selectable card used on the "Select User Type" screen.
 *
 * Three mutually-exclusive cards: Student, General, Senior Citizen. Each
 * shows an icon, title, short description, and a clear selected/unselected
 * visual state. Only one card can be active at a time — the parent owns
 * the state.
 */

import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { Brand, Spacing } from '@/constants/theme';

export type SymbolName = { ios: SFSymbol; android: AndroidSymbol; web: AndroidSymbol };

export type UserTypeCardProps = {
  icon: SymbolName;
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
};

export function UserTypeCard({
  icon,
  title,
  description,
  selected,
  onPress,
}: UserTypeCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.card,
        selected ? styles.cardSelected : styles.cardUnselected,
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          selected ? styles.iconWrapSelected : styles.iconWrapUnselected,
        ]}
      >
        <SymbolView
          name={icon}
          size={24}
          tintColor={selected ? Brand.teal.primary : Brand.textSecondary}
        />
      </View>
      <View style={styles.textContent}>
        <AppText style={[styles.title, selected && styles.titleSelected]}>{title}</AppText>
        <AppText style={styles.description}>{description}</AppText>
      </View>
      {selected && (
        <View style={styles.checkBadge}>
          <SymbolView
            name={{ ios: 'checkmark', android: 'check', web: 'check' }}
            size={14}
            tintColor={Brand.white}
          />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  cardUnselected: {
    backgroundColor: Brand.selection.unselectedBackground,
    borderColor: Brand.divider,
  },
  cardSelected: {
    backgroundColor: Brand.selection.selectedBackground,
    borderColor: Brand.selection.selectedBorder,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapUnselected: {
    backgroundColor: Brand.inputBackground,
  },
  iconWrapSelected: {
    backgroundColor: Brand.teal.light,
  },
  textContent: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: Brand.text,
    fontSize: 16,
    fontWeight: '700',
  },
  titleSelected: {
    color: Brand.teal.text,
  },
  description: {
    color: Brand.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Brand.teal.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});