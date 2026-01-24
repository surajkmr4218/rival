import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '../_theme';
import { ChallengeCategory, UserPublic } from '../_api/types';
import { createChallenge } from '../_api/client';
import CategoryPill from '../_components/CategoryPill';
import StakeSlider from '../_components/StakeSlider';
import UserSearchInput from '../_components/UserSearchInput';

export default function CreateChallengeScreen() {
  const router = useRouter();
  const [category, setCategory] = useState<ChallengeCategory | null>(null);
  const [stakeAmount, setStakeAmount] = useState(1000); // $10 default
  const [selectedUser, setSelectedUser] = useState<UserPublic | null>(null);
  const [isRandomMatch, setIsRandomMatch] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const getGoalInfo = () => {
    if (category === 'coding') {
      return { type: 'commits_min', value: 5, description: 'Make 5+ commits' };
    }
    return { type: 'screentime_max', value: 120, description: 'Screen time < 2hrs' };
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
    if (!category) {
      Alert.alert('Missing Category', 'Please select a challenge category.');
      return;
    }

    if (!selectedUser && !isRandomMatch) {
      Alert.alert('Missing Opponent', 'Please select an opponent or choose random match.');
      return;
    }

    setIsLoading(true);
    const goalInfo = getGoalInfo();

    try {
      await createChallenge({
        category,
        stake_cents: stakeAmount,
        opponent_username: selectedUser?.username,
        goal_type: goalInfo.type,
        goal_value: goalInfo.value,
        goal_period: 'daily',
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

  const canSubmit = category && (selectedUser || isRandomMatch);

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
          {/* Step 1: Category */}
          <View style={styles.section}>
            <View style={styles.stepLabel}>
              <Text style={styles.stepNumber}>STEP 01</Text>
              <Text style={styles.stepTitle}>SELECT CATEGORY</Text>
            </View>
            <CategoryPill selected={category} onSelect={setCategory} />
          </View>

          {/* Step 2: Stakes */}
          <View style={styles.section}>
            <View style={styles.stepLabel}>
              <Text style={styles.stepNumber}>STEP 02</Text>
              <Text style={styles.stepTitle}>SET THE STAKES</Text>
            </View>
            <StakeSlider value={stakeAmount} onChange={setStakeAmount} />
          </View>

          {/* Step 3: Challenge Rival */}
          <View style={styles.section}>
            <View style={styles.stepLabel}>
              <Text style={styles.stepNumber}>STEP 03</Text>
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
              <Text style={styles.infoTitle}>AI REFEREE RULES</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Automated Monitoring</Text>
              <Text style={styles.infoText}>
                {category === 'coding'
                  ? 'GitHub Webhooks track your commits in real-time'
                  : 'Screen Time APIs verify your usage'}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Escrow Security</Text>
              <Text style={styles.infoText}>
                Stakes are locked until the AI referee decides a winner
              </Text>
            </View>
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
    marginBottom: 12,
  },
  infoTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  infoItem: {
    marginBottom: 12,
  },
  infoLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  infoText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
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
