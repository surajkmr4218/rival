import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, RefreshControl, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { colors } from '../../lib/theme';
import {
  getGitHubStatus,
  getGitHubOAuthUrl,
  disconnectGitHub,
  connectGitHub,
  getNotionStatus,
  getNotionOAuthUrl,
  disconnectNotion,
  connectNotion,
  getUserStats,
  addBalance,
  getMe,
} from '../../lib/api';
import type { NotionStatus, UserStats } from '../../lib/types';
import TopUpDrawer from '../../components/TopUpDrawer';
import BalanceChart from '../../components/BalanceChart';

interface GitHubStatus {
  connected: boolean;
  username: string | null;
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [githubStatus, setGithubStatus] = useState<GitHubStatus>({ connected: false, username: null });
  const [notionStatus, setNotionStatus] = useState<NotionStatus>({ connected: false, workspace_name: null, workspace_id: null });
  const [stats, setStats] = useState<UserStats | null>(null);
  const [balance, setBalance] = useState(user?.balance_cents || 0);
  const [isLoadingGitHub, setIsLoadingGitHub] = useState(true);
  const [isLoadingNotion, setIsLoadingNotion] = useState(true);
  const [isConnectingGitHub, setIsConnectingGitHub] = useState(false);
  const [isConnectingNotion, setIsConnectingNotion] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [showNewUserTopUp, setShowNewUserTopUp] = useState(false);
  const [hasCompletedTopUp, setHasCompletedTopUp] = useState(false);
  const [chartRefreshTrigger, setChartRefreshTrigger] = useState(0);

