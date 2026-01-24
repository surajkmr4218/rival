import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '../_theme';
import { Challenge } from '../_api/types';
import { getActiveChallenges, getPendingChallenges } from '../_api/client';
import ChallengeCard from '../_components/ChallengeCard';
import { useAuth } from '../_store/auth';

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeChallenges, setActiveChallenges] = useState<Challenge[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return; // Don't fetch if not authenticated

    try {
      const [activeRes, pendingRes] = await Promise.all([
        getActiveChallenges(),
        getPendingChallenges(),
      ]);
      setActiveChallenges(activeRes.data.challenges);
      setPendingCount(pendingRes.data.challenges.length);
    } catch (error) {
      console.error('Failed to load challenges:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleChallengePress = (challenge: Challenge) => {
    router.push(`/challenge/${challenge.id}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="trophy" size={32} color={colors.accent} />
        <Text style={styles.logo}>RIVAL</Text>
      </View>

      {/* Pending Challenges Banner */}
      {pendingCount > 0 && (
        <Pressable style={styles.pendingBanner} onPress={() => router.push('/challenge/pending')}>
          <View style={styles.pendingContent}>
            <Ionicons name="mail" size={20} color={colors.accent} />
            <Text style={styles.pendingText}>
              {pendingCount} pending challenge{pendingCount > 1 ? 's' : ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.accent} />
        </Pressable>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.dot} />
          <Text style={styles.sectionTitle}>ACTIVE CHALLENGES</Text>
        </View>

        {activeChallenges.length === 0 ? (
          <Text style={styles.empty}>No active challenges</Text>
        ) : (
          <FlatList
            data={activeChallenges}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <ChallengeCard
                challenge={item}
                currentUserId={user?.id || 0}
                onPress={() => handleChallengePress(item)}
              />
            )}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                tintColor={colors.accent}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.button} onPress={() => router.push('/challenge/create')}>
          <Text style={styles.buttonText}>START NEW CHALLENGE</Text>
        </Pressable>
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
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    marginHorizontal: 24,
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  pendingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
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
