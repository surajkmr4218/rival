import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, motion, space, radius, type } from '../../lib/theme';
import { Challenge } from '../../lib/types';
import { getPendingChallenges } from '../../lib/api';
import ChallengeCard from '../../components/ChallengeCard';
import AnimatedMount from '../../components/anim/AnimatedMount';
import PressableScale from '../../components/anim/PressableScale';
import { SkeletonCard } from '../../components/anim/Skeleton';
import ScreenBackground from '../../components/ui/ScreenBackground';
import { useAuth } from '../../lib/auth';

export default function PendingChallengesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadChallenges = useCallback(async () => {
    if (!user) return; // Don't fetch if not authenticated

    try {
      const response = await getPendingChallenges();
      setChallenges(response.data.challenges);
    } catch (error) {
      console.error('Failed to load pending challenges:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadChallenges();
  }, [loadChallenges]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadChallenges();
  };

  const handleChallengePress = (challenge: Challenge) => {
    router.push(`/challenge/${challenge.id}`);
  };

  const Header = () => (
    <View style={styles.header}>
      <PressableScale onPress={() => router.back()} style={styles.iconBtn}>
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </PressableScale>
      <View style={styles.headerContent}>
        <Text style={styles.headerTitle}>Incoming</Text>
        {challenges.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{challenges.length}</Text>
          </View>
        )}
      </View>
      <View style={styles.iconBtn} />
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.root}>
        <ScreenBackground />
        <SafeAreaView style={styles.container} edges={['top']}>
          <Header />
          <View style={styles.listContent}>
            {[0, 1, 2].map((i) => (
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
        <Header />
        <FlatList
          data={challenges}
          keyExtractor={(item) => item.id.toString()}
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
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons name="mail-open-outline" size={32} color={colors.accent} />
              </View>
              <Text style={styles.emptyTitle}>You're all caught up</Text>
              <Text style={styles.emptySubtitle}>
                When a rival challenges you, it'll show up right here.
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { color: colors.text, ...type.h3, fontSize: 17 },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    backgroundColor: colors.pending,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#3a2600', ...type.caption, fontWeight: '800' },
  listContent: { padding: space.xl, flexGrow: 1 },
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
