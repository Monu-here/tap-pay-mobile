/**
 * Hook to access active theme tokens dynamically based on the current color scheme.
 * Supports both light and dark modes with the 5-color palette:
 * Maroon, Crimson, Warm Cream, Prussian Navy, Slate Blue.
 */

import { Colors, getThemeTokens } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  const scheme = useColorScheme();
  const activeScheme = scheme === 'dark' ? 'dark' : 'light';
  const tokens = getThemeTokens(activeScheme);

  return {
    ...Colors[activeScheme],
    isDark: activeScheme === 'dark',
    scheme: activeScheme,
    tokens,
  };
}

export const useAppTheme = useTheme;
