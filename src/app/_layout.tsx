import { AppText } from '@/components/typography/app-text';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { Caveat_400Regular } from '@expo-google-fonts/caveat';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_400Regular_Italic,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_500Medium_Italic,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_600SemiBold_Italic,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_700Bold_Italic,
  PlusJakartaSans_800ExtraBold,
  PlusJakartaSans_800ExtraBold_Italic,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  NotoSansDevanagari_400Regular,
  NotoSansDevanagari_500Medium,
  NotoSansDevanagari_600SemiBold,
  NotoSansDevanagari_700Bold,
} from '@expo-google-fonts/noto-sans-devanagari';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Colors } from '@/constants/theme';
import { FcmRuntime } from '@/features/notifications/FcmRuntime';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({
    Caveat_400Regular,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_400Regular_Italic,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_500Medium_Italic,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_600SemiBold_Italic,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_700Bold_Italic,
    PlusJakartaSans_800ExtraBold,
    PlusJakartaSans_800ExtraBold_Italic,
    NotoSansDevanagari_400Regular,
    NotoSansDevanagari_500Medium,
    NotoSansDevanagari_600SemiBold,
    NotoSansDevanagari_700Bold,
  });

  useEffect(() => {
    if (fontError) {
      console.error('Unable to load the required application fonts.', fontError);
      void SplashScreen.hideAsync();
    }
  }, [fontError]);

  const navigationTheme = useMemo(() => {
    const isDark = colorScheme === 'dark';
    const baseTheme = isDark ? DarkTheme : DefaultTheme;
    const activeColors = isDark ? Colors.dark : Colors.light;

    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: activeColors.actionPrimary,
        background: activeColors.background,
        card: activeColors.surfacePrimary,
        text: activeColors.text,
        border: activeColors.border,
        notification: activeColors.primary,
      },
    };
  }, [colorScheme]);

  if (!fontsLoaded) {
    if (fontError) {
      return (
        <View style={styles.fontError}>
          <AppText style={styles.fontErrorText}>
            eYatra could not load its fonts. Please restart the app.
          </AppText>
        </View>
      );
    }
    return null;
  }

  return (
    <ThemeProvider value={navigationTheme}>
      <AnimatedSplashOverlay />
      <FcmRuntime />
      <Stack
        initialRouteName="index"
        screenOptions={{ headerShown: false }}
      />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  fontError: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  fontErrorText: {
    color: '#003049',
    fontSize: 16,
    textAlign: 'center',
  },
});
