import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';

import {
  SkeletonBox,
  SkeletonCard,
  SkeletonCircle,
  SkeletonList,
  SkeletonText,
} from './Skeleton';

export function DashboardSkeleton() {
  return (
    <View style={styles.screen}>
      <SkeletonCard style={styles.balanceCard}>
        <SkeletonBox width={112} height={12} />
        <SkeletonBox width="64%" height={30} />
        <View style={styles.row}>
          <SkeletonBox width="42%" height={12} />
          <SkeletonBox width={88} height={36} borderRadius={Radius.medium} />
        </View>
      </SkeletonCard>
      <View style={styles.quickActions}>
        {[0, 1, 2, 3].map((item) => (
          <SkeletonCard key={item} style={styles.quickAction}>
            <SkeletonCircle size={38} />
            <SkeletonBox width="72%" height={12} />
          </SkeletonCard>
        ))}
      </View>
      <SkeletonBox width={150} height={18} />
      <SkeletonList count={3} />
    </View>
  );
}

export function WalletSkeleton() {
  return (
    <View style={styles.screen}>
      <SkeletonCard style={styles.balanceCard}>
        <SkeletonBox width={120} height={13} />
        <SkeletonBox width="58%" height={34} />
        <View style={styles.row}>
          <SkeletonBox width={98} height={38} borderRadius={Radius.medium} />
          <SkeletonBox width={98} height={38} borderRadius={Radius.medium} />
        </View>
      </SkeletonCard>
      <SkeletonBox width={146} height={18} />
      <SkeletonList count={5} />
    </View>
  );
}

export function RewardsSkeleton() {
  return (
    <View style={styles.screen}>
      <SkeletonCard style={styles.balanceCard}>
        <SkeletonCircle size={38} />
        <SkeletonBox width={154} height={12} />
        <SkeletonBox width="48%" height={34} />
        <SkeletonBox width="72%" height={13} />
        <SkeletonBox width="100%" height={54} borderRadius={Radius.medium} />
        <SkeletonBox width="100%" height={44} borderRadius={Radius.medium} />
      </SkeletonCard>
      <SkeletonBox width={132} height={18} />
      <TransactionSkeleton count={4} />
    </View>
  );
}

export function TransitPassSkeleton() {
  return (
    <View style={styles.screen}>
      <SkeletonCard style={styles.passCard}>
        <View style={styles.row}>
          <SkeletonCircle size={38} />
          <View style={styles.passTitle}>
            <SkeletonBox width={142} height={13} />
            <SkeletonBox width={108} height={11} />
          </View>
          <SkeletonBox width={60} height={22} borderRadius={Radius.pill} />
        </View>
        <View style={styles.identityRow}>
          <View style={styles.passTitle}>
            <SkeletonBox width={90} height={10} />
            <SkeletonBox width={132} height={15} />
          </View>
          <View style={styles.alignEnd}>
            <SkeletonBox width={72} height={10} />
            <SkeletonBox width={52} height={15} />
          </View>
        </View>
        <SkeletonBox width={220} height={220} borderRadius={Radius.medium} style={styles.qr} />
        <SkeletonBox width="82%" height={12} style={styles.centered} />
      </SkeletonCard>
      <SkeletonCard>
        <SkeletonBox width={184} height={16} />
        <SkeletonText lines={3} lineHeight={12} />
      </SkeletonCard>
    </View>
  );
}

export function TransactionSkeleton({ count = 5 }: { count?: number }) {
  return <SkeletonList count={count} style={styles.screen} />;
}

export function ProfileSkeleton() {
  return (
    <View style={styles.screen}>
      <SkeletonCard style={styles.profileHeader}>
        <SkeletonCircle size={84} style={styles.centered} />
        <SkeletonBox width={154} height={18} style={styles.centered} />
        <SkeletonBox width={196} height={12} style={styles.centered} />
      </SkeletonCard>
      <SkeletonCard>
        <SkeletonBox width={126} height={17} />
        <SkeletonText lines={3} lineHeight={16} />
      </SkeletonCard>
      <SkeletonCard>
        <SkeletonBox width={146} height={17} />
        <SkeletonText lines={2} lineHeight={16} />
      </SkeletonCard>
    </View>
  );
}

export function NotificationSkeleton() {
  return (
    <View style={styles.screen}>
      <SkeletonCard style={styles.notificationBanner}>
        <SkeletonCircle size={40} />
        <View style={styles.passTitle}>
          <SkeletonBox width="72%" height={14} />
          <SkeletonBox width="92%" height={12} />
        </View>
      </SkeletonCard>
      <TransactionSkeleton count={5} />
    </View>
  );
}

export function RouteListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.screen}>
      {Array.from({ length: count }, (_, index) => (
        <SkeletonCard key={index}>
          <View style={styles.row}>
            <SkeletonCircle size={38} />
            <View style={styles.passTitle}>
              <SkeletonBox width="62%" height={15} />
              <SkeletonBox width="82%" height={12} />
            </View>
          </View>
          <SkeletonBox width="100%" height={72} borderRadius={Radius.medium} />
          <View style={styles.row}>
            <SkeletonBox width={86} height={12} />
            <SkeletonBox width={94} height={12} />
          </View>
        </SkeletonCard>
      ))}
    </View>
  );
}

export function ConcessionSkeleton() {
  return (
    <View style={styles.screen}>
      <SkeletonCard>
        <SkeletonBox width={148} height={18} />
        <SkeletonText lines={2} lineHeight={13} />
        <SkeletonBox width={118} height={12} />
      </SkeletonCard>
      <SkeletonCard>
        <SkeletonBox width={158} height={17} />
        <SkeletonBox width="100%" height={48} borderRadius={Radius.medium} />
        <SkeletonBox width="100%" height={48} borderRadius={Radius.medium} />
        <SkeletonBox width="100%" height={50} borderRadius={Radius.medium} />
      </SkeletonCard>
    </View>
  );
}

export function DriverDashboardSkeleton() {
  return (
    <View style={styles.screen}>
      <SkeletonCard>
        <View style={styles.row}>
          <SkeletonCircle size={46} />
          <View style={styles.passTitle}>
            <SkeletonBox width={142} height={17} />
            <SkeletonBox width={104} height={12} />
          </View>
        </View>
        <SkeletonBox width="100%" height={92} borderRadius={Radius.medium} />
      </SkeletonCard>
      <SkeletonBox width={132} height={18} />
      <RouteListSkeleton count={2} />
    </View>
  );
}

export function DriverQrSkeleton() {
  return (
    <View style={[styles.screen, styles.fullWidth]}>
      <SkeletonCard style={styles.driverQrCard}>
        <SkeletonBox width={220} height={220} borderRadius={Radius.medium} style={styles.centered} />
      </SkeletonCard>
      <SkeletonCard>
        <SkeletonText lines={3} lineHeight={14} />
      </SkeletonCard>
    </View>
  );
}

export function SupportSkeleton() {
  return <TransactionSkeleton count={4} />;
}

const styles = StyleSheet.create({
  screen: {
    gap: Spacing.three,
  },
  balanceCard: {
    padding: Spacing.four,
    minHeight: 158,
    justifyContent: 'space-between',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  quickAction: {
    width: '48%',
    minHeight: 92,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  passCard: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  passTitle: {
    flex: 1,
    gap: Spacing.two,
  },
  identityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  alignEnd: {
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  qr: {
    alignSelf: 'center',
  },
  centered: {
    alignSelf: 'center',
  },
  profileHeader: {
    minHeight: 184,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverQrCard: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  fullWidth: {
    width: '100%',
  },
  notificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
