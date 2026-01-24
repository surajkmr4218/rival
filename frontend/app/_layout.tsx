import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from './_store/auth';
import { colors } from './_theme';
import { View, ActivityIndicator } from 'react-native';

export default function RootLayout() {
  const { user, isLoading, loadUser } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(tabs)' || segments[0] === 'challenge';
    const inLoginPage = segments[0] === 'login';

    if (!user && inAuthGroup) {
      // Not logged in, redirect to login
      router.replace('/login');
    } else if (user && inLoginPage) {
      // Logged in but on login page, redirect to tabs
      router.replace('/(tabs)');
    }
  }, [user, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="challenge" />
      </Stack>
    </SafeAreaProvider>
  );
}
