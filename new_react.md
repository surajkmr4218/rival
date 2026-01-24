# Rival - React Native Frontend

A simple, practical React Native implementation matching the existing iOS app.

## Stack

- React Native + Expo
- TypeScript
- React Navigation
- Zustand (state)
- Axios (API)
- expo-secure-store (tokens)

## Project Structure

```
src/
├── api/
│   ├── client.ts
│   └── types.ts
├── screens/
│   ├── LoginScreen.tsx
│   ├── DashboardScreen.tsx
│   ├── ActiveScreen.tsx
│   ├── LeaderboardScreen.tsx
│   └── ProfileScreen.tsx
├── store/
│   └── auth.ts
├── navigation/
│   └── index.tsx
├── theme.ts
└── App.tsx
```

## Theme

```typescript
// src/theme.ts

export const colors = {
  background: '#0a2f1f',
  card: '#0d3d28',
  accent: '#00ff88',
  border: 'rgba(0, 255, 136, 0.3)',
  text: '#ffffff',
  textMuted: '#9ca3af',
  error: '#ef4444',
};
```

## API

```typescript
// src/api/types.ts

export interface User {
  id: number;
  email: string;
  username: string;
  balance_cents: number;
  created_at: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
}
```

```typescript
// src/api/client.ts

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';

const api = axios.create({
  baseURL: __DEV__
    ? 'https://your-ngrok-url.ngrok-free.app'
    : 'https://api.rival.app',
  timeout: 10000,
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const saveToken = (token: string) =>
  SecureStore.setItemAsync(TOKEN_KEY, token);

export const deleteToken = () =>
  SecureStore.deleteItemAsync(TOKEN_KEY);

export const getToken = () =>
  SecureStore.getItemAsync(TOKEN_KEY);

// Auth
export const register = (email: string, username: string, password: string) =>
  api.post('/api/auth/register', { email, username, password });

export const login = (email: string, password: string) =>
  api.post('/api/auth/login', `username=${email}&password=${password}`, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

export const appleAuth = (identityToken: string, fullName?: string) =>
  api.post('/api/auth/apple', { identity_token: identityToken, full_name: fullName });

// User
export const getMe = () => api.get('/api/users/me');

export default api;
```

## Auth Store

```typescript
// src/store/auth.ts

import { create } from 'zustand';
import * as api from '../api/client';
import type { User } from '../api/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  appleSignIn: (token: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.login(email, password);
      await api.saveToken(data.access_token);
      await get().loadUser();
    } catch (e: any) {
      set({ error: e.response?.data?.detail || 'Login failed', isLoading: false });
    }
  },

  register: async (email, username, password) => {
    set({ isLoading: true, error: null });
    try {
      await api.register(email, username, password);
      await get().login(email, password);
    } catch (e: any) {
      set({ error: e.response?.data?.detail || 'Registration failed', isLoading: false });
    }
  },

  appleSignIn: async (token, name) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.appleAuth(token, name);
      await api.saveToken(data.access_token);
      await get().loadUser();
    } catch (e: any) {
      set({ error: e.response?.data?.detail || 'Apple Sign In failed', isLoading: false });
    }
  },

  logout: async () => {
    await api.deleteToken();
    set({ user: null, error: null });
  },

  loadUser: async () => {
    try {
      const token = await api.getToken();
      if (!token) {
        set({ isLoading: false });
        return;
      }
      const { data } = await api.getMe();
      set({ user: data, isLoading: false });
    } catch {
      await api.deleteToken();
      set({ user: null, isLoading: false });
    }
  },
}));
```

## Navigation

```typescript
// src/navigation/index.tsx

import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '../store/auth';
import { colors } from '../theme';
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ActiveScreen from '../screens/ActiveScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Active"
        component={ActiveScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="flame" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Leaderboard"
        component={LeaderboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="trophy" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function Navigation() {
  const { user, isLoading, loadUser } = useAuth();

  useEffect(() => {
    loadUser();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

## Screens

### LoginScreen

```typescript
// src/screens/LoginScreen.tsx

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../store/auth';
import { colors } from '../theme';

