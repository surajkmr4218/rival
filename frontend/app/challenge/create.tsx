import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, motion, space, radius, type } from '../../lib/theme';
import { UserPublic, ChallengeCategory, NotionPage } from '../../lib/types';
import { createChallenge } from '../../lib/api';
import StakeSlider from '../../components/StakeSlider';
import UserSearchInput from '../../components/UserSearchInput';
import NotionPagePicker from '../../components/NotionPagePicker';
import AnimatedMount from '../../components/anim/AnimatedMount';
import PressableScale from '../../components/anim/PressableScale';
import ScreenBackground from '../../components/ui/ScreenBackground';
import PrimaryButton from '../../components/ui/PrimaryButton';

const EXAMPLE_PROMPTS: Record<'coding' | 'studying', string[]> = {
  coding: [
    'Make 5 meaningful commits with descriptive messages',
    'Open 2 pull requests to any repository',
    'Write more lines of code than your opponent',
    'Make the most contributions to open source',
  ],
  studying: [
    'Study for 2 hours with detailed notes',
    'Create comprehensive notes on 3 topics',
    'Write a summary of what you learned',
    'Document your learning with examples',
  ],
};

const DURATION_PRESETS = [
  { label: '6h', value: 6 },
  { label: '12h', value: 12 },
  { label: '24h', value: 24 },
  { label: '48h', value: 48 },
  { label: '1 week', value: 168 },
];

