import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PortalHost } from '@rn-primitives/portal';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { Geist_700Bold } from '@expo-google-fonts/geist/700Bold';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DesignThemeProvider } from '@/features/design-theme';
import { AuthProvider } from '@/features/auth';
import { AppUpdateGate } from '@/features/app-update';
import { PreviewProvider } from '@/features/preview';

void SplashScreen.preventAutoHideAsync();
const query = new QueryClient();
export default function Layout() {
  const [loaded, error] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold });
  useEffect(() => { if (loaded || error) void SplashScreen.hideAsync(); }, [loaded, error]);
  if (!loaded && !error) return null;
  return <GestureHandlerRootView style={{ flex: 1 }}><QueryClientProvider client={query}>
    <DesignThemeProvider><PreviewProvider><AuthProvider><AppUpdateGate>
      <Stack screenOptions={{ headerShown: false }} /><StatusBar style="auto" /><PortalHost />
    </AppUpdateGate></AuthProvider></PreviewProvider></DesignThemeProvider>
  </QueryClientProvider></GestureHandlerRootView>;
}
