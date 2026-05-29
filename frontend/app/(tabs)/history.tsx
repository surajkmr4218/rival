import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { colors, motion, space, radius, type, elevation } from '../../lib/theme';
import { Challenge } from '../../lib/types';
import { getChallenges } from '../../lib/api';
import ChallengeCard from '../../components/ChallengeCard';
import AnimatedMount from '../../components/anim/AnimatedMount';
import { SkeletonCard } from '../../components/anim/Skeleton';
import ScreenBackground from '../../components/ui/ScreenBackground';
import { useAuth } from '../../lib/auth';

export default function HistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadChallenges = useCallback(async () => {
    if (!user) return;
    try {
      const response = await getChallenges();
      const completed = response.data.challenges.filter(
        (c: Challenge) => c.status === 'completed'
      );
      setChallenges(completed);
    } catch (error) {
      console.error('Failed to load challenges:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadChallenges();
    }, [loadChallenges])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    loadChallenges();
  };

  const handleChallengePress = (challenge: Challenge) => {
    router.push(`/challenge/${challenge.id}`);
  };

  const wins = challenges.filter((c) => c.winner_id === user?.id).length;
  const ties = challenges.filter((c) => c.winner_id === null).length;
  const losses = challenges.length - wins - ties;
  const decisive = wins + losses;
  const winRate = decisive > 0 ? Math.round((wins / decisive) * 100) : 0;

  const Record = () => (
    <View style={styles.recordWrap}>
      <Text style={styles.screenTitle}>History</Text>
      <Text style={styles.screenSub}>Every battle, settled by the AI referee.</Text>
      <View style={[styles.recordCard, elevation(2)]}>
        <View style={styles.recordCol}>
          <Text style={[styles.recordValue, { color: colors.accent }]}>{wins}</Text>
          <Text style={styles.recordLabel}>WON</Text>
        </View>
        <View style={styles.recordDivider} />
        <View style={styles.recordCol}>
          <Text style={[styles.recordValue, { color: colors.loss }]}>{losses}</Text>
          <Text style={styles.recordLabel}>LOST</Text>
        </View>
        <View style={styles.recordDivider} />
        <View style={styles.recordCol}>
          <Text style={[styles.recordValue, { color: colors.secondary }]}>{winRate}%</Text>
          <Text style={styles.recordLabel}>WIN RATE</Text>
        </View>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.root}>
        <ScreenBackground />
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.listContent}>
            <Text style={styles.screenTitle}>History</Text>
            <View style={{ height: space.lg }} />
            {[0, 1, 2, 3].map((i) => (
              <AnimatedMount key={i} delay={i * motion.stagger}>
                <SkeletonCard />
              </AnimatedMount>
            ))}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenBackground />
      <SafeAreaView style={styles.container} edges={['top']}>
        <FlatList
          data={challenges}
          keyExtractor={(item) => item.id.toString()}
          ListHeaderComponent={challenges.length > 0 ? <Record /> : null}
          renderItem={({ item, index }) => (
            <AnimatedMount delay={Math.min(index, 8) * motion.stagger}>
              <ChallengeCard
                challenge={item}
                currentUserId={user?.id || 0}
                onPress={() => handleChallengePress(item)}
              />
            </AnimatedMount>
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons name="time-outline" size={32} color={colors.accent} />
              </View>
              <Text style={styles.emptyTitle}>No history yet</Text>
              <Text style={styles.emptySubtitle}>
                Finished battles and their AI verdicts will live here.
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  listContent: { padding: space.xl, flexGrow: 1 },
  screenTitle: { color: colors.text, ...type.h1 },
  screenSub: { color: colors.textMuted, ...type.callout, marginTop: 4 },
  recordWrap: { marginBottom: space.xl },
  recordCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space.xl,
    marginTop: space.lg,
  },
  recordCol: { flex: 1, alignItems: 'center' },
  recordValue: { fontSize: 28, fontWeight: '900', fontVariant: ['tabular-nums'] },
  recordLabel: { color: colors.textSecondary, ...type.overline, fontSize: 10, marginTop: 4 },
  recordDivider: { width: 1, height: 36, backgroundColor: colors.hairline },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 120,
    paddingHorizontal: space.xl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.lg,
  },
  emptyTitle: { color: colors.text, ...type.h3 },
  emptySubtitle: {
    color: colors.textMuted,
    ...type.callout,
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 260,
  },
});
