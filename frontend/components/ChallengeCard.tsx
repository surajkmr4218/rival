import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, glow, motion } from '../lib/theme';
import { Challenge } from '../lib/types';
import PressableScale from './anim/PressableScale';
import { useReducedMotion } from './anim/useReducedMotion';

interface ChallengeCardProps {
  challenge: Challenge;
  currentUserId: number;
  onPress: () => void;
}

// Animated progress fill that grows from 0 to its target ratio on mount.
function ProgressFill({ ratio, color }: { ratio: number; color: string }) {
  const reduced = useReducedMotion();
  const w = useRef(new Animated.Value(0)).current;
  const target = Math.max(0, Math.min(1, ratio));

  useEffect(() => {
    if (reduced) {
      w.setValue(target);
      return;
    }
    const anim = Animated.timing(w, {
      toValue: target,
      duration: motion.slow,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [target, reduced]);

  const width = w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return <Animated.View style={[styles.progressBar, { width, backgroundColor: color }]} />;
}

export default function ChallengeCard({ challenge, currentUserId, onPress }: ChallengeCardProps) {
  const isCreator = challenge.creator.id === currentUserId;
  const opponent = isCreator ? challenge.opponent : challenge.creator;
  const myProgress = isCreator ? challenge.creator_progress : challenge.opponent_progress;
  const theirProgress = isCreator ? challenge.opponent_progress : challenge.creator_progress;

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const getCategoryIcon = (): keyof typeof Ionicons.glyphMap => {
    if (challenge.category === 'coding') return 'logo-github';
    if (challenge.category === 'studying') return 'book';
    return 'phone-portrait-outline';
  };

  const getChallengeDescription = () => {
    // Use challenge_prompt if available (new AI referee system)
    if (challenge.challenge_prompt) {
      // Truncate long prompts for card display
      const prompt = challenge.challenge_prompt;
      return prompt.length > 50 ? `${prompt.substring(0, 50)}...` : prompt;
    }
    // Fallback to legacy goal display
    if (challenge.goal_type === 'commits_min' && challenge.goal_value) {
      return `${challenge.goal_value}+ commits`;
    }
    if (challenge.goal_type === 'screentime_max' && challenge.goal_value) {
      return `< ${challenge.goal_value / 60}hrs screen time`;
    }
    return 'Challenge';
  };

  const getDuration = () => {
    if (challenge.duration_hours) {
      if (challenge.duration_hours >= 24) {
        const days = Math.floor(challenge.duration_hours / 24);
        return `${days} day${days > 1 ? 's' : ''}`;
      }
      return `${challenge.duration_hours}h`;
    }
    return challenge.goal_period || '';
  };

  const isEvaluating = challenge.status === 'evaluating';

  const getStatusColor = () => {
    switch (challenge.status) {
      case 'active':
        return colors.accent;
      case 'evaluating':
        return '#f59e0b'; // amber — matches detail-screen color
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
      if (challenge.winner_id === null) return 'TIE';
      return challenge.winner_id === currentUserId ? 'WON' : 'LOST';
    }
    return challenge.status.toUpperCase();
  };

  // Calculate progress percentage (use a reasonable default if no goal_value)
  const maxProgress = Math.max(myProgress, theirProgress, 10);

  return (
    <PressableScale
      style={[styles.container, challenge.status === 'active' && glow(colors.accent, 0.22)]}
      onPress={onPress}
    >
      <View style={styles.header}>
        <View style={styles.categoryBadge}>
          <Ionicons name={getCategoryIcon()} size={16} color={colors.accent} />
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.statusText}>{getStatusLabel()}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.goal} numberOfLines={2}>{getChallengeDescription()}</Text>
        <Text style={styles.period}>{getDuration()}</Text>
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
              <ProgressFill ratio={myProgress / maxProgress} color={colors.accent} />
            </View>
            <Text style={styles.progressValue}>{myProgress}</Text>
          </View>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Them</Text>
            <View style={styles.progressBarContainer}>
              <ProgressFill ratio={theirProgress / maxProgress} color={colors.error} />
            </View>
            <Text style={styles.progressValue}>{theirProgress}</Text>
          </View>
        </View>
      )}

      {/* Show AI verdict indicator for completed challenges */}
      {challenge.status === 'completed' && challenge.ai_verdict && (
        <View style={styles.verdictIndicator}>
          <Ionicons name="shield-checkmark" size={14} color={colors.accent} />
          <Text style={styles.verdictText}>AI Referee decided</Text>
        </View>
      )}

      {/* In-flight indicator while the AI referee evaluates */}
      {isEvaluating && (
        <View style={styles.verdictIndicator}>
          <ActivityIndicator size="small" color="#f59e0b" />
          <Text style={[styles.verdictText, { color: '#f59e0b' }]}>
            AI Referee evaluating…
          </Text>
        </View>
      )}
    </PressableScale>
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
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  period: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
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
  verdictIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 6,
  },
  verdictText: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
