import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../lib/theme';
import { Challenge } from '../../lib/types';
import { getActiveChallenges, getPendingChallenges, getChallenges } from '../../lib/api';
import ChallengeCard from '../../components/ChallengeCard';
import { useAuth } from '../../lib/auth';

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeChallenges, setActiveChallenges] = useState<Challenge[]>([]);
  const [outgoingPending, setOutgoingPending] = useState<Challenge[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return; // Don't fetch if not authenticated

    try {
      const [activeRes, pendingRes, allRes] = await Promise.all([
        getActiveChallenges(),
        getPendingChallenges(),
        getChallenges(),
      ]);
      setActiveChallenges(activeRes.data.challenges);
      setPendingCount(pendingRes.data.challenges.length);

      // Get outgoing pending challenges (challenges I created that are awaiting acceptance)
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

  // Refresh data whenever screen comes into focus (e.g., after creating/accepting challenge)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleChallengePress = (challenge: Challenge) => {
    router.push(`/challenge/${challenge.id}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
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
          {/* Outgoing Pending Challenges */}
          {outgoingPending.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <View style={[styles.dot, styles.dotPending]} />
                <Text style={styles.sectionTitle}>SENT CHALLENGES</Text>
                <Text style={styles.sectionSubtitle}>(awaiting acceptance)</Text>
              </View>
              {outgoingPending.map((challenge) => (
                <ChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  currentUserId={user?.id || 0}
                  onPress={() => handleChallengePress(challenge)}
                />
              ))}
              <View style={styles.sectionSpacer} />
            </>
          )}

          {/* Active Challenges */}
          <View style={styles.sectionHeader}>
            <View style={styles.dot} />
            <Text style={styles.sectionTitle}>ACTIVE CHALLENGES</Text>
          </View>

          {activeChallenges.length === 0 ? (
            <Text style={styles.empty}>No active challenges</Text>
          ) : (
            activeChallenges.map((challenge) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                currentUserId={user?.id || 0}
                onPress={() => handleChallengePress(challenge)}
              />
            ))
          )}
        </View>
      </ScrollView>

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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
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
  dotPending: {
    backgroundColor: '#f59e0b', // Amber/orange for pending
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginLeft: 6,
  },
  sectionSpacer: {
    height: 24,
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