  const formatBalance = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const fetchStatuses = useCallback(async () => {
    if (!user) return;

    // Fetch user balance
    try {
      const response = await getMe();
      setBalance(response.data.balance_cents);

      // Show top-up for new users with 0 balance (only if they haven't already topped up this session)
      if (response.data.balance_cents === 0 && !hasCompletedTopUp) {
        setShowNewUserTopUp(true);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }

    // Fetch stats
    try {
      const response = await getUserStats();
      setStats(response.data);
    } catch (error) {
      // Stats endpoint might not exist yet, use defaults
      setStats({
        challenges_won: 0,
        challenges_lost: 0,
        total_earnings_cents: 0,
        current_streak: 0,
        win_rate: 0,
      });
    }

    // Fetch GitHub status
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

    // Fetch Notion status
    try {
      const response = await getNotionStatus();
      setNotionStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch Notion status:', error);
    } finally {
      setIsLoadingNotion(false);
    }
  }, [user, hasCompletedTopUp]);

  useFocusEffect(
    useCallback(() => {
      fetchStatuses();
    }, [fetchStatuses])
  );

  const onRefresh = async () => {
    setIsRefreshing(true);
    await fetchStatuses();
    setChartRefreshTrigger((prev) => prev + 1);
    setIsRefreshing(false);
  };

  const handleTopUpComplete = async (amountCents: number) => {
    try {
      await addBalance(amountCents);
      setBalance((prev) => prev + amountCents);
    } catch (error) {
      // For demo, just update locally
      setBalance((prev) => prev + amountCents);
    }
    setHasCompletedTopUp(true);
    setShowTopUp(false);
    setShowNewUserTopUp(false);
    // Refresh chart after balance change
    setChartRefreshTrigger((prev) => prev + 1);
  };

  const handleConnectGitHub = async () => {
    setIsConnectingGitHub(true);
    try {
      const redirectUri = AuthSession.makeRedirectUri({ scheme: 'rival', path: 'github/callback' });
      const oauthResponse = await getGitHubOAuthUrl(redirectUri);
      const result = await WebBrowser.openAuthSessionAsync(oauthResponse.data.url, redirectUri);

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          Alert.alert('Error', 'GitHub authorization was denied');
          return;
        }

        if (code) {
          const response = await connectGitHub(code);
          setGithubStatus({ connected: true, username: response.data.github_username });
          Alert.alert('Success', `Connected as @${response.data.github_username}`);
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to connect GitHub');
    } finally {
      setIsConnectingGitHub(false);
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

  const handleConnectNotion = async () => {
    setIsConnectingNotion(true);
    try {
      const redirectUri = AuthSession.makeRedirectUri();
      const oauthResponse = await getNotionOAuthUrl(redirectUri);
      const result = await WebBrowser.openAuthSessionAsync(oauthResponse.data.url, redirectUri);

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          Alert.alert('Error', 'Notion authorization was denied');
          return;
        }

        if (code) {
          const response = await connectNotion(code);
          setNotionStatus({
            connected: true,
            workspace_name: response.data.workspace_name,
            workspace_id: response.data.workspace_id,
          });
          Alert.alert('Success', `Connected to ${response.data.workspace_name}`);
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to connect Notion');
    } finally {
      setIsConnectingNotion(false);
    }
  };

  const handleDisconnectNotion = async () => {
    try {
      await disconnectNotion();
      setNotionStatus({ connected: false, workspace_name: null, workspace_id: null });
    } catch (error) {
      console.error('Failed to disconnect Notion:', error);
    }
  };

  const IntegrationCard = ({
    icon,
    title,
    isLoading,
    isConnected,
    connectedLabel,
    isConnecting,
    onConnect,
    onDisconnect,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    isLoading: boolean;
    isConnected: boolean;
    connectedLabel: string;
    isConnecting: boolean;
    onConnect: () => void;
    onDisconnect: () => void;
  }) => (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={24} color={colors.text} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.accent} />
      ) : isConnected ? (
        <View style={styles.connectedRow}>
          <View style={styles.connectedInfo}>
            <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
            <Text style={styles.connectedText}>{connectedLabel}</Text>
          </View>
          <Pressable style={styles.disconnectBtn} onPress={onDisconnect}>
            <Text style={styles.disconnectText}>Disconnect</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.connectBtn} onPress={onConnect} disabled={isConnecting}>
          {isConnecting ? (
            <ActivityIndicator color={colors.background} size="small" />
          ) : (
            <>
              <Ionicons name="link" size={18} color={colors.background} />
              <Text style={styles.connectText}>Connect {title}</Text>
            </>
          )}
        </Pressable>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        <Ionicons name="person-circle" size={80} color={colors.accent} />

        <Text style={styles.username}>@{user?.username}</Text>
        <Text style={styles.email}>{user?.email}</Text>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>BALANCE</Text>
          <Text style={styles.balanceValue}>{formatBalance(balance)}</Text>
          <Pressable style={styles.addFundsBtn} onPress={() => setShowTopUp(true)}>
            <Ionicons name="add-circle" size={20} color={colors.background} />
            <Text style={styles.addFundsText}>Add Funds</Text>
          </Pressable>
        </View>

        {/* Balance History Chart */}
        <BalanceChart refreshTrigger={chartRefreshTrigger} />

        {/* Stats Section */}
        {stats && (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>YOUR STATS</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.challenges_won}</Text>
                <Text style={styles.statLabel}>Won</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.challenges_lost}</Text>
                <Text style={styles.statLabel}>Lost</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, styles.statValueAccent]}>
                  {formatBalance(stats.total_earnings_cents)}
                </Text>
                <Text style={styles.statLabel}>Earnings</Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statItemWide}>
                <Ionicons name="flame" size={20} color={colors.accent} />
                <Text style={styles.statValue}>{stats.current_streak}</Text>
                <Text style={styles.statLabel}>Streak</Text>
              </View>
              <View style={styles.statItemWide}>
                <Ionicons name="trending-up" size={20} color={colors.accent} />
                <Text style={styles.statValue}>{Math.round(stats.win_rate * 100)}%</Text>
                <Text style={styles.statLabel}>Win Rate</Text>
              </View>
            </View>
          </View>
        )}

        {/* GitHub Integration */}
        <IntegrationCard
          icon="logo-github"
          title="GitHub"
          isLoading={isLoadingGitHub}
          isConnected={githubStatus.connected}
          connectedLabel={`@${githubStatus.username}`}
          isConnecting={isConnectingGitHub}
          onConnect={handleConnectGitHub}
          onDisconnect={handleDisconnectGitHub}
        />

        {/* Notion Integration */}
        <IntegrationCard
          icon="book"
          title="Notion"
          isLoading={isLoadingNotion}
          isConnected={notionStatus.connected}
          connectedLabel={notionStatus.workspace_name || 'Connected'}
          isConnecting={isConnectingNotion}
          onConnect={handleConnectNotion}
          onDisconnect={handleDisconnectNotion}
        />

        <Pressable style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>LOGOUT</Text>
        </Pressable>
      </ScrollView>

      {/* Top-up Drawer */}
      <TopUpDrawer
        visible={showTopUp || showNewUserTopUp}
        onComplete={handleTopUpComplete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 120,
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
    marginTop: 24,
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
  addFundsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 16,
    gap: 6,
  },
  addFundsText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 14,
  },
  statsCard: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  statsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 12,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statItemWide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  statValueAccent: {
    color: colors.accent,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
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
    width: '100%',
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  logoutText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
});
