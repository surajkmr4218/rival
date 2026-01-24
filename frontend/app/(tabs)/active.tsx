import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '../../src/theme';
import { Challenge } from '../../src/api/types';
import { getChallenges } from '../../src/api/client';
import ChallengeCard from '../../src/components/ChallengeCard';
import { useAuth } from '../../src/store/auth';

export default function ActiveScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadChallenges = useCallback(async () => {
    if (!user) return; // Don't fetch if not authenticated

    try {
      const response = await getChallenges();
      setChallenges(response.data.challenges);
    } catch (error) {
      console.error('Failed to load challenges:', error);
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

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>All Challenges</Text>
      </View>

      <FlatList
        data={challenges}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <ChallengeCard
            challenge={item}
            currentUserId={user?.id || 0}
            onPress={() => handleChallengePress(item)}
          />
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
            <Ionicons name="flame-outline" size={64} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No challenges yet</Text>
            <Text style={styles.emptySubtitle}>
              Start a new challenge from the dashboard!
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
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
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
