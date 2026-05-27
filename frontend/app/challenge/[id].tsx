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
import { colors } from '../../lib/theme';
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
import NotionPagePicker from '../../components/NotionPagePicker';
import ChallengeResultPopup from '../../components/ChallengeResultPopup';
import AnimatedMount from '../../components/anim/AnimatedMount';
import PressableScale from '../../components/anim/PressableScale';
import { motion, glow } from '../../lib/theme';

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
  // Tracks the background GitHub/Notion refresh that runs after the page
  // renders — drives the "Refreshing progress…" indicator on the progress card.
  const [isRefreshingProgress, setIsRefreshingProgress] = useState(false);
  // For accepting studying challenges - opponent must select their page
  const [selectedAcceptPage, setSelectedAcceptPage] = useState<NotionPage | null>(null);
  const [showResultPopup, setShowResultPopup] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    if (user && id) {
      // Render the page from cached DB state first (fast — no third-party
      // fetches), then kick off a background refresh that will update the
      // progress bar when GitHub/Notion respond.
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
    // Only worth refreshing for active challenges — pending/completed/etc.
    // have no live progress to update.
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
    // For studying challenges, require page selection
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
            // Fire-and-forget: kick off the background job on the server, then
            // navigate home. The dashboard shows the challenge as EVALUATING
            // until the AI finishes (no client-side polling — avoids client
            // timeouts when Gemini + GitHub/Notion fetches run long).
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

  const didUserWin = () => {
    return challenge?.winner_id === user?.id;
  };

  const getOpponentUsername = () => {
    if (!challenge) return '';
    if (challenge.creator.id === user?.id) {
      return challenge.opponent?.username || 'Opponent';
    }
    return challenge.creator.username;
  };

  // The backend stores ai_verdict as a JSON-serialized AiVerdict.
  // Return the personalized verdict for the current user, or a fallback.
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
  const isCreator = challenge.creator?.id === user?.id;
  const isPending = challenge.status === 'pending';
  const isActive = challenge.status === 'active';
  const isCompleted = challenge.status === 'completed';
  const isStudying = challenge.category === 'studying';
  const canRespond = isOpponent && isPending;
  const canCancel = isCreator && isPending;
  const canEvaluate = isActive && challenge.challenge_prompt;

  // Get user's Notion page and activity
  const myNotionPageId = isCreator ? challenge.creator_notion_page_id : challenge.opponent_notion_page_id;
  const opponentNotionPageId = isCreator ? challenge.opponent_notion_page_id : challenge.creator_notion_page_id;
  const myNotionActivity = isCreator ? challenge.creator_notion_activity : challenge.opponent_notion_activity;
  const opponentNotionActivity = isCreator ? challenge.opponent_notion_activity : challenge.creator_notion_activity;
  const needsNotionPage = isStudying && isActive && !myNotionPageId;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {isPending
            ? isCreator
              ? 'Pending Challenge'
              : 'Challenge Invitation'
            : isCompleted
            ? 'Challenge Complete'
            : 'Active Challenge'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Category Badge */}
        <View style={styles.categoryBadge}>
          <Ionicons
            name={isStudying ? 'book' : 'logo-github'}
            size={14}
            color={colors.accent}
          />
          <Text style={styles.categoryBadgeText}>
            {isStudying ? 'Studying Challenge' : 'Coding Challenge'}
          </Text>
        </View>

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
          <AnimatedMount delay={0} style={styles.promptCard}>
            <Text style={styles.promptLabel}>CHALLENGE</Text>
            <Text style={styles.promptText}>{challenge.challenge_prompt}</Text>
          </AnimatedMount>
        )}

        {/* AI Verdict (for completed challenges) */}
        {isCompleted && challenge.ai_verdict && (
          <AnimatedMount delay={motion.stagger} translateY={20} style={[styles.verdictCard, glow(colors.accent, 0.25)]}>
            <View style={styles.verdictHeader}>
              <Ionicons name="shield-checkmark" size={24} color={colors.accent} />
              <Text style={styles.verdictTitle}>AI REFEREE VERDICT</Text>
            </View>
            {challenge.winner_id ? (
              didUserWin() ? (
                <View style={styles.winnerBadge}>
                  <Ionicons name="trophy" size={20} color={colors.background} />
                  <Text style={styles.winnerText}>You won!</Text>
                </View>
              ) : (
                <View style={[styles.winnerBadge, styles.lossBadge]}>
                  <Ionicons name="trophy" size={20} color={colors.text} />
                  <Text style={[styles.winnerText, styles.lossText]}>@{getWinnerUsername()} won</Text>
                </View>
              )
            ) : (
              <View style={[styles.winnerBadge, styles.tieBadge]}>
                <Ionicons name="swap-horizontal" size={20} color={colors.text} />
                <Text style={[styles.winnerText, styles.tieText]}>It's a tie!</Text>
              </View>
            )}
            <View style={styles.verdictExplanation}>
              <Text style={styles.verdictLabel}>
                {!challenge.winner_id
                  ? 'Explanation:'
                  : didUserWin()
                  ? 'Why you won:'
                  : 'Why you lost:'}
              </Text>
              <Text style={styles.verdictText}>{getPersonalizedVerdict()}</Text>
            </View>
          </AnimatedMount>
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

        {/* Notion Page Selection (for studying challenges) */}
        {isStudying && isActive && (
          <View style={styles.notionSection}>
            <Text style={styles.sectionTitle}>YOUR STUDY PAGE</Text>
            {myNotionPageId ? (
              <View style={styles.notionPageSelected}>
                <View style={styles.notionPageInfo}>
                  <Ionicons name="document-text" size={24} color={colors.accent} />
                  <Text style={styles.notionPageText}>Page connected</Text>
                </View>
                <Pressable
                  style={styles.refreshButton}
                  onPress={handlePollNotion}
                  disabled={isPollingNotion}
                >
                  {isPollingNotion ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <Ionicons name="refresh" size={20} color={colors.accent} />
                  )}
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={styles.selectPageButton}
                onPress={() => setShowPagePicker(true)}
              >
                <Ionicons name="add-circle" size={24} color={colors.accent} />
                <Text style={styles.selectPageText}>Select Study Page</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Notion Activity (for studying challenges) */}
        {isStudying && isActive && (myNotionActivity || opponentNotionActivity) && (
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>STUDY ACTIVITY</Text>
            {renderNotionActivityRow(
              challenge.creator.username,
              challenge.creator.id === user?.id,
              challenge.creator_notion_activity
            )}
            {challenge.opponent && renderNotionActivityRow(
              challenge.opponent.username,
              challenge.opponent.id === user?.id,
              challenge.opponent_notion_activity
            )}
          </View>
        )}

        {/* Progress (for coding challenges) */}
        {!isStudying && isActive && (
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>CURRENT PROGRESS</Text>
              {isRefreshingProgress && (
                <View style={styles.refreshingPill}>
                  <ActivityIndicator size="small" color={colors.accent} />
                  <Text style={styles.refreshingPillText}>Refreshing…</Text>
                </View>
              )}
            </View>
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
              {isStudying
                ? 'When the challenge ends, the AI referee will analyze both participants\' Notion study notes and determine a winner based on quality, depth, and organization.'
                : 'When the challenge ends, the AI referee will analyze both participants\' GitHub activity and determine a winner based on the challenge criteria.'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      {canRespond && (
        <View style={styles.footer}>
          {/* Page selection for studying challenges */}
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
                <Pressable
                  style={styles.selectAcceptPageButton}
                  onPress={() => setShowPagePicker(true)}
                >
                  <Ionicons name="add-circle" size={20} color={colors.accent} />
                  <Text style={styles.selectAcceptPageText}>Select Notion Page</Text>
                </Pressable>
              )}
            </View>
          )}

          <PressableScale
            style={[
              styles.acceptButton,
              isStudying && !selectedAcceptPage ? styles.acceptButtonDisabled : glow(colors.accent, 0.4),
            ]}
            onPress={handleAccept}
            disabled={isActionLoading || (isStudying && !selectedAcceptPage)}
          >
            <Text
              style={[
                styles.acceptText,
                isStudying && !selectedAcceptPage && styles.acceptTextDisabled,
              ]}
            >
              {isActionLoading ? 'PROCESSING...' : 'ACCEPT CHALLENGE'}
            </Text>
          </PressableScale>
          <PressableScale
            style={styles.declineButton}
            onPress={handleDecline}
            disabled={isActionLoading}
          >
            <Text style={styles.declineText}>DECLINE</Text>
          </PressableScale>
        </View>
      )}

      {canCancel && (
        <View style={styles.footer}>
          <View style={styles.pendingInfo}>
            <Ionicons name="time-outline" size={20} color={colors.textMuted} />
            <Text style={styles.pendingInfoText}>
              Waiting for @{challenge.opponent?.username || 'opponent'} to respond
            </Text>
          </View>
          <PressableScale
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={isActionLoading}
          >
            <Text style={styles.cancelText}>
              {isActionLoading ? 'CANCELLING...' : 'CANCEL CHALLENGE'}
            </Text>
          </PressableScale>
          <Text style={styles.cancelHint}>
            Your stake will be refunded
          </Text>
        </View>
      )}

      {canEvaluate && (
        <View style={styles.footer}>
          <PressableScale
            style={[styles.evaluateButton, glow(colors.accent, 0.45)]}
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
          </PressableScale>
          <Text style={styles.evaluateHint}>
            This will end the challenge and determine a winner
          </Text>
        </View>
      )}

      {/* Notion Page Picker Modal */}
      <NotionPagePicker
        visible={showPagePicker}
        onClose={() => setShowPagePicker(false)}
        onSelectPage={(page) => {
          // For pending challenges (accepting), just set local state
          if (isPending && isOpponent) {
            setSelectedAcceptPage(page);
          } else {
            // For active challenges, call the API
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
    </SafeAreaView>
  );
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return colors.accent;
    case 'evaluating':
      return '#f59e0b';
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
  },
  verdictExplanation: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  verdictLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
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
  lossBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  winnerText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
  tieText: {
    color: colors.text,
  },
  lossText: {
    color: '#ef4444',
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
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  refreshingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12,
  },
  refreshingPillText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '600',
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
  // Cancel button styles (for creators)
  pendingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  pendingInfoText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  cancelButton: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.error,
    padding: 16,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.error,
    fontSize: 16,
    fontWeight: '600',
  },
  cancelHint: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  // Notion-specific styles
  notionSection: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
  },
  notionPageSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notionPageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notionPageText: {
    color: colors.text,
    fontSize: 14,
  },
  refreshButton: {
    padding: 8,
  },
  selectPageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accent,
    borderStyle: 'dashed',
    padding: 16,
    gap: 8,
  },
  selectPageText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  notionActivityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  notionStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notionStatValue: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  notionStatDot: {
    color: colors.textMuted,
    fontSize: 10,
  },
  notionNoActivity: {
    color: colors.textMuted,
    fontSize: 14,
    fontStyle: 'italic',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 16,
    gap: 6,
  },
  categoryBadgeText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  // Accept page selection styles
  acceptPageSection: {
    marginBottom: 12,
  },
  acceptPageLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  selectedAcceptPage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: 12,
  },
  selectedAcceptPageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  selectedAcceptPageTitle: {
    color: colors.text,
    fontSize: 14,
    flex: 1,
  },
  changeText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  selectAcceptPageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accent,
    borderStyle: 'dashed',
    padding: 12,
    gap: 8,
  },
  selectAcceptPageText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  acceptButtonDisabled: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  acceptTextDisabled: {
    color: colors.textMuted,
  },
});
