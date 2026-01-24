import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '../../src/theme';
import { Challenge } from '../../src/api/types';
import { getChallenge, acceptChallenge, declineChallenge } from '../../src/api/client';
import { useAuth } from '../../src/store/auth';

export default function ChallengeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    if (user && id) {
      loadChallenge();
    }
  }, [id, user]);

  const loadChallenge = async () => {
    try {
      const response = await getChallenge(parseInt(id!));
      setChallenge(response.data);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load challenge');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async () => {
    setIsActionLoading(true);
    try {
      await acceptChallenge(parseInt(id!));
      Alert.alert('Challenge Accepted!', 'The challenge is now active. Good luck!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to accept challenge';
      Alert.alert('Error', message);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDecline = async () => {
    Alert.alert('Decline Challenge', 'Are you sure you want to decline this challenge?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          setIsActionLoading(true);
          try {
            await declineChallenge(parseInt(id!));
            router.back();
          } catch (error: any) {
            Alert.alert('Error', 'Failed to decline challenge');
          } finally {
            setIsActionLoading(false);
          }
        },
      },
    ]);
  };

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const getGoalDescription = () => {
    if (!challenge) return '';
    if (challenge.category === 'coding') {
      return `Code for ${challenge.goal_value}+ commits`;
    }
    return `Screen Time < ${challenge.goal_value / 60} hours`;
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

  if (!challenge) {
    return null;
  }

  const isOpponent = challenge.opponent?.id === user?.id;
  const isPending = challenge.status === 'pending';
  const canRespond = isOpponent && isPending;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {isPending ? 'Challenge Invitation' : 'Challenge Details'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Challenger Info */}
        <View style={styles.challengerSection}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={48} color={colors.accent} />
          </View>
          <Text style={styles.challengerName}>
            {isPending ? `@${challenge.creator.username} challenged you!` : 'Challenge'}
          </Text>
          <Text style={styles.challengerSubtitle}>Productivity Duel</Text>
        </View>

        {/* Challenge Image Placeholder */}
        <View style={styles.imageContainer}>
          <View style={styles.imagePlaceholder}>
            <Ionicons
              name={challenge.category === 'coding' ? 'logo-github' : 'phone-portrait-outline'}
              size={64}
              color={colors.accent}
            />
          </View>
        </View>

        {/* Challenge Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>CHALLENGE SUMMARY</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Goal</Text>
            <Text style={styles.summaryValue}>{getGoalDescription()}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Period</Text>
            <Text style={styles.summaryValue}>{challenge.goal_period}</Text>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.stakeDot} />
            <Text style={styles.summaryLabel}>Stake</Text>
            <Text style={[styles.summaryValue, styles.stakeValue]}>
              {formatCurrency(challenge.stake_cents)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Prize Pool</Text>
            <Text style={[styles.summaryValue, styles.prizeValue]}>
              {formatCurrency(challenge.prize_pool_cents)}
            </Text>
          </View>
        </View>

        {/* AI Referee Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="shield-checkmark" size={20} color={colors.accent} />
            <Text style={styles.infoTitle}>AI Referee Rules</Text>
          </View>
          <Text style={styles.infoText}>
            An AI referee will monitor your progress using {challenge.category === 'coding' ? 'GitHub' : 'Screen Time'} data
            and determine the winner at the end of the challenge period.
          </Text>
        </View>

        {/* Status Info for non-pending challenges */}
        {!isPending && (
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>STATUS</Text>
            <Text style={[styles.statusValue, { color: getStatusColor(challenge.status) }]}>
              {challenge.status.toUpperCase()}
            </Text>
            {challenge.status === 'active' && challenge.ends_at && (
              <Text style={styles.endsAt}>
                Ends: {new Date(challenge.ends_at).toLocaleDateString()}
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      {canRespond && (
        <View style={styles.footer}>
          <Pressable
            style={styles.acceptButton}
            onPress={handleAccept}
            disabled={isActionLoading}
          >
            <Text style={styles.acceptText}>
              {isActionLoading ? 'PROCESSING...' : 'ACCEPT CHALLENGE'}
            </Text>
          </Pressable>
          <Pressable
            style={styles.declineButton}
            onPress={handleDecline}
            disabled={isActionLoading}
          >
            <Text style={styles.declineText}>DECLINE</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return colors.accent;
    case 'completed':
      return '#3b82f6';
    case 'declined':
    case 'cancelled':
      return colors.error;
    default:
      return colors.textMuted;
  }
};

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  challengerSection: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 24,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  challengerName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  challengerSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  imagePlaceholder: {
    width: '100%',
    height: 160,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
  },
  summaryTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 14,
    flex: 1,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  stakeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginRight: 8,
  },
  stakeValue: {
    color: colors.accent,
  },
  prizeValue: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '700',
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  infoText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  statusCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  statusLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  statusValue: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  endsAt: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 8,
  },
  footer: {
    padding: 20,
    paddingBottom: 8,
    gap: 12,
  },
  acceptButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  acceptText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  declineButton: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    alignItems: 'center',
  },
  declineText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '600',
  },
});
