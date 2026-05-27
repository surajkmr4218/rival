import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { colors, motion } from '../../lib/theme';
import { Challenge } from '../../lib/types';
import { getChallenges } from '../../lib/api';
import ChallengeCard from '../../components/ChallengeCard';
import AnimatedMount from '../../components/anim/AnimatedMount';
import { SkeletonCard } from '../../components/anim/Skeleton';
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
      // Filter to only show completed challenges
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

  // Refresh data whenever screen comes into focus
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

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.listContent}>
          {[0, 1, 2, 3].map((i) => (
            <AnimatedMount key={i} delay={i * motion.stagger}>
              <SkeletonCard />
            </AnimatedMount>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="time-outline" size={64} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No completed challenges</Text>
            <Text style={styles.emptySubtitle}>
              Your past challenges will appear here
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 20,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});