export default function LoginScreen() {
  const { login, register, appleSignIn, isLoading, error } = useAuth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const isValid = isSignUp
    ? email && username && password && password === confirmPassword && password.length >= 6
    : email && password;

  const handleSubmit = () => {
    if (isSignUp) {
      register(email, username, password);
    } else {
      login(email, password);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        ],
      });

      if (credential.identityToken) {
        const name = credential.fullName
          ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
          : undefined;
        appleSignIn(credential.identityToken, name || undefined);
      }
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        console.error(e);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoBox}>
          <Ionicons name="trophy" size={40} color={colors.accent} />
        </View>

        <Text style={styles.title}>RIVAL</Text>
        <Text style={styles.subtitle}>HIGH STAKES PRODUCTIVITY</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        {/* Toggle */}
        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, !isSignUp && styles.toggleBtnActive]}
            onPress={() => setIsSignUp(false)}
          >
            <Text style={[styles.toggleText, !isSignUp && styles.toggleTextActive]}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, isSignUp && styles.toggleBtnActive]}
            onPress={() => setIsSignUp(true)}
          >
            <Text style={[styles.toggleText, isSignUp && styles.toggleTextActive]}>Sign Up</Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={colors.textMuted}
          />

          {isSignUp && (
            <>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                placeholderTextColor={colors.textMuted}
              />
            </>
          )}

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor={colors.textMuted}
          />

          {isSignUp && (
            <>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholderTextColor={colors.textMuted}
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.button, !isValid && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={!isValid || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.buttonText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Apple Sign In */}
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={8}
          style={styles.appleButton}
          onPress={handleAppleSignIn}
        />

        <Text style={styles.footer}>WAGER RESPONSIBLY</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logoBox: {
    alignSelf: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 24,
  },
  error: {
    color: colors.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: colors.accent,
    borderRadius: 7,
  },
  toggleText: {
    fontWeight: '600',
    color: colors.textMuted,
  },
  toggleTextActive: {
    color: colors.background,
  },
  form: {
    gap: 8,
  },
  label: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 8,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
    color: colors.text,
    fontSize: 16,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.background,
    fontWeight: '600',
    fontSize: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textMuted,
    marginHorizontal: 16,
    fontSize: 12,
  },
  appleButton: {
    height: 50,
  },
  footer: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    letterSpacing: 2,
    marginTop: 32,
  },
});
```

### DashboardScreen

```typescript
// src/screens/DashboardScreen.tsx

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

export default function DashboardScreen() {
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="trophy" size={32} color={colors.accent} />
        <Text style={styles.logo}>RIVAL</Text>
      </View>

      {/* Active Challenges */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.dot} />
          <Text style={styles.sectionTitle}>ACTIVE CHALLENGES</Text>
        </View>

        <Text style={styles.empty}>No active challenges</Text>
      </View>

      {/* CTA */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.button} onPress={() => {}}>
          <Text style={styles.buttonText}>START NEW CHALLENGE</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  logo: {
    fontSize: 18,
    fontWeight: '900',
    fontStyle: 'italic',
    color: colors.accent,
    marginTop: 8,
  },
  section: {
    flex: 1,
    paddingHorizontal: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  empty: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 40,
  },
  footer: {
    padding: 24,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 16,
  },
});
```

### ActiveScreen

```typescript
// src/screens/ActiveScreen.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

export default function ActiveScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>No active challenges</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: colors.textMuted,
  },
});
```

### LeaderboardScreen

```typescript
// src/screens/LeaderboardScreen.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

export default function LeaderboardScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Leaderboard coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: colors.textMuted,
  },
});
```

### ProfileScreen

```typescript
// src/screens/ProfileScreen.tsx

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../store/auth';
import { colors } from '../theme';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const balance = user ? `$${(user.balance_cents / 100).toFixed(2)}` : '$0.00';

  return (
    <View style={styles.container}>
      {/* Avatar */}
      <Ionicons name="person-circle" size={80} color={colors.accent} />

      <Text style={styles.username}>@{user?.username}</Text>
      <Text style={styles.email}>{user?.email}</Text>

      {/* Balance */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>BALANCE</Text>
        <Text style={styles.balanceValue}>{balance}</Text>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>LOGOUT</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 24,
  },
  username: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
  },
  email: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  balanceCard: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginTop: 32,
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  balanceValue: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.accent,
    marginTop: 8,
  },
  logoutBtn: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  logoutText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
});
```

## App Entry

```typescript
// App.tsx

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Navigation from './src/navigation';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Navigation />
    </SafeAreaProvider>
  );
}
```

## Setup

```bash
# Create project
npx create-expo-app rival --template blank-typescript
cd rival

# Install deps
npx expo install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context
npm install zustand axios
npx expo install expo-secure-store expo-apple-authentication @expo/vector-icons

# Create folders
mkdir -p src/{api,screens,store,navigation}

# Run
npx expo start
```

## Backend Endpoints (Current)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login (form-encoded) |
| POST | `/api/auth/apple` | Apple Sign In |
| GET | `/api/users/me` | Get current user |
