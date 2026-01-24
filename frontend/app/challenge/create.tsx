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
import { UserPublic } from '../../lib/types';
import { createChallenge } from '../../lib/api';
import StakeSlider from '../../components/StakeSlider';
import UserSearchInput from '../../components/UserSearchInput';

// Example prompts to help users understand what they can write
const EXAMPLE_PROMPTS = [
  'Make 5 meaningful commits with descriptive messages',
  'Open 2 pull requests to any repository',
  'Write more lines of code than your opponent',
  'Make the most contributions to open source',
];

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
  const [challengePrompt, setChallengePrompt] = useState('');
  const [stakeAmount, setStakeAmount] = useState(1000); // $10 default
  const [selectedUser, setSelectedUser] = useState<UserPublic | null>(null);
  const [isRandomMatch, setIsRandomMatch] = useState(false);
  const [durationHours, setDurationHours] = useState(24);
  const [isLoading, setIsLoading] = useState(false);

  const handleRandomMatch = () => {
    setSelectedUser(null);
    setIsRandomMatch(true);
  };

  const handleSelectUser = (user: UserPublic | null) => {
    setSelectedUser(user);
    setIsRandomMatch(false);
  };

  const handleSubmit = async () => {
    // Validate prompt
    if (!challengePrompt.trim() || challengePrompt.trim().length < 10) {
      Alert.alert('Invalid Challenge', 'Please describe your challenge (at least 10 characters).');
      return;
    }

    if (!selectedUser && !isRandomMatch) {
      Alert.alert('Missing Opponent', 'Please select an opponent or choose random match.');
      return;
    }

    setIsLoading(true);

    try {
      await createChallenge({
        category: 'coding', // AI referee is currently for coding challenges
        stake_cents: stakeAmount,
        opponent_username: selectedUser?.username,
        challenge_prompt: challengePrompt.trim(),
        duration_hours: durationHours,
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

  const canSubmit = challengePrompt.trim().length >= 10 && (selectedUser || isRandomMatch);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>NEW CHALLENGE</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Step 1: Challenge Prompt */}
          <View style={styles.section}>
            <View style={styles.stepLabel}>
              <Text style={styles.stepNumber}>STEP 01</Text>
              <Text style={styles.stepTitle}>DESCRIBE YOUR CHALLENGE</Text>
            </View>

            <View style={styles.promptContainer}>
              <TextInput
                style={styles.promptInput}
                placeholder="What's the challenge? Be specific..."
                placeholderTextColor={colors.textMuted}
                value={challengePrompt}
                onChangeText={setChallengePrompt}
                multiline
                numberOfLines={3}
                maxLength={500}
              />
              <Text style={styles.charCount}>{challengePrompt.length}/500</Text>
            </View>

            <Text style={styles.examplesLabel}>Examples:</Text>
            <View style={styles.examplesContainer}>
              {EXAMPLE_PROMPTS.map((prompt, index) => (
                <Pressable
                  key={index}
                  style={styles.examplePill}
                  onPress={() => setChallengePrompt(prompt)}
                >
                  <Text style={styles.exampleText}>{prompt}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Step 2: Duration */}
          <View style={styles.section}>
            <View style={styles.stepLabel}>
              <Text style={styles.stepNumber}>STEP 02</Text>
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

          {/* Step 3: Stakes */}
          <View style={styles.section}>
            <View style={styles.stepLabel}>
              <Text style={styles.stepNumber}>STEP 03</Text>
              <Text style={styles.stepTitle}>SET THE STAKES</Text>
            </View>
            <StakeSlider value={stakeAmount} onChange={setStakeAmount} />
          </View>

          {/* Step 4: Challenge Rival */}
          <View style={styles.section}>
            <View style={styles.stepLabel}>
              <Text style={styles.stepNumber}>STEP 04</Text>
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
              Our AI referee will evaluate both participants' GitHub activity based on your
              challenge criteria. It will analyze commits, PRs, and code quality to determine
              a fair winner.
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
              {isLoading ? 'CREATING...' : 'LOCK IT IN ⚡'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
  headerSpacer: {
    width: 32,
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
});
