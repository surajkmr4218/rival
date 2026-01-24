import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { useAuth } from '../_store/auth';
import { colors } from '../_theme';
import { getGitHubStatus, disconnectGitHub, connectGitHub } from '../_api/client';
import { GITHUB_CLIENT_ID } from '../_config';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [githubStatus, setGithubStatus] = useState<{
    connected: boolean;
    username: string | null;
  }>({ connected: false, username: null });
  const [isLoadingGitHub, setIsLoadingGitHub] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  const balance = user ? `$${(user.balance_cents / 100).toFixed(2)}` : '$0.00';

  const fetchGitHubStatus = useCallback(async () => {
    if (!user) return;
    try {
      const response = await getGitHubStatus();
      setGithubStatus({
        connected: response.data.connected,
        username: response.data.github_username,
      });
    } catch (error) {
      console.error('Failed to fetch GitHub status:', error);
    } finally {
      setIsLoadingGitHub(false);
    }
  }, [user]);

  // Refresh GitHub status when screen comes into focus (e.g., after OAuth callback)
  useFocusEffect(
    useCallback(() => {
      fetchGitHubStatus();
    }, [fetchGitHubStatus])
  );

  const handleConnectGitHub = async () => {
    setIsConnecting(true);
    try {
      // Create redirect URI that Expo can handle
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'rival',
        path: 'github/callback',
      });

      // Build GitHub OAuth URL
      const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user`;

      // Open browser and wait for redirect
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (result.type === 'success' && result.url) {
        // Extract the code from the redirect URL
        const url = new URL(result.url);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          Alert.alert('Error', 'GitHub authorization was denied');
          return;
        }

        if (code) {
          // Exchange code for token via backend
          const response = await connectGitHub(code);
          setGithubStatus({
            connected: true,
            username: response.data.github_username,
          });
          Alert.alert('Success', `Connected as @${response.data.github_username}`);
        }
      }
    } catch (error: any) {
      console.error('Failed to connect GitHub:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to connect GitHub');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectGitHub = async () => {
    try {
      await disconnectGitHub();
      setGithubStatus({ connected: false, username: null });
    } catch (error) {
      console.error('Failed to disconnect GitHub:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Ionicons name="person-circle" size={80} color={colors.accent} />

      <Text style={styles.username}>@{user?.username}</Text>
      <Text style={styles.email}>{user?.email}</Text>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>BALANCE</Text>
        <Text style={styles.balanceValue}>{balance}</Text>
      </View>

      {/* GitHub Integration Section */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="logo-github" size={24} color={colors.text} />
          <Text style={styles.sectionTitle}>GitHub</Text>
        </View>

        {isLoadingGitHub ? (
          <ActivityIndicator color={colors.accent} />
        ) : githubStatus.connected ? (
          <View style={styles.connectedRow}>
            <View style={styles.connectedInfo}>
              <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
              <Text style={styles.connectedText}>@{githubStatus.username}</Text>
            </View>
            <Pressable style={styles.disconnectBtn} onPress={handleDisconnectGitHub}>
              <Text style={styles.disconnectText}>Disconnect</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={styles.connectBtn}
            onPress={handleConnectGitHub}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <ActivityIndicator color={colors.background} size="small" />
            ) : (
              <>
                <Ionicons name="link" size={18} color={colors.background} />
                <Text style={styles.connectText}>Connect GitHub</Text>
              </>
            )}
          </Pressable>
        )}
      </View>

      <Pressable style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>LOGOUT</Text>
      </Pressable>
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
  sectionCard: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 8,
  },
  connectedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  connectedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectedText: {
    color: colors.text,
    fontSize: 14,
    marginLeft: 8,
  },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: 8,
    padding: 12,
  },
  connectText: {
    color: colors.background,
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 8,
  },
  disconnectBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  disconnectText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
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
