import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getUnreadNotificationCount } from '@/features/passenger/services/passengerApi';

export function useNotificationCount() {
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const result = await getUnreadNotificationCount();
      if (result.ok && result.data) {
        setUnreadCount(result.data.unread_count);
      } else if (!result.ok) {
        console.warn('Unable to refresh notification count:', result.message);
      }
    } catch (error) {
      console.warn(
        'Unable to refresh notification count:',
        error instanceof Error ? error.message : 'Unknown error.',
      );
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });

    return () => subscription.remove();
  }, [refresh]);

  return { unreadCount, refresh };
}
