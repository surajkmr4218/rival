import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, RefreshControl, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import AnimatedMount from '../../components/anim/AnimatedMount';
import PressableScale from '../../components/anim/PressableScale';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { colors, motion, space, radius, type, glow, elevation } from '../../lib/theme';
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
import ScreenBackground from '../../components/ui/ScreenBackground';
import Gradient from '../../components/ui/Gradient';
import SectionHeader from '../../components/ui/SectionHeader';

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

    try {
      const response = await getMe();
      setBalance(response.data.balance_cents);
      if (response.data.balance_cents === 0 && !hasCompletedTopUp) {
        setShowNewUserTopUp(true);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }

    try {
      const response = await getUserStats();
      setStats(response.data);
    } catch (error) {
      setStats({
        challenges_won: 0,
        challenges_lost: 0,
        total_earnings_cents: 0,
        current_streak: 0,
        win_rate: 0,
      });
    }

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
      setBalance((prev) => prev + amountCents);
    }
    setHasCompletedTopUp(true);
    setShowTopUp(false);
    setShowNewUserTopUp(false);
    setChartRefreshTrigger((prev) => prev + 1);
  };

  const handleConnectGitHub = async () => {
    setIsConnectingGitHub(true);
    try {
      const appReturnUrl = AuthSession.makeRedirectUri({ scheme: 'rival', path: 'auth/github' });
      const oauthResponse = await getGitHubOAuthUrl(appReturnUrl);
      const result = await WebBrowser.openAuthSessionAsync(oauthResponse.data.url, appReturnUrl);

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

  const StatTile = ({
    icon,
    value,
    label,
    color = colors.text,
    tint = colors.accentSoft,
    iconColor = colors.accent,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    value: string | number;
    label: string;
    color?: string;
    tint?: string;
    iconColor?: string;
  }) => (
    <View style={styles.statTile}>
      <View style={[styles.statIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const IntegrationCard = ({
    icon,
    title,
    subtitle,
    isLoading,
    isConnected,
    connectedLabel,
    isConnecting,
    onConnect,
    onDisconnect,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle: string;
    isLoading: boolean;
    isConnected: boolean;
    connectedLabel: string;
    isConnecting: boolean;
    onConnect: () => void;
    onDisconnect: () => void;
  }) => (
    <View style={[styles.integrationCard, isConnected && styles.integrationConnected]}>
      <View style={styles.integrationLeft}>
        <View style={[styles.integrationIcon, isConnected && { backgroundColor: colors.accentSoft }]}>
          <Ionicons name={icon} size={22} color={isConnected ? colors.accent : colors.text} />
        </View>
        <View style={styles.integrationText}>
          <Text style={styles.integrationTitle}>{title}</Text>
          {isLoading ? (
            <Text style={styles.integrationSub}>Checking…</Text>
          ) : isConnected ? (
            <View style={styles.integrationStatusRow}>
              <Ionicons name="checkmark-circle" size={13} color={colors.accent} />
              <Text style={[styles.integrationSub, { color: colors.accent }]} numberOfLines={1}>
                {connectedLabel}
              </Text>
            </View>
          ) : (
            <Text style={styles.integrationSub}>{subtitle}</Text>
          )}
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.accent} />
      ) : isConnected ? (
        <PressableScale style={styles.disconnectBtn} onPress={onDisconnect}>
          <Text style={styles.disconnectText}>Disconnect</Text>
        </PressableScale>
      ) : (
        <PressableScale style={styles.connectBtn} onPress={onConnect} disabled={isConnecting}>
          {isConnecting ? (
            <ActivityIndicator color={colors.accent} size="small" />
          ) : (
            <Text style={styles.connectText}>Connect</Text>
          )}
        </PressableScale>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      <ScreenBackground />
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Identity */}
          <AnimatedMount delay={0} style={styles.identity}>
            <View style={styles.avatarRing}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={34} color={colors.accent} />
              </View>
            </View>
            <Text style={styles.username}>@{user?.username}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </AnimatedMount>

          {/* Balance hero */}
          <AnimatedMount delay={motion.stagger} style={styles.fullWidth}>
            <Gradient
              colors={['#1c2e4a', '#103a2a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              radius={radius.xl}
              style={[styles.balanceCard, elevation(2)]}
            >
              <View style={styles.balanceTop}>
                <View>
                  <Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text>
                  <Text style={styles.balanceValue}>{formatBalance(balance)}</Text>
                </View>
                <View style={styles.walletChip}>
                  <Ionicons name="wallet" size={20} color={colors.secondary} />
                </View>
              </View>
              <PressableScale
                style={[styles.addFundsBtn, glow(colors.accent, 0.35)]}
                onPress={() => setShowTopUp(true)}
              >
                <Ionicons name="add-circle" size={18} color="#04231a" />
                <Text style={styles.addFundsText}>Add Funds</Text>
              </PressableScale>
            </Gradient>
          </AnimatedMount>

          {/* Balance history chart */}
          <AnimatedMount delay={motion.stagger * 2} style={styles.fullWidth}>
            <BalanceChart refreshTrigger={chartRefreshTrigger} />
          </AnimatedMount>

          {/* Stats */}
          {stats && (
            <AnimatedMount delay={motion.stagger * 3} style={styles.fullWidth}>
              <SectionHeader title="YOUR STATS" style={styles.sectionGap} />
              <View style={styles.statsGrid}>
                <StatTile icon="trophy" value={stats.challenges_won} label="WON" />
                <StatTile
                  icon="close-circle"
                  value={stats.challenges_lost}
                  label="LOST"
                  color={colors.loss}
                  tint={colors.lossSoft}
                  iconColor={colors.loss}
                />
                <StatTile
                  icon="trending-up"
                  value={`${Math.round(stats.win_rate * 100)}%`}
                  label="WIN RATE"
                  color={colors.secondary}
                  tint={colors.secondarySoft}
                  iconColor={colors.secondary}
                />
              </View>
              <View style={styles.statsGrid}>
                <StatTile
                  icon="flame"
                  value={stats.current_streak}
                  label="STREAK"
                  color={colors.pending}
                  tint={colors.pendingSoft}
                  iconColor={colors.pending}
                />
                <StatTile
                  icon="cash"
                  value={formatBalance(stats.total_earnings_cents)}
                  label="EARNINGS"
                  color={colors.accent}
                />
              </View>
            </AnimatedMount>
          )}

          {/* Integrations */}
          <AnimatedMount delay={motion.stagger * 4} style={styles.fullWidth}>
            <SectionHeader title="CONNECTED ACCOUNTS" style={styles.sectionGap} />
            <IntegrationCard
              icon="logo-github"
              title="GitHub"
              subtitle="Track commits & pull requests"
              isLoading={isLoadingGitHub}
              isConnected={githubStatus.connected}
              connectedLabel={`@${githubStatus.username}`}
              isConnecting={isConnectingGitHub}
              onConnect={handleConnectGitHub}
              onDisconnect={handleDisconnectGitHub}
            />
            <IntegrationCard
              icon="book"
              title="Notion"
              subtitle="Track study notes & pages"
              isLoading={isLoadingNotion}
              isConnected={notionStatus.connected}
              connectedLabel={notionStatus.workspace_name || 'Connected'}
              isConnecting={isConnectingNotion}
              onConnect={handleConnectNotion}
              onDisconnect={handleDisconnectNotion}
            />
          </AnimatedMount>

          {/* Logout — spatially separated from everything else */}
          <PressableScale style={styles.logoutBtn} onPress={logout}>
            <Ionicons name="log-out-outline" size={18} color={colors.loss} />
            <Text style={styles.logoutText}>Log out</Text>
          </PressableScale>
        </ScrollView>
      </SafeAreaView>

      <TopUpDrawer visible={showTopUp || showNewUserTopUp} onComplete={handleTopUpComplete} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  content: {
    paddingTop: space.xl,
    paddingHorizontal: space.xl,
    paddingBottom: 120,
  },
  fullWidth: { width: '100%' },
  sectionGap: { marginTop: space.xxl },
  identity: { alignItems: 'center' },
  avatarRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    padding: 4,
    ...glow(colors.accent, 0.2),
  },
  avatar: {
    flex: 1,
    borderRadius: 40,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: { ...type.h2, color: colors.text, marginTop: space.md },
  email: { ...type.callout, color: colors.textMuted, marginTop: 2 },
  balanceCard: {
    width: '100%',
    padding: space.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginTop: space.xxl,
  },
  balanceTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  balanceLabel: { color: colors.textSecondary, ...type.overline },
  balanceValue: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    marginTop: 6,
  },
  walletChip: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.secondarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addFundsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 11,
    paddingHorizontal: 18,
    marginTop: space.xl,
    gap: 7,
  },
  addFundsText: { ...type.callout, color: '#04231a', fontWeight: '800', fontSize: 14 },
  statsGrid: { flexDirection: 'row', gap: space.md, marginBottom: space.md },
  statTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    alignItems: 'flex-start',
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.2, color: colors.text, fontVariant: ['tabular-nums'] },
  statLabel: { color: colors.textMuted, ...type.overline, fontSize: 9.5, marginTop: 2 },
  integrationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    marginBottom: space.md,
  },
  integrationConnected: { borderColor: colors.borderStrong },
  integrationLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  integrationIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  integrationText: { flex: 1 },
  integrationTitle: { color: colors.text, ...type.bodyStrong, fontSize: 15 },
  integrationStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  integrationSub: { color: colors.textMuted, ...type.caption, marginTop: 2 },
  connectBtn: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  connectText: { color: colors.accent, ...type.label, fontWeight: '700' },
  disconnectBtn: {
    backgroundColor: colors.lossSoft,
    borderRadius: radius.sm,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  disconnectText: { color: colors.loss, ...type.caption, fontWeight: '700' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.lossSoft,
    borderRadius: radius.md,
    paddingVertical: 14,
    marginTop: space.xxxl,
  },
  logoutText: { color: colors.loss, ...type.bodyStrong, fontSize: 15 },
});
