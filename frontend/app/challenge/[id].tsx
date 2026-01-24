import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '../../lib/theme';
import { Challenge } from '../../lib/types';
import {
  getChallenge,
  acceptChallenge,
  declineChallenge,
  evaluateChallenge,
} from '../../lib/api';
import { useAuth } from '../../lib/auth';

export default function ChallengeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);

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
        { text: 'OK', onPress: () => loadChallenge() },
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

  const handleEvaluate = async () => {
    Alert.alert(
      'Request AI Evaluation',
      'The AI referee will analyze both participants\' GitHub activity and determine a winner. This will end the challenge. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Evaluate',
          onPress: async () => {
            setIsEvaluating(true);
            try {
              const response = await evaluateChallenge(parseInt(id!));
              setChallenge(response.data);
              Alert.alert('Evaluation Complete', 'The AI referee has made a decision!');
            } catch (error: any) {
              const message = error.response?.data?.detail || 'Evaluation failed';
              Alert.alert('Error', message);
            } finally {
              setIsEvaluating(false);
            }
          },
        },
      ]
    );
  };

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const formatDuration = (hours: number) => {
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''}`;
    }
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  };

  const getWinnerUsername = () => {
    if (!challenge || !challenge.winner_id) return null;
    if (challenge.winner_id === challenge.creator.id) {
      return challenge.creator.username;
    }
    return challenge.opponent?.username;
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
  const isActive = challenge.status === 'active';
  const isCompleted = challenge.status === 'completed';
  const canRespond = isOpponent && isPending;
  const canEvaluate = isActive && challenge.challenge_prompt;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {isPending ? 'Challenge Invitation' : isCompleted ? 'Challenge Complete' : 'Active Challenge'}
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
            {isPending
              ? `@${challenge.creator.username} challenged you!`
              : `vs @${isOpponent ? challenge.creator.username : challenge.opponent?.username || 'Open'}`}
          </Text>
        </View>

        {/* Challenge Prompt */}
        {challenge.challenge_prompt && (
          <View style={styles.promptCard}>
            <Text style={styles.promptLabel}>CHALLENGE</Text>
            <Text style={styles.promptText}>{challenge.challenge_prompt}</Text>
          </View>
        )}

        {/* AI Verdict (for completed challenges) */}
        {isCompleted && challenge.ai_verdict && (
          <View style={styles.verdictCard}>
            <View style={styles.verdictHeader}>
              <Ionicons name="shield-checkmark" size={24} color={colors.accent} />
              <Text style={styles.verdictTitle}>AI REFEREE VERDICT</Text>
            </View>
            <Text style={styles.verdictText}>{challenge.ai_verdict}</Text>
            {challenge.winner_id ? (
              <View style={styles.winnerBadge}>
                <Ionicons name="trophy" size={20} color={colors.background} />
                <Text style={styles.winnerText}>Winner: @{getWinnerUsername()}</Text>
              </View>
            ) : (
              <View style={[styles.winnerBadge, styles.tieBadge]}>
                <Ionicons name="swap-horizontal" size={20} color={colors.text} />
                <Text style={[styles.winnerText, styles.tieText]}>It's a tie!</Text>
              </View>
            )}
          </View>
        )}

        {/* Challenge Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>CHALLENGE DETAILS</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Duration</Text>
            <Text style={styles.summaryValue}>{formatDuration(challenge.duration_hours)}</Text>
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

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Status</Text>
            <Text style={[styles.summaryValue, { color: getStatusColor(challenge.status) }]}>
              {challenge.status.toUpperCase()}
            </Text>
          </View>

          {challenge.ends_at && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Ends</Text>
              <Text style={styles.summaryValue}>
                {new Date(challenge.ends_at).toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        {/* Progress (for active challenges) */}
        {isActive && (
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>CURRENT PROGRESS</Text>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>
                @{challenge.creator.username} {challenge.creator.id === user?.id ? '(You)' : ''}
              </Text>
              <Text style={styles.progressValue}>{challenge.creator_progress} commits</Text>
            </View>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>
                @{challenge.opponent?.username} {challenge.opponent?.id === user?.id ? '(You)' : ''}
              </Text>
              <Text style={styles.progressValue}>{challenge.opponent_progress} commits</Text>
            </View>
          </View>
        )}

        {/* AI Referee Info */}
        {!isCompleted && (
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Ionicons name="shield-checkmark" size={20} color={colors.accent} />
              <Text style={styles.infoTitle}>AI Referee</Text>
            </View>
            <Text style={styles.infoText}>
              When the challenge ends, the AI referee will analyze both participants' GitHub
              activity and determine a winner based on the challenge criteria.
            </Text>
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

      {canEvaluate && (
        <View style={styles.footer}>
          <Pressable
            style={styles.evaluateButton}
            onPress={handleEvaluate}
            disabled={isEvaluating}
          >
            {isEvaluating ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <>
                <Ionicons name="shield-checkmark" size={20} color={colors.background} />
                <Text style={styles.evaluateText}>REQUEST AI EVALUATION</Text>
              </>
            )}
          </Pressable>
          <Text style={styles.evaluateHint}>
            This will end the challenge and determine a winner
          </Text>
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
    marginTop: 24,
    marginBottom: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  challengerName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  promptCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: 16,
    marginBottom: 16,
  },
  promptLabel: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  promptText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  verdictCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: 16,
    marginBottom: 16,
  },
  verdictHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  verdictTitle: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  verdictText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  winnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  tieBadge: {
    backgroundColor: colors.border,
  },
  winnerText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
  tieText: {
    color: colors.text,
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
  progressCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
  },
  progressTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    color: colors.textMuted,
    fontSize: 14,
  },
  progressValue: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 24,
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
  evaluateButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  evaluateText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  evaluateHint: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
});
