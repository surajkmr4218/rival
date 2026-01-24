import React from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { ChallengeCategory } from '../api/types';

interface CategoryOption {
  id: ChallengeCategory;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
}

const CATEGORIES: CategoryOption[] = [
  {
    id: 'coding',
    label: 'Coding Time',
    icon: 'logo-github',
    description: 'Track GitHub commits',
  },
  {
    id: 'screentime',
    label: 'Social Limit',
    icon: 'phone-portrait-outline',
    description: 'Track screen time',
  },
];

interface CategoryPillProps {
  selected: ChallengeCategory | null;
  onSelect: (category: ChallengeCategory) => void;
}

export default function CategoryPill({ selected, onSelect }: CategoryPillProps) {
  return (
    <View style={styles.container}>
      {CATEGORIES.map((category) => {
        const isSelected = selected === category.id;
        return (
          <Pressable
            key={category.id}
            style={[styles.pill, isSelected && styles.pillSelected]}
            onPress={() => onSelect(category.id)}
          >
            <Ionicons
              name={category.icon}
              size={20}
              color={isSelected ? colors.background : colors.textMuted}
            />
            <View style={styles.textContainer}>
              <Text style={[styles.label, isSelected && styles.labelSelected]}>
                {category.label}
              </Text>
              <Text style={[styles.description, isSelected && styles.descriptionSelected]}>
                {category.description}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 8,
  },
  pillSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  textContainer: {
    flex: 1,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  labelSelected: {
    color: colors.background,
  },
  description: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  descriptionSelected: {
    color: colors.background,
    opacity: 0.8,
  },
});
