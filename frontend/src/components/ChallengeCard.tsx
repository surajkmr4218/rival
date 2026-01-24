import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { Challenge } from '../api/types';

interface ChallengeCardProps {
  challenge: Challenge;
  currentUserId: number;
  onPress: () => void;
}

export default function ChallengeCard({ challenge, currentUserId, onPress }: ChallengeCardProps) {
  const isCreator = challenge.creator.id === currentUserId;
  const opponent = isCreator ? challenge.opponent : challenge.creator;
  const myProgress = isCreator ? challenge.creator_progress : challenge.opponent_progress;
  const theirProgress = isCreator ? challenge.opponent_progress : challenge.creator_progress;

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const getCategoryIcon = (): keyof typeof Ionicons.glyphMap => {
    return challenge.category === 'coding' ? 'logo-github' : 'phone-portrait-outline';
  };

  const getGoalDescription = () => {
    if (challenge.category === 'coding') {
      return `${challenge.goal_value}+ commits`;
    }
    return `< ${challenge.goal_value / 60}hrs screen time`;
  };

  const getStatusColor = () => {
    switch (challenge.status) {
      case 'active':
        return colors.accent;
      case 'completed':
        return challenge.winner_id === currentUserId ? colors.accent : colors.error;
      case 'pending':
        return '#fbbf24';
      case 'declined':
      case 'cancelled':
        return colors.error;
      default:
        return colors.textMuted;
    }
  };

  const getStatusLabel = () => {
    if (challenge.status === 'completed') {
      return challenge.winner_id === currentUserId ? 'WON' : 'LOST';
    }
    return challenge.status.toUpperCase();
  };

  return (
    <Pressable style={styles.container} onPress={onPress}>
      <View style={styles.header}>
        <View style={styles.categoryBadge}>
          <Ionicons name={getCategoryIcon()} size={16} color={colors.accent} />
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.statusText}>{getStatusLabel()}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.goal}>{getGoalDescription()}</Text>
        <Text style={styles.period}>{challenge.goal_period}</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.userSection}>
          <Ionicons name="person-circle" size={24} color={colors.accent} />
          <Text style={styles.username}>vs @{opponent?.username || 'Open'}</Text>
        </View>
        <View style={styles.stakeSection}>
          <Text style={styles.stakeLabel}>PRIZE</Text>
          <Text style={styles.stakeAmount}>{formatCurrency(challenge.prize_pool_cents)}</Text>
        </View>
      </View>

      {challenge.status === 'active' && (
        <View style={styles.progressSection}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>You</Text>
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  { width: `${Math.min(100, (myProgress / challenge.goal_value) * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.progressValue}>{myProgress}</Text>
          </View>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Them</Text>
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  styles.progressBarOpponent,
                  { width: `${Math.min(100, (theirProgress / challenge.goal_value) * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.progressValue}>{theirProgress}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 6,
  },
  statusBadge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    color: colors.background,
    fontSize: 10,
    fontWeight: '700',
  },
  body: {
    marginBottom: 12,
  },
  goal: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  period: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  username: {
    color: colors.text,
    fontSize: 14,
  },
  stakeSection: {
    alignItems: 'flex-end',
  },
  stakeLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  stakeAmount: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '700',
  },
  progressSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    color: colors.textMuted,
    fontSize: 12,
    width: 40,
  },
  progressBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: colors.background,
    borderRadius: 3,
    marginHorizontal: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  progressBarOpponent: {
    backgroundColor: colors.error,
  },
  progressValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    width: 30,
    textAlign: 'right',
  },
});
