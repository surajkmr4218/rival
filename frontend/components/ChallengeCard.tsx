import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, glow, motion, radius, space, type, elevation } from '../lib/theme';
import { Challenge } from '../lib/types';
import PressableScale from './anim/PressableScale';
import StatusPill, { PillTone } from './ui/StatusPill';
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
  const isStudying = challenge.category === 'studying';
  const getCategoryIcon = (): keyof typeof Ionicons.glyphMap =>
    isStudying ? 'book' : 'logo-github';

  const getChallengeDescription = () => {
    if (challenge.challenge_prompt) {
      const prompt = challenge.challenge_prompt;
      return prompt.length > 64 ? `${prompt.substring(0, 64)}…` : prompt;
    }
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

  const isActive = challenge.status === 'active';
  const isEvaluating = challenge.status === 'evaluating';
  const isCompleted = challenge.status === 'completed';
  const didWin = challenge.winner_id === currentUserId;
  const isTie = isCompleted && challenge.winner_id === null;

  // Status pill mapping
  const pill: { tone: PillTone; label: string; icon?: keyof typeof Ionicons.glyphMap } = (() => {
    switch (challenge.status) {
      case 'active':
        return { tone: 'accent', label: 'LIVE', icon: 'flash' };
      case 'evaluating':
        return { tone: 'pending', label: 'JUDGING' };
      case 'pending':
        return { tone: 'pending', label: 'PENDING' };
      case 'completed':
        if (isTie) return { tone: 'muted', label: 'TIE' };
        return didWin
          ? { tone: 'accent', label: 'WON', icon: 'trophy' }
          : { tone: 'loss', label: 'LOST' };
      case 'declined':
        return { tone: 'loss', label: 'DECLINED' };
      case 'cancelled':
        return { tone: 'loss', label: 'CANCELLED' };
      default:
        return { tone: 'muted', label: 'UNKNOWN' };
    }
  })();

  const maxProgress = Math.max(myProgress, theirProgress, 10);
  const featured = isActive;

  return (
    <PressableScale
      style={[
        styles.container,
        elevation(1),
        featured && styles.featured,
        featured && glow(colors.accent, 0.16),
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${pill.label} challenge: ${getChallengeDescription()}`}
    >
      {featured && <View style={styles.edge} />}

      <View style={styles.header}>
        <View style={styles.categoryChip}>
          <Ionicons name={getCategoryIcon()} size={13} color={colors.accent} />
          <Text style={styles.categoryText}>{isStudying ? 'Studying' : 'Coding'}</Text>
        </View>
        <StatusPill tone={pill.tone} label={pill.label} icon={pill.icon} dot={isActive} />
      </View>

      <Text style={styles.goal} numberOfLines={2}>
        {getChallengeDescription()}
      </Text>
      <View style={styles.metaRow}>
        <Ionicons name="time-outline" size={13} color={colors.textMuted} />
        <Text style={styles.period}>{getDuration()}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.footer}>
        <View style={styles.userSection}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={15} color={colors.accent} />
          </View>
          <View>
            <Text style={styles.vsLabel}>OPPONENT</Text>
            <Text style={styles.username}>@{opponent?.username || 'Open'}</Text>
          </View>
        </View>
        <View style={styles.stakeSection}>
          <Text style={styles.stakeLabel}>PRIZE POOL</Text>
          <Text style={styles.stakeAmount}>{formatCurrency(challenge.prize_pool_cents)}</Text>
        </View>
      </View>

      {isActive && (
        <View style={styles.progressSection}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>You</Text>
            <View style={styles.progressBarContainer}>
              <ProgressFill ratio={myProgress / maxProgress} color={colors.accent} />
            </View>
            <Text style={[styles.progressValue, { color: colors.accent }]}>{myProgress}</Text>
          </View>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Them</Text>
            <View style={styles.progressBarContainer}>
              <ProgressFill ratio={theirProgress / maxProgress} color={colors.loss} />
            </View>
            <Text style={[styles.progressValue, { color: colors.loss }]}>{theirProgress}</Text>
          </View>
        </View>
      )}

      {isCompleted && challenge.ai_verdict && (
        <View style={[styles.verdictIndicator, didWin && styles.verdictWin, !didWin && !isTie && styles.verdictLoss]}>
          <Ionicons name="shield-checkmark" size={13} color={didWin ? colors.accent : isTie ? colors.textSecondary : colors.loss} />
          <Text style={[styles.verdictText, { color: didWin ? colors.accent : isTie ? colors.textSecondary : colors.loss }]}>
            AI Referee decided
          </Text>
        </View>
      )}

      {isEvaluating && (
        <View style={[styles.verdictIndicator, styles.verdictJudging]}>
          <ActivityIndicator size="small" color={colors.pending} />
          <Text style={[styles.verdictText, { color: colors.pending }]}>AI Referee evaluating…</Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    marginBottom: space.md,
    overflow: 'hidden',
  },
  featured: {
    backgroundColor: colors.surfaceHigh,
    borderColor: colors.borderStrong,
  },
  edge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.accent,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.md,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  categoryText: { color: colors.textSecondary, ...type.caption, fontWeight: '600' },
  goal: { color: colors.text, ...type.h3, lineHeight: 24 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  period: { color: colors.textMuted, ...type.caption },
  divider: {
    height: 1,
    backgroundColor: colors.hairline,
    marginVertical: space.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userSection: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsLabel: { color: colors.textMuted, ...type.overline, fontSize: 9 },
  username: { color: colors.text, ...type.callout, fontWeight: '600' },
  stakeSection: { alignItems: 'flex-end' },
  stakeLabel: { color: colors.secondary, ...type.overline, fontSize: 9 },
  stakeAmount: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
  progressSection: {
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    gap: 8,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center' },
  progressLabel: { color: colors.textSecondary, ...type.caption, width: 38 },
  progressBarContainer: {
    flex: 1,
    height: 7,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 4,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  progressBar: { height: '100%', borderRadius: 4 },
  progressValue: {
    ...type.caption,
    fontWeight: '700',
    width: 28,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  verdictIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.md,
    paddingVertical: 9,
    borderRadius: radius.sm,
    gap: 6,
  },
  verdictWin: { backgroundColor: colors.accentSoft },
  verdictLoss: { backgroundColor: colors.lossSoft },
  verdictJudging: { backgroundColor: colors.pendingSoft },
  verdictText: { ...type.caption, fontWeight: '600' },
});
