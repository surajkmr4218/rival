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
import { colors } from '../../lib/theme';
import { UserPublic, ChallengeCategory, NotionPage } from '../../lib/types';
import { createChallenge } from '../../lib/api';
import StakeSlider from '../../components/StakeSlider';
import UserSearchInput from '../../components/UserSearchInput';
import NotionPagePicker from '../../components/NotionPagePicker';

// Example prompts by category
const EXAMPLE_PROMPTS: Record<ChallengeCategory, string[]> = {
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
  screentime: [], // Not used yet
};

// Duration options in hours
const DURATION_OPTIONS = [
  { label: '6 hours', value: 6 },
  { label: '12 hours', value: 12 },
  { label: '24 hours', value: 24 },
  { label: '48 hours', value: 48 },
  { label: '1 week', value: 168 },
];

export default function CreateChallengeScreen() {
  const router = useRouter();
  const [category, setCategory] = useState<ChallengeCategory>('coding');
  const [challengePrompt, setChallengePrompt] = useState('');
  const [stakeAmount, setStakeAmount] = useState(1000); // $10 default
  const [selectedUser, setSelectedUser] = useState<UserPublic | null>(null);
  const [isRandomMatch, setIsRandomMatch] = useState(false);
  const [durationHours, setDurationHours] = useState(24);
  const [isLoading, setIsLoading] = useState(false);
  // Notion page selection for studying challenges
  const [selectedNotionPage, setSelectedNotionPage] = useState<NotionPage | null>(null);
  const [showNotionPicker, setShowNotionPicker] = useState(false);

  const handleCategoryChange = (newCategory: ChallengeCategory) => {
    setCategory(newCategory);
    setChallengePrompt(''); // Clear prompt when switching categories
    setSelectedNotionPage(null); // Clear notion page when switching
  };

  const handleRandomMatch = () => {
    setSelectedUser(null);
    setIsRandomMatch(true);
  };

  const handleSelectUser = (user: UserPublic | null) => {
    setSelectedUser(user);
    setIsRandomMatch(false);
  };

  const handleSubmit = async () => {
    if (!challengePrompt.trim() || challengePrompt.trim().length < 10) {
      Alert.alert('Invalid Challenge', 'Please describe your challenge (at least 10 characters).');
      return;
    }

    if (!selectedUser && !isRandomMatch) {
      Alert.alert('Missing Opponent', 'Please select an opponent or choose random match.');
      return;
    }

    // Require Notion page for studying challenges
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
        duration_hours: durationHours,
        creator_notion_page_id: category === 'studying' ? selectedNotionPage?.id : undefined,
      });

      Alert.alert(
        'Challenge Created!',
        selectedUser
          ? `Challenge sent to @${selectedUser.username}!`
          : 'Your challenge is waiting for a match!',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Failed to create challenge';
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  // For studying challenges, also require a Notion page selection
  const canSubmit =
    challengePrompt.trim().length >= 10 &&
    (selectedUser || isRandomMatch) &&
    (category !== 'studying' || selectedNotionPage !== null);
  const currentExamples = EXAMPLE_PROMPTS[category] || [];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header with Category Toggle */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>NEW CHALLENGE</Text>
          <View style={styles.categoryToggle}>
            <Pressable
              style={[styles.categoryPill, category === 'coding' && styles.categoryPillActive]}
              onPress={() => handleCategoryChange('coding')}
            >
              <Ionicons
                name="logo-github"
                size={14}
                color={category === 'coding' ? colors.background : colors.text}
              />
            </Pressable>
            <Pressable
              style={[styles.categoryPill, category === 'studying' && styles.categoryPillActive]}
              onPress={() => handleCategoryChange('studying')}
            >
              <Ionicons
                name="book"
                size={14}
                color={category === 'studying' ? colors.background : colors.text}
              />
            </Pressable>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Category Label */}
          <View style={styles.categoryLabel}>
            <Ionicons
              name={category === 'coding' ? 'logo-github' : 'book'}
              size={16}
              color={colors.accent}
            />
            <Text style={styles.categoryText}>
              {category === 'coding' ? 'GitHub Coding Challenge' : 'Notion Study Challenge'}
            </Text>
          </View>

          {/* Step 1: Challenge Prompt */}
          <View style={styles.section}>
            <View style={styles.stepLabel}>
              <Text style={styles.stepNumber}>STEP 01</Text>
              <Text style={styles.stepTitle}>DESCRIBE YOUR CHALLENGE</Text>
            </View>

            <View style={styles.promptContainer}>
              <TextInput
                style={styles.promptInput}
                placeholder={
                  category === 'coding'
                    ? "What's the coding challenge? Be specific..."
                    : "What's the study goal? Be specific..."
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
                <Text style={styles.examplesLabel}>Examples:</Text>
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

          {/* Step 2: Select Study Page (studying only) */}
          {category === 'studying' && (
            <View style={styles.section}>
              <View style={styles.stepLabel}>
                <Text style={styles.stepNumber}>STEP 02</Text>
                <Text style={styles.stepTitle}>SELECT YOUR STUDY PAGE</Text>
              </View>

              {selectedNotionPage ? (
                <View style={styles.selectedPageContainer}>
                  <View style={styles.selectedPageInfo}>
                    <Ionicons name="document-text" size={24} color={colors.accent} />
                    <Text style={styles.selectedPageTitle} numberOfLines={1}>
                      {selectedNotionPage.title || 'Untitled'}
                    </Text>
                  </View>
                  <Pressable
                    style={styles.changePageButton}
                    onPress={() => setShowNotionPicker(true)}
                  >
                    <Text style={styles.changePageText}>Change</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={styles.selectPageButton}
                  onPress={() => setShowNotionPicker(true)}
                >
                  <Ionicons name="add-circle" size={24} color={colors.accent} />
                  <Text style={styles.selectPageText}>Select Notion Page</Text>
                </Pressable>
              )}

              <Text style={styles.pageHint}>
                This page and all its sub-pages will be tracked for the challenge.
              </Text>
            </View>
          )}

          {/* Step 3: Duration (Step 2 for coding) */}
          <View style={styles.section}>
            <View style={styles.stepLabel}>
              <Text style={styles.stepNumber}>{category === 'studying' ? 'STEP 03' : 'STEP 02'}</Text>
              <Text style={styles.stepTitle}>SET DURATION</Text>
            </View>

            <View style={styles.durationContainer}>
              {DURATION_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.durationPill,
                    durationHours === option.value && styles.durationPillSelected,
                  ]}
                  onPress={() => setDurationHours(option.value)}
                >
                  <Text
                    style={[
                      styles.durationText,
                      durationHours === option.value && styles.durationTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Step 4: Stakes (Step 3 for coding) */}
          <View style={styles.section}>
            <View style={styles.stepLabel}>
              <Text style={styles.stepNumber}>{category === 'studying' ? 'STEP 04' : 'STEP 03'}</Text>
              <Text style={styles.stepTitle}>SET THE STAKES</Text>
            </View>
            <StakeSlider value={stakeAmount} onChange={setStakeAmount} />
          </View>

          {/* Step 5: Challenge Rival (Step 4 for coding) */}
          <View style={styles.section}>
            <View style={styles.stepLabel}>
              <Text style={styles.stepNumber}>{category === 'studying' ? 'STEP 05' : 'STEP 04'}</Text>
              <Text style={styles.stepTitle}>CHALLENGE RIVAL</Text>
            </View>
            <UserSearchInput
              selectedUser={selectedUser}
              onSelectUser={handleSelectUser}
              onRandomMatch={handleRandomMatch}
            />
            {isRandomMatch && (
              <View style={styles.randomMatchBadge}>
                <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                <Text style={styles.randomMatchText}>Random match selected</Text>
              </View>
            )}
          </View>

          {/* AI Referee Info */}
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Ionicons name="shield-checkmark" size={20} color={colors.accent} />
              <Text style={styles.infoTitle}>AI REFEREE</Text>
            </View>
            <Text style={styles.infoText}>
              {category === 'coding'
                ? "Our AI referee will evaluate both participants' GitHub activity based on your challenge criteria. It will analyze commits, PRs, and code quality to determine a fair winner."
                : "Our AI referee will evaluate both participants' Notion study notes. It will analyze the depth, organization, and quality of notes to determine who studied more effectively."}
            </Text>
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.footer}>
          <Pressable
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit || isLoading}
          >
            <Text style={[styles.submitText, !canSubmit && styles.submitTextDisabled]}>
              {isLoading ? 'CREATING...' : 'LOCK IT IN'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Notion Page Picker Modal */}
      <NotionPagePicker
        visible={showNotionPicker}
        onClose={() => setShowNotionPicker(false)}
        onSelectPage={(page) => setSelectedNotionPage(page)}
        selectedPageId={selectedNotionPage?.id}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
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
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  categoryToggle: {
    flexDirection: 'row',
    gap: 4,
  },
  categoryPill: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  categoryLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  categoryText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  stepLabel: {
    marginBottom: 12,
  },
  stepNumber: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  stepTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  promptContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  promptInput: {
    color: colors.text,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  examplesLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  examplesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  examplePill: {
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  exampleText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  durationContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  durationPill: {
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  durationPillSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  durationText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  durationTextSelected: {
    color: colors.background,
  },
  randomMatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 6,
  },
  randomMatchText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '500',
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginTop: 24,
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
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  infoText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    paddingBottom: 8,
  },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  submitText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  submitTextDisabled: {
    color: colors.textMuted,
  },
  // Notion page selection styles
  selectedPageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: 14,
  },
  selectedPageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  selectedPageTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  changePageButton: {
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  changePageText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  selectPageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent,
    borderStyle: 'dashed',
    padding: 16,
    gap: 8,
  },
  selectPageText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  pageHint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
});