export default function CreateChallengeScreen() {
  const router = useRouter();
  const [category, setCategory] = useState<ChallengeCategory>('coding');
  const [challengePrompt, setChallengePrompt] = useState('');
  const [stakeAmount, setStakeAmount] = useState(1000);
  const [selectedUser, setSelectedUser] = useState<UserPublic | null>(null);
  const [durationHours, setDurationHours] = useState(24);
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [customHours, setCustomHours] = useState('');
  const [customMinutes, setCustomMinutes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNotionPage, setSelectedNotionPage] = useState<NotionPage | null>(null);
  const [showNotionPicker, setShowNotionPicker] = useState(false);

  const handleCategoryChange = (newCategory: ChallengeCategory) => {
    setCategory(newCategory);
    setChallengePrompt('');
    setSelectedNotionPage(null);
  };

  const handleSelectUser = (user: UserPublic | null) => setSelectedUser(user);

  const handleDurationPreset = (hours: number) => {
    setDurationHours(hours);
    setIsCustomDuration(false);
    setCustomHours('');
    setCustomMinutes('');
  };

  const handleCustomDuration = () => setIsCustomDuration(true);

  const getEffectiveDuration = (): number => {
    if (isCustomDuration) {
      const hours = parseInt(customHours) || 0;
      const minutes = parseInt(customMinutes) || 0;
      return hours + minutes / 60;
    }
    return durationHours;
  };

  const handleSubmit = async () => {
    if (!challengePrompt.trim() || challengePrompt.trim().length < 10) {
      Alert.alert('Invalid Challenge', 'Please describe your challenge (at least 10 characters).');
      return;
    }
    if (!selectedUser) {
      Alert.alert('Missing Opponent', 'Please select an opponent.');
      return;
    }
    const effectiveDuration = getEffectiveDuration();
    if (effectiveDuration < 0.5) {
      Alert.alert('Invalid Duration', 'Challenge must be at least 30 minutes.');
      return;
    }
    if (category === 'studying' && !selectedNotionPage) {
      Alert.alert('Missing Study Page', 'Please select a Notion page to track for this challenge.');
      return;
    }

    setIsLoading(true);
    try {
      await createChallenge({
        category,
        stake_cents: stakeAmount,
        opponent_username: selectedUser?.username,
        challenge_prompt: challengePrompt.trim(),
        duration_hours: Math.round(getEffectiveDuration() * 100) / 100,
        creator_notion_page_id: category === 'studying' ? selectedNotionPage?.id : undefined,
      });

      Alert.alert(
        'Challenge Created!',
        selectedUser
          ? `Challenge sent to @${selectedUser.username}!`
          : 'Your challenge is waiting for a match!',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
      );
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to create challenge';
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  const effectiveDuration = getEffectiveDuration();
  const canSubmit =
    challengePrompt.trim().length >= 10 &&
    selectedUser !== null &&
    effectiveDuration >= 0.5 &&
    (category !== 'studying' || selectedNotionPage !== null);
  const currentExamples = EXAMPLE_PROMPTS[category];

  // Step numbering shifts when the studying-only page step is present.
  const stepNum = (coding: number, studying: number) =>
    `STEP ${String(category === 'studying' ? studying : coding).padStart(2, '0')}`;

  const StepHeader = ({ num, title }: { num: string; title: string }) => (
    <View style={styles.stepHeader}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepBadgeText}>{num.replace('STEP ', '')}</Text>
      </View>
      <Text style={styles.stepTitle}>{title}</Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <ScreenBackground />
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={styles.header}>
            <PressableScale onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="close" size={22} color={colors.text} />
            </PressableScale>
            <Text style={styles.headerTitle}>NEW BATTLE</Text>
            <View style={styles.iconBtn} />
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: space.xxl }}
          >
            {/* Category segmented control */}
            <AnimatedMount delay={0} style={styles.segment}>
              {(['coding', 'studying'] as ChallengeCategory[]).map((c) => {
                const active = category === c;
                return (
                  <PressableScale
                    key={c}
                    style={[styles.segmentItem, active && styles.segmentItemActive]}
                    onPress={() => handleCategoryChange(c)}
                  >
                    <Ionicons
                      name={c === 'coding' ? 'logo-github' : 'book'}
                      size={16}
                      color={active ? '#04231a' : colors.textSecondary}
                    />
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                      {c === 'coding' ? 'Coding' : 'Studying'}
                    </Text>
                  </PressableScale>
                );
              })}
            </AnimatedMount>

            {/* Step 1: Prompt */}
            <View style={styles.section}>
              <StepHeader num={stepNum(1, 1)} title="Describe the challenge" />
              <View style={styles.promptContainer}>
                <TextInput
                  style={styles.promptInput}
                  placeholder={
                    category === 'coding'
                      ? "What's the coding challenge? Be specific…"
                      : "What's the study goal? Be specific…"
                  }
                  placeholderTextColor={colors.textMuted}
                  value={challengePrompt}
                  onChangeText={setChallengePrompt}
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                />
                <Text style={styles.charCount}>{challengePrompt.length}/500</Text>
              </View>

              {currentExamples.length > 0 && (
                <>
                  <Text style={styles.examplesLabel}>Quick ideas</Text>
                  <View style={styles.examplesContainer}>
                    {currentExamples.map((prompt, index) => (
                      <Pressable
                        key={index}
                        style={styles.examplePill}
                        onPress={() => setChallengePrompt(prompt)}
                      >
                        <Text style={styles.exampleText}>{prompt}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </View>

            {/* Step 2 (studying): Notion page */}
            {category === 'studying' && (
              <View style={styles.section}>
                <StepHeader num={stepNum(0, 2)} title="Select your study page" />
                {selectedNotionPage ? (
                  <View style={styles.selectedPageContainer}>
                    <View style={styles.selectedPageInfo}>
                      <Ionicons name="document-text" size={22} color={colors.accent} />
                      <Text style={styles.selectedPageTitle} numberOfLines={1}>
                        {selectedNotionPage.title || 'Untitled'}
                      </Text>
                    </View>
                    <Pressable style={styles.changePageButton} onPress={() => setShowNotionPicker(true)}>
                      <Text style={styles.changePageText}>Change</Text>
                    </Pressable>
                  </View>
                ) : (
                  <PressableScale style={styles.dashedButton} onPress={() => setShowNotionPicker(true)}>
                    <Ionicons name="add-circle" size={22} color={colors.accent} />
                    <Text style={styles.dashedButtonText}>Select Notion Page</Text>
                  </PressableScale>
                )}
                <Text style={styles.pageHint}>
                  This page and all sub-pages will be tracked for the challenge.
                </Text>
              </View>
            )}

            {/* Duration */}
            <View style={styles.section}>
              <StepHeader num={stepNum(2, 3)} title="Set the duration" />
              <View style={styles.durationContainer}>
                {DURATION_PRESETS.map((option) => {
                  const active = durationHours === option.value && !isCustomDuration;
                  return (
                    <Pressable
                      key={option.value}
                      style={[styles.durationPill, active && styles.durationPillSelected]}
                      onPress={() => handleDurationPreset(option.value)}
                    >
                      <Text style={[styles.durationText, active && styles.durationTextSelected]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  style={[styles.durationPill, isCustomDuration && styles.durationPillSelected]}
                  onPress={handleCustomDuration}
                >
                  <Text style={[styles.durationText, isCustomDuration && styles.durationTextSelected]}>
                    Custom
                  </Text>
                </Pressable>
              </View>

              {isCustomDuration && (
                <View style={styles.customDurationContainer}>
                  <View style={styles.customDurationInput}>
                    <TextInput
                      style={styles.durationInput}
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={customHours}
                      onChangeText={setCustomHours}
                      maxLength={3}
                    />
                    <Text style={styles.durationUnit}>hrs</Text>
                  </View>
                  <View style={styles.customDurationInput}>
                    <TextInput
                      style={styles.durationInput}
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={customMinutes}
                      onChangeText={setCustomMinutes}
                      maxLength={2}
                    />
                    <Text style={styles.durationUnit}>min</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Stakes */}
            <View style={styles.section}>
              <StepHeader num={stepNum(3, 4)} title="Set the stakes" />
              <StakeSlider value={stakeAmount} onChange={setStakeAmount} />
            </View>

            {/* Rival */}
            <View style={styles.section}>
              <StepHeader num={stepNum(4, 5)} title="Choose your rival" />
              <UserSearchInput selectedUser={selectedUser} onSelectUser={handleSelectUser} />
            </View>

            {/* AI referee info */}
            <View style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <View style={styles.infoIcon}>
                  <Ionicons name="shield-checkmark" size={18} color={colors.accent} />
                </View>
                <Text style={styles.infoTitle}>AI Referee</Text>
              </View>
              <Text style={styles.infoText}>
                {category === 'coding'
                  ? "Our AI referee evaluates both participants' GitHub activity against your criteria — analyzing commits, PRs, and code quality to crown a fair winner."
                  : "Our AI referee evaluates both participants' Notion notes — analyzing depth, organization, and quality to decide who studied more effectively."}
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <PrimaryButton
              label={isLoading ? 'CREATING…' : 'LOCK IT IN'}
              icon="flash"
              onPress={handleSubmit}
              loading={isLoading}
              disabled={!canSubmit}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <NotionPagePicker
        visible={showNotionPicker}
        onClose={() => setShowNotionPicker(false)}
        onSelectPage={(page) => setSelectedNotionPage(page)}
        selectedPageId={selectedNotionPage?.id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  keyboardView: { flex: 1 },
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
  headerTitle: { color: colors.text, ...type.h3, fontSize: 16, letterSpacing: 1 },
  content: { flex: 1, paddingHorizontal: space.xl },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    marginTop: space.md,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    borderRadius: radius.sm,
  },
  segmentItemActive: { backgroundColor: colors.accent },
  segmentText: { color: colors.textSecondary, ...type.label, fontWeight: '700' },
  segmentTextActive: { color: '#04231a' },
  section: { marginTop: space.xxl },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: space.md },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: { color: colors.accent, ...type.caption, fontWeight: '800', fontSize: 11 },
  stepTitle: { color: colors.text, ...type.h3, fontSize: 17 },
  promptContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
  },
  promptInput: {
    color: colors.text,
    fontSize: 16,
    minHeight: 84,
    textAlignVertical: 'top',
    lineHeight: 23,
  },
  charCount: { color: colors.textMuted, ...type.caption, textAlign: 'right', marginTop: 4 },
  examplesLabel: { color: colors.textSecondary, ...type.label, marginTop: space.lg, marginBottom: space.sm },
  examplesContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  examplePill: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  exampleText: { color: colors.textSecondary, ...type.caption },
  durationContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  durationPill: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  durationPillSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  durationText: { color: colors.text, ...type.callout, fontWeight: '600' },
  durationTextSelected: { color: '#04231a' },
  customDurationContainer: { flexDirection: 'row', gap: 12, marginTop: 12 },
  customDurationInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 16,
  },
  durationInput: {
    flex: 1,
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    paddingVertical: 12,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  durationUnit: { color: colors.textMuted, ...type.callout, fontWeight: '700' },
  infoCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: space.lg,
    marginTop: space.xxl,
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
  footer: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.sm },
  // Notion page selection
  selectedPageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: 14,
  },
  selectedPageInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  selectedPageTitle: { color: colors.text, ...type.bodyStrong, fontSize: 15, flex: 1 },
  changePageButton: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  changePageText: { color: colors.accent, ...type.callout, fontWeight: '700' },
  dashedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    padding: 16,
    gap: 8,
  },
  dashedButtonText: { color: colors.accent, ...type.bodyStrong, fontSize: 15 },
  pageHint: { color: colors.textMuted, ...type.caption, marginTop: 8 },
});
