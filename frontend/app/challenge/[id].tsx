import React, { useEffect, useRef, useState } from 'react';
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
import { colors, motion, space, radius, type, glow, elevation } from '../../lib/theme';
import { Challenge, NotionPage, NotionActivity, AiVerdict } from '../../lib/types';
import {
  getChallenge,
  acceptChallenge,
  declineChallenge,
  cancelChallenge,
  evaluateChallenge,
  setChallengeNotionPage,
  pollChallengeNotion,
  refreshChallengeProgress,
} from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useRealtime } from '../../lib/realtime';
import NotionPagePicker from '../../components/NotionPagePicker';
import ChallengeResultPopup from '../../components/ChallengeResultPopup';
import AnimatedMount from '../../components/anim/AnimatedMount';
import PressableScale from '../../components/anim/PressableScale';
import ScreenBackground from '../../components/ui/ScreenBackground';
import Gradient from '../../components/ui/Gradient';
import PrimaryButton from '../../components/ui/PrimaryButton';
import StatusPill, { PillTone } from '../../components/ui/StatusPill';

export default function ChallengeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [showPagePicker, setShowPagePicker] = useState(false);
  const [isPollingNotion, setIsPollingNotion] = useState(false);
  const [isRefreshingProgress, setIsRefreshingProgress] = useState(false);
  const [selectedAcceptPage, setSelectedAcceptPage] = useState<NotionPage | null>(null);
  const [showResultPopup, setShowResultPopup] = useState(false);
  const cancelledRef = useRef(false);
  const lastChallenge = useRealtime((s) => s.lastChallenge);

  // Real-time push: replace this challenge whenever the server sends an update
  // for THIS id (live verdict + opponent progress, no manual refresh).
  useEffect(() => {
    if (lastChallenge && id && lastChallenge.id === parseInt(id)) {
      setChallenge(lastChallenge);
    }
  }, [lastChallenge, id]);

  useEffect(() => {
    cancelledRef.current = false;
    if (user && id) {
      loadChallenge().then(refreshProgressInBackground);
    }
    return () => {
      cancelledRef.current = true;
    };
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

  const refreshProgressInBackground = async () => {
    if (!id) return;
    setIsRefreshingProgress(true);
    try {
      const { data } = await refreshChallengeProgress(parseInt(id));
      if (!cancelledRef.current) setChallenge(data);
    } catch {
      // Best-effort: the page already rendered with cached data, so swallow.
    } finally {
      if (!cancelledRef.current) setIsRefreshingProgress(false);
    }
  };

  const handleAccept = async () => {
    if (challenge?.category === 'studying' && !selectedAcceptPage) {
      Alert.alert('Select Study Page', 'Please select a Notion page to track for this challenge.');
      return;
    }
    setIsActionLoading(true);
    try {
      await acceptChallenge(parseInt(id!), {
        opponent_notion_page_id: challenge?.category === 'studying' ? selectedAcceptPage?.id : undefined,
      });
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

  const handleCancel = async () => {
    Alert.alert(
      'Cancel Challenge',
      'Are you sure you want to cancel this challenge? Your stake will be refunded.',
      [
        { text: 'Keep Challenge', style: 'cancel' },
        {
          text: 'Cancel Challenge',
          style: 'destructive',
          onPress: async () => {
            setIsActionLoading(true);
            try {
              await cancelChallenge(parseInt(id!));
              Alert.alert('Challenge Cancelled', 'Your stake has been refunded.');
              router.back();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to cancel challenge');
            } finally {
              setIsActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleSelectNotionPage = async (page: NotionPage) => {
    try {
      const response = await setChallengeNotionPage(parseInt(id!), page.id);
      setChallenge(response.data);
      Alert.alert('Success', `Study page "${page.title}" selected!`);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to set study page');
    }
  };

  const handlePollNotion = async () => {
    setIsPollingNotion(true);
    try {
      const response = await pollChallengeNotion(parseInt(id!));
      setChallenge(response.data);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to refresh activity');
    } finally {
      setIsPollingNotion(false);
    }
  };

  const handleEvaluate = async () => {
    const activityType = challenge?.category === 'studying' ? 'Notion study notes' : 'GitHub activity';
    Alert.alert(
      'Request AI Evaluation',
      `The AI referee will analyze both participants' ${activityType} and determine a winner. This will end the challenge. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Evaluate',
          onPress: async () => {
            setIsEvaluating(true);
            try {
              await evaluateChallenge(parseInt(id!));
              if (cancelledRef.current) return;
              router.replace('/(tabs)');
            } catch (error: any) {
              if (cancelledRef.current) return;
              const message =
                error.response?.data?.detail || error.message || 'Evaluation failed';
              Alert.alert('Error', message);
              loadChallenge();
            } finally {
              if (!cancelledRef.current) setIsEvaluating(false);
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

  const didUserWin = () => challenge?.winner_id === user?.id;

  // The backend stores ai_verdict as a JSON-serialized AiVerdict.
  const getPersonalizedVerdict = (): string => {
    const fallback = 'Challenge evaluated by AI referee.';
    if (!challenge?.ai_verdict) return fallback;

    const raw: any = challenge.ai_verdict;
    let parsed: Partial<AiVerdict> | null = null;
    if (typeof raw === 'object') {
      parsed = raw;
    } else if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw);
      } catch {
        return raw.trim() || fallback;
      }
    }

    if (!parsed) return fallback;
    const isCreator = challenge.creator.id === user?.id;
    return (isCreator ? parsed.creator_verdict : parsed.opponent_verdict) || fallback;
  };

  const renderNotionActivityRow = (
    username: string,
    isMe: boolean,
    activity: NotionActivity | null
  ) => (
    <View style={styles.notionActivityRow}>
      <Text style={styles.progressLabel}>
        @{username} {isMe ? '(You)' : ''}
      </Text>
      {activity ? (
        <View style={styles.notionStats}>
          <Text style={styles.notionStatValue}>{activity.page_count} pages</Text>
          <Text style={styles.notionStatDot}>•</Text>
          <Text style={styles.notionStatValue}>{activity.total_blocks} blocks</Text>
        </View>
      ) : (
        <Text style={styles.notionNoActivity}>No page selected</Text>
      )}
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.root}>
        <ScreenBackground />
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!challenge) return null;

  const isOpponent = challenge.opponent?.id === user?.id;
  const isCreator = challenge.creator?.id === user?.id;
  const isPending = challenge.status === 'pending';
  const isActive = challenge.status === 'active';
  const isCompleted = challenge.status === 'completed';
  const isStudying = challenge.category === 'studying';
  const canRespond = isOpponent && isPending;
  const canCancel = isCreator && isPending;
  const canEvaluate = isActive && challenge.challenge_prompt;

  const myNotionPageId = isCreator ? challenge.creator_notion_page_id : challenge.opponent_notion_page_id;
  const myNotionActivity = isCreator ? challenge.creator_notion_activity : challenge.opponent_notion_activity;
  const opponentNotionActivity = isCreator ? challenge.opponent_notion_activity : challenge.creator_notion_activity;

  const isTie = isCompleted && challenge.winner_id === null;
  const won = isCompleted && didUserWin();

  // Head-to-head progress (coding)
  const myCommits = isCreator ? challenge.creator_progress : challenge.opponent_progress;
  const theirCommits = isCreator ? challenge.opponent_progress : challenge.creator_progress;
  const maxCommits = Math.max(myCommits, theirCommits, 5);

  const statusTone: PillTone = isActive
    ? 'accent'
    : isCompleted
    ? (won ? 'accent' : isTie ? 'muted' : 'loss')
    : challenge.status === 'evaluating'
    ? 'pending'
    : isPending
    ? 'pending'
    : 'loss';

  return (
    <View style={styles.root}>
      <ScreenBackground />
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <PressableScale onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </PressableScale>
          <Text style={styles.headerTitle}>
            {isPending
              ? isCreator
                ? 'Pending Challenge'
                : 'Challenge Invitation'
              : isCompleted
              ? 'Result'
              : 'Active Battle'}
          </Text>
          <View style={styles.iconBtn} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: space.xxl }}
          showsVerticalScrollIndicator={false}
        >
          {/* Completed → celebratory result hero */}
          {isCompleted && challenge.ai_verdict ? (
            <AnimatedMount delay={0} translateY={16}>
              <Gradient
                colors={won ? ['#0d5a39', '#0e3826'] : isTie ? ['#173a2a', '#0e3826'] : ['#4a2230', '#0e3826']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                radius={radius.xl}
                style={[styles.resultHero, elevation(2), won && glow(colors.accent, 0.3)]}
              >
                <View
                  style={[
                    styles.trophyRing,
                    { borderColor: won ? colors.accent : isTie ? colors.textSecondary : colors.loss },
                  ]}
                >
                  <Ionicons
                    name={won ? 'trophy' : isTie ? 'swap-horizontal' : 'flag'}
                    size={36}
                    color={won ? colors.accent : isTie ? colors.textSecondary : colors.loss}
                  />
                </View>
                <Text style={styles.resultTitle}>
                  {won ? 'VICTORY' : isTie ? "IT'S A TIE" : 'DEFEATED'}
                </Text>
                <Text style={styles.resultSub}>
                  {won
                    ? 'The pot is yours.'
                    : isTie
                    ? 'Stakes returned to both rivals.'
                    : `@${getWinnerUsername()} took this one.`}
                </Text>
                <View style={styles.resultAmountWrap}>
                  <Text
                    style={[
                      styles.resultAmount,
                      { color: won ? colors.accent : isTie ? colors.text : colors.loss },
                    ]}
                  >
                    {won ? '+' : isTie ? '' : '-'}
                    {formatCurrency(won ? challenge.prize_pool_cents - challenge.stake_cents : challenge.stake_cents)}
                  </Text>
                </View>
              </Gradient>
            </AnimatedMount>
          ) : (
            /* Active / pending → challenger hero */
            <AnimatedMount delay={0} style={styles.challengerSection}>
              <View style={styles.categoryBadge}>
                <Ionicons name={isStudying ? 'book' : 'logo-github'} size={13} color={colors.accent} />
                <Text style={styles.categoryBadgeText}>
                  {isStudying ? 'Studying' : 'Coding'} · {challenge.status.toUpperCase()}
                </Text>
              </View>
              <View style={styles.avatarRing}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={40} color={colors.accent} />
                </View>
              </View>
              <Text style={styles.challengerName}>
                {isPending
                  ? `@${challenge.creator.username} challenged you`
                  : `vs @${isOpponent ? challenge.creator.username : challenge.opponent?.username || 'Open'}`}
              </Text>
            </AnimatedMount>
          )}

          {/* Challenge prompt */}
          {challenge.challenge_prompt && (
            <AnimatedMount delay={motion.stagger} style={styles.promptCard}>
              <View style={styles.promptHeader}>
                <Ionicons name="flag" size={13} color={colors.accent} />
                <Text style={styles.promptLabel}>THE CHALLENGE</Text>
              </View>
              <Text style={styles.promptText}>{challenge.challenge_prompt}</Text>
            </AnimatedMount>
          )}

          {/* Verdict explanation (completed) */}
          {isCompleted && challenge.ai_verdict && (
            <AnimatedMount delay={motion.stagger * 2} style={styles.verdictCard}>
              <View style={styles.verdictHeader}>
                <Ionicons name="shield-checkmark" size={18} color={colors.accent} />
                <Text style={styles.verdictTitle}>AI REFEREE VERDICT</Text>
              </View>
              <Text style={styles.verdictLabel}>
                {isTie ? 'Explanation' : won ? 'Why you won' : 'Why you lost'}
              </Text>
              <Text style={styles.verdictText}>{getPersonalizedVerdict()}</Text>
            </AnimatedMount>
          )}

          {/* Details */}
          <AnimatedMount delay={motion.stagger * 3} style={styles.summaryCard}>
            <Text style={styles.cardEyebrow}>CHALLENGE DETAILS</Text>
            <DetailRow icon="time-outline" label="Duration" value={formatDuration(challenge.duration_hours)} />
            <DetailRow icon="lock-closed-outline" label="Your stake" value={formatCurrency(challenge.stake_cents)} valueColor={colors.text} />
            <DetailRow
              icon="trophy-outline"
              label="Prize pool"
              value={formatCurrency(challenge.prize_pool_cents)}
              valueColor={colors.secondary}
              emphasize
            />
            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <Ionicons name="pulse-outline" size={16} color={colors.textMuted} />
                <Text style={styles.detailLabel}>Status</Text>
              </View>
              <StatusPill tone={statusTone} label={challenge.status.toUpperCase()} />
            </View>
            {challenge.ends_at && (
              <DetailRow
                icon="calendar-outline"
                label="Ends"
                value={new Date(challenge.ends_at).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                last
              />
            )}
          </AnimatedMount>

          {/* Notion page selection (active studying) */}
          {isStudying && isActive && (
            <View style={styles.card}>
              <Text style={styles.cardEyebrow}>YOUR STUDY PAGE</Text>
              {myNotionPageId ? (
                <View style={styles.notionPageSelected}>
                  <View style={styles.notionPageInfo}>
                    <Ionicons name="document-text" size={22} color={colors.accent} />
                    <Text style={styles.notionPageText}>Page connected</Text>
                  </View>
                  <PressableScale style={styles.refreshButton} onPress={handlePollNotion} disabled={isPollingNotion}>
                    {isPollingNotion ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                      <Ionicons name="refresh" size={20} color={colors.accent} />
                    )}
                  </PressableScale>
                </View>
              ) : (
                <PressableScale style={styles.dashedButton} onPress={() => setShowPagePicker(true)}>
                  <Ionicons name="add-circle" size={22} color={colors.accent} />
                  <Text style={styles.dashedButtonText}>Select Study Page</Text>
                </PressableScale>
              )}
            </View>
          )}

          {/* Notion activity (active studying) */}
          {isStudying && isActive && (myNotionActivity || opponentNotionActivity) && (
            <View style={styles.card}>
              <Text style={styles.cardEyebrow}>STUDY ACTIVITY</Text>
              {renderNotionActivityRow(
                challenge.creator.username,
                challenge.creator.id === user?.id,
                challenge.creator_notion_activity
              )}
              {challenge.opponent &&
                renderNotionActivityRow(
                  challenge.opponent.username,
                  challenge.opponent.id === user?.id,
                  challenge.opponent_notion_activity
                )}
            </View>
          )}

          {/* Progress (active coding) — head to head */}
          {!isStudying && isActive && (
            <View style={styles.card}>
              <View style={styles.progressHeaderRow}>
                <Text style={styles.cardEyebrow}>HEAD TO HEAD</Text>
                {isRefreshingProgress && (
                  <View style={styles.refreshingPill}>
                    <ActivityIndicator size="small" color={colors.accent} />
                    <Text style={styles.refreshingPillText}>Syncing…</Text>
                  </View>
                )}
              </View>
              <H2HBar
                label={`@${challenge.creator.username}${challenge.creator.id === user?.id ? ' (You)' : ''}`}
                value={isCreator ? myCommits : theirCommits}
                ratio={(isCreator ? myCommits : theirCommits) / maxCommits}
                color={isCreator ? colors.accent : colors.loss}
              />
              <H2HBar
                label={`@${challenge.opponent?.username}${challenge.opponent?.id === user?.id ? ' (You)' : ''}`}
                value={isCreator ? theirCommits : myCommits}
                ratio={(isCreator ? theirCommits : myCommits) / maxCommits}
                color={isCreator ? colors.loss : colors.accent}
              />
              <Text style={styles.progressUnit}>commits tracked so far</Text>
            </View>
          )}

          {/* AI referee info (not completed) */}
          {!isCompleted && (
            <View style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <View style={styles.infoIcon}>
                  <Ionicons name="shield-checkmark" size={18} color={colors.accent} />
                </View>
                <Text style={styles.infoTitle}>AI Referee</Text>
              </View>
              <Text style={styles.infoText}>
                {isStudying
                  ? "When the challenge ends, the AI referee analyzes both participants' Notion study notes and decides a winner based on quality, depth, and organization."
                  : "When the challenge ends, the AI referee analyzes both participants' GitHub activity and decides a winner based on the challenge criteria."}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Action footers */}
        {canRespond && (
          <View style={styles.footer}>
            {isStudying && (
              <View style={styles.acceptPageSection}>
                <Text style={styles.acceptPageLabel}>SELECT YOUR STUDY PAGE</Text>
                {selectedAcceptPage ? (
                  <View style={styles.selectedAcceptPage}>
                    <View style={styles.selectedAcceptPageInfo}>
                      <Ionicons name="document-text" size={20} color={colors.accent} />
                      <Text style={styles.selectedAcceptPageTitle} numberOfLines={1}>
                        {selectedAcceptPage.title || 'Untitled'}
                      </Text>
                    </View>
                    <Pressable onPress={() => setShowPagePicker(true)}>
                      <Text style={styles.changeText}>Change</Text>
                    </Pressable>
                  </View>
                ) : (
                  <PressableScale style={styles.dashedButton} onPress={() => setShowPagePicker(true)}>
                    <Ionicons name="add-circle" size={20} color={colors.accent} />
                    <Text style={styles.dashedButtonText}>Select Notion Page</Text>
                  </PressableScale>
                )}
              </View>
            )}
            <PrimaryButton
              label={isActionLoading ? 'PROCESSING…' : 'ACCEPT CHALLENGE'}
              onPress={handleAccept}
              loading={isActionLoading}
              disabled={isStudying && !selectedAcceptPage}
            />
            <PressableScale style={styles.secondaryBtn} onPress={handleDecline} disabled={isActionLoading}>
              <Text style={styles.secondaryText}>Decline</Text>
            </PressableScale>
          </View>
        )}

        {canCancel && (
          <View style={styles.footer}>
            <View style={styles.pendingInfo}>
              <Ionicons name="time-outline" size={16} color={colors.textMuted} />
              <Text style={styles.pendingInfoText}>
                Waiting for @{challenge.opponent?.username || 'opponent'} to respond
              </Text>
            </View>
            <PressableScale style={styles.dangerBtn} onPress={handleCancel} disabled={isActionLoading}>
              <Text style={styles.dangerText}>{isActionLoading ? 'CANCELLING…' : 'Cancel Challenge'}</Text>
            </PressableScale>
            <Text style={styles.footerHint}>Your stake will be refunded</Text>
          </View>
        )}

        {canEvaluate && (
          <View style={styles.footer}>
            <PrimaryButton
              label={isEvaluating ? 'STARTING…' : 'REQUEST AI EVALUATION'}
              icon="shield-checkmark"
              onPress={handleEvaluate}
              loading={isEvaluating}
            />
            <Text style={styles.footerHint}>This ends the challenge and determines a winner</Text>
          </View>
        )}
      </SafeAreaView>

      <NotionPagePicker
        visible={showPagePicker}
        onClose={() => setShowPagePicker(false)}
        onSelectPage={(page) => {
          if (isPending && isOpponent) {
            setSelectedAcceptPage(page);
          } else {
            handleSelectNotionPage(page);
          }
        }}
        selectedPageId={isPending && isOpponent ? selectedAcceptPage?.id : myNotionPageId}
      />

      <ChallengeResultPopup
        visible={showResultPopup}
        isWin={challenge?.winner_id === user?.id}
        amount={challenge?.stake_cents || 0}
        onDismiss={() => setShowResultPopup(false)}
      />
    </View>
  );
}

// ── Small presentational helpers ──────────────────────────────────────────────
function DetailRow({
  icon,
  label,
  value,
  valueColor = colors.text,
  emphasize = false,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  valueColor?: string;
  emphasize?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.detailRow, !last && styles.detailRowBorder]}>
      <View style={styles.detailLeft}>
        <Ionicons name={icon} size={16} color={colors.textMuted} />
        <Text style={styles.detailLabel}>{label}</Text>
      </View>
      <Text style={[styles.detailValue, { color: valueColor }, emphasize && styles.detailValueBig]}>
        {value}
      </Text>
    </View>
  );
}

function H2HBar({ label, value, ratio, color }: { label: string; value: number; ratio: number; color: string }) {
  return (
    <View style={styles.h2hRow}>
      <View style={styles.h2hTop}>
        <Text style={styles.h2hLabel} numberOfLines={1}>{label}</Text>
        <Text style={[styles.h2hValue, { color }]}>{value}</Text>
      </View>
      <View style={styles.h2hTrack}>
        <View style={[styles.h2hFill, { width: `${Math.max(4, Math.min(100, ratio * 100))}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  headerTitle: { color: colors.text, ...type.h3, fontSize: 16 },
  content: { flex: 1, paddingHorizontal: space.xl },

  // Challenger hero
  challengerSection: { alignItems: 'center', marginTop: space.sm, marginBottom: space.xl },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: space.lg,
  },
  categoryBadgeText: { color: colors.accent, ...type.overline, fontSize: 10 },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    padding: 5,
    ...glow(colors.accent, 0.2),
  },
  avatar: {
    flex: 1,
    borderRadius: 42,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengerName: { color: colors.text, ...type.h2, marginTop: space.md, textAlign: 'center' },

  // Result hero
  resultHero: {
    alignItems: 'center',
    padding: space.xxl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginTop: space.sm,
    marginBottom: space.lg,
  },
  trophyRing: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: space.lg,
  },
  resultSub: { color: colors.textSecondary, ...type.callout, marginTop: 4, textAlign: 'center' },
  resultAmountWrap: { marginTop: space.lg },
  resultAmount: { fontSize: 34, fontWeight: '900', fontVariant: ['tabular-nums'] },

  // Prompt
  promptCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: space.lg,
    marginBottom: space.lg,
  },
  promptHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  promptLabel: { color: colors.accent, ...type.overline },
  promptText: { color: colors.text, ...type.body, fontSize: 17, lineHeight: 25 },

  // Verdict
  verdictCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    marginBottom: space.lg,
  },
  verdictHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: space.md },
  verdictTitle: { color: colors.accent, ...type.overline },
  verdictLabel: { color: colors.textSecondary, ...type.label, marginBottom: 6 },
  verdictText: { color: colors.text, ...type.body, lineHeight: 23 },

  // Generic card
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    marginBottom: space.lg,
  },
  cardEyebrow: { color: colors.textSecondary, ...type.overline, marginBottom: space.md },

  // Summary / detail rows
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    marginBottom: space.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
  },
  detailRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
  detailLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailLabel: { color: colors.textSecondary, ...type.callout },
  detailValue: { ...type.callout, fontWeight: '700', fontVariant: ['tabular-nums'] },
  detailValueBig: { fontSize: 18, fontWeight: '800' },

  // Notion
  notionPageSelected: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  notionPageInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notionPageText: { color: colors.text, ...type.callout },
  refreshButton: { padding: 8 },
  notionActivityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  progressLabel: { color: colors.textSecondary, ...type.callout },
  notionStats: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notionStatValue: { color: colors.accent, ...type.callout, fontWeight: '700' },
  notionStatDot: { color: colors.textMuted, fontSize: 10 },
  notionNoActivity: { color: colors.textMuted, ...type.callout, fontStyle: 'italic' },

  // Progress / H2H
  progressHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  refreshingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: space.md,
  },
  refreshingPillText: { color: colors.accent, ...type.caption, fontWeight: '600' },
  h2hRow: { marginBottom: space.md },
  h2hTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  h2hLabel: { color: colors.textSecondary, ...type.callout, flex: 1, marginRight: 8 },
  h2hValue: { ...type.bodyStrong, fontWeight: '800', fontVariant: ['tabular-nums'] },
  h2hTrack: { height: 8, backgroundColor: colors.surfaceMuted, borderRadius: 4, overflow: 'hidden' },
  h2hFill: { height: '100%', borderRadius: 4 },
  progressUnit: { color: colors.textMuted, ...type.caption, textAlign: 'center', marginTop: 2 },

  // Info
  infoCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: space.lg,
    marginBottom: space.lg,
  },
  infoHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTitle: { color: colors.text, ...type.bodyStrong, fontSize: 15 },
  infoText: { color: colors.textSecondary, ...type.callout, lineHeight: 21 },

  // Footers
  footer: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.md, gap: space.md },
  secondaryBtn: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 15,
    alignItems: 'center',
  },
  secondaryText: { color: colors.textSecondary, ...type.bodyStrong },
  dangerBtn: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.lossSoft,
    backgroundColor: colors.lossSoft,
    paddingVertical: 15,
    alignItems: 'center',
  },
  dangerText: { color: colors.loss, ...type.bodyStrong },
  pendingInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pendingInfoText: { color: colors.textMuted, ...type.callout },
  footerHint: { color: colors.textMuted, ...type.caption, textAlign: 'center' },

  // Accept page selection
  acceptPageSection: { gap: 8 },
  acceptPageLabel: { color: colors.textSecondary, ...type.overline },
  selectedAcceptPage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: 12,
  },
  selectedAcceptPageInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  selectedAcceptPageTitle: { color: colors.text, ...type.callout, flex: 1 },
  changeText: { color: colors.accent, ...type.callout, fontWeight: '700' },
  dashedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    padding: 14,
    gap: 8,
  },
  dashedButtonText: { color: colors.accent, ...type.callout, fontWeight: '700' },
});
