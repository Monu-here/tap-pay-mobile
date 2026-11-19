import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Keyboard } from 'react-native';

export function useKeyboardDismissOnBlur() {
  useFocusEffect(
    useCallback(() => () => Keyboard.dismiss(), []),
  );
}
