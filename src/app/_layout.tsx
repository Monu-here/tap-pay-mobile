import { AppText } from '@/components/typography/app-text';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { Caveat_400Regular } from '@expo-google-fonts/caveat';
import {
  NunitoSans_400Regular,
  NunitoSans_400Regular_Italic,
  NunitoSans_500Medium,
  NunitoSans_500Medium_Italic,
  NunitoSans_600SemiBold,
  NunitoSans_600SemiBold_Italic,
  NunitoSans_700Bold,
  NunitoSans_700Bold_Italic,
} from '@expo-google-fonts/nunito-sans';
import {
  NotoSansDevanagari_400Regular,
  NotoSansDevanagari_500Medium,
  NotoSansDevanagari_600SemiBold,
  NotoSansDevanagari_700Bold,
} from '@expo-google-fonts/noto-sans-devanagari';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, View, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { FcmRuntime } from '@/features/notifications/FcmRuntime';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({
    Caveat_400Regular,
    NunitoSans_400Regular,
    NunitoSans_400Regular_Italic,
    NunitoSans_500Medium,
    NunitoSans_500Medium_Italic,
    NunitoSans_600SemiBold,
    NunitoSans_600SemiBold_Italic,
    NunitoSans_700Bold,
    NunitoSans_700Bold_Italic,
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

  if (!fontsLoaded) {
    if (fontError) {
      return (
        <View style={styles.fontError}>
          <AppText style={styles.fontErrorText}>
            Tap &amp; Pay could not load its fonts. Please restart the app.
          </AppText>
        </View>
      );
    }
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
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
    color: '#172B3A',
    fontSize: 16,
    textAlign: 'center',
  },
});
