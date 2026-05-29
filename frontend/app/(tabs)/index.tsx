import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { colors, motion, space, radius, type, elevation } from '../../lib/theme';
import { Challenge } from '../../lib/types';
import { getActiveChallenges, getPendingChallenges, getChallenges } from '../../lib/api';
import ChallengeCard from '../../components/ChallengeCard';
import AnimatedMount from '../../components/anim/AnimatedMount';
import PressableScale from '../../components/anim/PressableScale';
import ScreenBackground from '../../components/ui/ScreenBackground';
import Gradient from '../../components/ui/Gradient';
import PrimaryButton from '../../components/ui/PrimaryButton';
import SectionHeader from '../../components/ui/SectionHeader';
import { useAuth } from '../../lib/auth';

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeChallenges, setActiveChallenges] = useState<Challenge[]>([]);
  const [outgoingPending, setOutgoingPending] = useState<Challenge[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [activeRes, pendingRes, allRes] = await Promise.all([
        getActiveChallenges(),
        getPendingChallenges(),
        getChallenges(),
      ]);
      setActiveChallenges(activeRes.data.challenges);
      setPendingCount(pendingRes.data.challenges.length);
      const outgoing = allRes.data.challenges.filter(
        (c: Challenge) => c.status === 'pending' && c.creator.id === user.id
      );
      setOutgoingPending(outgoing);
    } catch (error) {
      console.error('Failed to load challenges:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Auto-refresh while any challenge is being AI-evaluated so the dashboard
  // flips EVALUATING → WON/LOST without a manual pull-to-refresh.
  useEffect(() => {
    const hasEvaluating = activeChallenges.some((c) => c.status === 'evaluating');
    if (!hasEvaluating) return;
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, [activeChallenges, loadData]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleChallengePress = (challenge: Challenge) => {
    router.push(`/challenge/${challenge.id}`);
  };

  const liveCount = activeChallenges.filter((c) => c.status === 'active').length;
  const atStake = activeChallenges.reduce((sum, c) => sum + (c.stake_cents || 0), 0);
  const formatMoney = (cents: number) => `$${(cents / 100).toFixed(0)}`;

  return (
    <View style={styles.root}>
      <ScreenBackground />
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* App bar */}
          <View style={styles.appBar}>
            <View style={styles.brandRow}>
              <View style={styles.brandBadge}>
                <Ionicons name="trophy" size={18} color={colors.accent} />
              </View>
              <View>
                <Text style={styles.brand}>RIVAL</Text>
                <Text style={styles.brandSub}>@{user?.username ?? 'player'}</Text>
              </View>
            </View>
            <PressableScale
              style={styles.bell}
              onPress={() => router.push('/challenge/pending')}
              accessibilityLabel={`${pendingCount} pending challenges`}
            >
              <Ionicons name="notifications-outline" size={22} color={colors.text} />
              {pendingCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{pendingCount}</Text>
                </View>
              )}
            </PressableScale>
          </View>

          {/* Hero stat strip */}
          <AnimatedMount delay={0} style={styles.heroWrap}>
            <Gradient
              colors={['#0c4a30', '#0c3a27']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              radius={radius.xl}
              style={[styles.hero, elevation(2)]}
            >
              <View style={styles.heroStat}>
                <Text style={styles.heroValue}>{liveCount}</Text>
                <Text style={styles.heroLabel}>LIVE BATTLES</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStat}>
                <Text style={[styles.heroValue, { color: colors.secondary }]}>{formatMoney(atStake)}</Text>
                <Text style={styles.heroLabel}>AT STAKE</Text>
              </View>
            </Gradient>
          </AnimatedMount>

          {/* Incoming pending banner */}
          {pendingCount > 0 && (
            <AnimatedMount delay={motion.stagger}>
              <PressableScale
                style={styles.pendingBanner}
                onPress={() => router.push('/challenge/pending')}
              >
                <View style={styles.pendingIcon}>
                  <Ionicons name="mail-unread" size={18} color={colors.pending} />
                </View>
                <View style={styles.pendingTextWrap}>
                  <Text style={styles.pendingTitle}>
                    {pendingCount} challenge{pendingCount > 1 ? 's' : ''} await you
                  </Text>
                  <Text style={styles.pendingSub}>Tap to accept or decline</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </PressableScale>
            </AnimatedMount>
          )}

          {/* Outgoing pending */}
          {outgoingPending.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="SENT — AWAITING" count={outgoingPending.length} dotColor={colors.pending} />
              {outgoingPending.map((challenge, index) => (
                <AnimatedMount key={challenge.id} delay={motion.stagger * (index + 2)}>
                  <ChallengeCard
                    challenge={challenge}
                    currentUserId={user?.id || 0}
                    onPress={() => handleChallengePress(challenge)}
                  />
                </AnimatedMount>
              ))}
            </View>
          )}

          {/* Active */}
          <View style={styles.section}>
            <SectionHeader title="ACTIVE BATTLES" count={liveCount} />
            {activeChallenges.length === 0 ? (
              <AnimatedMount delay={motion.stagger * 2}>
                <View style={styles.empty}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="flash-outline" size={28} color={colors.accent} />
                  </View>
                  <Text style={styles.emptyTitle}>No battles yet</Text>
                  <Text style={styles.emptySub}>
                    Challenge a rival to a productivity duel and put your focus on the line.
                  </Text>
                </View>
              </AnimatedMount>
            ) : (
              activeChallenges.map((challenge, index) => (
                <AnimatedMount key={challenge.id} delay={motion.stagger * (index + 2)}>
                  <ChallengeCard
                    challenge={challenge}
                    currentUserId={user?.id || 0}
                    onPress={() => handleChallengePress(challenge)}
                  />
                </AnimatedMount>
              ))
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton
            label="START NEW BATTLE"
            icon="add"
            onPress={() => router.push('/challenge/create')}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  scrollContent: { paddingBottom: 28 },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.lg,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 1,
  },
  brandSub: { color: colors.textMuted, ...type.caption, marginTop: 1 },
  bell: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: colors.pending,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  bellBadgeText: { color: '#3a2600', fontSize: 11, fontWeight: '800' },
  heroWrap: { paddingHorizontal: space.xl, marginBottom: space.xl },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  heroStat: { flex: 1, alignItems: 'center' },
  heroValue: {
    color: colors.accent,
    fontSize: 34,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  heroLabel: { color: colors.textSecondary, ...type.overline, marginTop: 4 },
  heroDivider: { width: 1, height: 44, backgroundColor: colors.hairline },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    marginHorizontal: space.xl,
    marginBottom: space.xl,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.pendingSoft,
  },
  pendingIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.pendingSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingTextWrap: { flex: 1 },
  pendingTitle: { color: colors.text, ...type.bodyStrong, fontSize: 15 },
  pendingSub: { color: colors.textMuted, ...type.caption, marginTop: 2 },
  section: { paddingHorizontal: space.xl, marginBottom: space.sm },
  empty: {
    alignItems: 'center',
    paddingVertical: space.xxxl,
    paddingHorizontal: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  emptyTitle: { color: colors.text, ...type.h3, marginBottom: 6 },
  emptySub: {
    color: colors.textMuted,
    ...type.callout,
    textAlign: 'center',
    maxWidth: 280,
  },
  footer: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
});
