import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { useRealtime } from '../lib/realtime';
import { colors } from '../lib/theme';
import { View, ActivityIndicator } from 'react-native';

export default function RootLayout() {
  const { user, isLoading, loadUser } = useAuth();
  const { connect, disconnect } = useRealtime();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    loadUser();
  }, []);

  // Open one WebSocket while logged in; close it on logout. This is the single
  // real-time connection that pushes verdicts + live progress to every screen.
  useEffect(() => {
    if (user) {
      connect();
    } else {
      disconnect();
    }
  }, [user]);

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
        <Stack.Screen name="auth" />
      </Stack>
    </SafeAreaProvider>
  );
}
