import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SkeletonAnimation = {
  progress: Animated.Value;
  register: () => () => void;
};

const SkeletonAnimationContext = createContext<SkeletonAnimation | null>(null);

export function SkeletonAnimationProvider({ children }: { children: ReactNode }) {
  const [progress] = useState(() => new Animated.Value(0));
  const activeSkeletons = useRef(0);
  const animation = useRef<Animated.CompositeAnimation | null>(null);

  const register = useCallback(() => {
    activeSkeletons.current += 1;
    if (activeSkeletons.current === 1) {
      animation.current = Animated.loop(
        Animated.sequence([
          Animated.timing(progress, {
            toValue: 1,
            duration: 850,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(progress, {
            toValue: 0,
            duration: 850,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      animation.current.start();
    }

    return () => {
      activeSkeletons.current = Math.max(0, activeSkeletons.current - 1);
      if (activeSkeletons.current === 0) {
        animation.current?.stop();
        animation.current = null;
        progress.setValue(0);
      }
    };
  }, [progress]);

  const context = useMemo(() => ({ progress, register }), [progress, register]);

  return (
    <SkeletonAnimationContext.Provider value={context}>
      {children}
    </SkeletonAnimationContext.Provider>
  );
}

export type SkeletonBoxProps = {
  width?: ViewStyle['width'];
  height?: ViewStyle['height'];
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

export function SkeletonBox({
  width = '100%',
  height = 16,
  borderRadius = Radius.small,
  style,
}: SkeletonBoxProps) {
  const animation = useContext(SkeletonAnimationContext);
  const theme = useTheme();
  const backgroundColor = theme.surfaceElevated;

  useEffect(() => animation?.register(), [animation]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[
        styles.box,
        { width, height, borderRadius, backgroundColor },
        animation ? { opacity: animation.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.62, 1],
        }) } : null,
        style,
      ]}
    />
  );
}

export function SkeletonText({
  width = '100%',
  lines = 1,
  lineHeight = 14,
  style,
}: {
  width?: ViewStyle['width'];
  lines?: number;
  lineHeight?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.textLines, style]}>
      {Array.from({ length: lines }, (_, index) => (
        <SkeletonBox
          key={index}
          width={index === lines - 1 && lines > 1 ? '72%' : width}
          height={lineHeight}
        />
      ))}
    </View>
  );
}

export function SkeletonCircle({
  size = 44,
  style,
}: {
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <SkeletonBox width={size} height={size} borderRadius={size / 2} style={style} />;
}

export function SkeletonCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View
      accessibilityLabel="Loading content"
      accessibilityRole="progressbar"
      style={[
        styles.card,
        {
          backgroundColor: theme.surfacePrimary,
          borderColor: theme.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SkeletonList({
  count = 4,
  style,
}: {
  count?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.list, style]}>
      {Array.from({ length: count }, (_, index) => (
        <SkeletonCard key={index} style={styles.listRow}>
          <SkeletonCircle size={42} />
          <View style={styles.listCopy}>
            <SkeletonBox width="58%" height={14} />
            <SkeletonBox width="82%" height={11} />
          </View>
          <SkeletonBox width={54} height={15} />
        </SkeletonCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    overflow: 'hidden',
  },
  textLines: {
    gap: Spacing.two,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  list: {
    gap: Spacing.two,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  listCopy: {
    flex: 1,
    gap: Spacing.two,
  },
});
