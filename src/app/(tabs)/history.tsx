import { router } from 'expo-router';

import { TravelHistoryScreen } from '@/features/passenger/components/TravelHistoryScreen';

export default function TravelHistoryTab() {
  return <TravelHistoryScreen onBack={() => router.replace('/(tabs)/home')} />;
}
