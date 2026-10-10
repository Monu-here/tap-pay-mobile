import { StyleSheet, View } from 'react-native';

import { Brand } from '@/constants/theme';

export type PaginationDotsProps = {
  total: number;
  activeIndex: number;
};

export function PaginationDots({ total, activeIndex }: PaginationDotsProps) {
  return (
    <View style={styles.container} accessibilityRole="none">
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={[styles.dot, index === activeIndex && styles.activeDot]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Brand.divider,
  },
  activeDot: {
    width: 24,
    backgroundColor: Brand.primary,
  },
});
