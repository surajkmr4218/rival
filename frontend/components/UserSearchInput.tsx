import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';
import { searchUsers } from '../lib/api';
import { UserPublic } from '../lib/types';

interface UserSearchInputProps {
  selectedUser: UserPublic | null;
  onSelectUser: (user: UserPublic | null) => void;
}

export default function UserSearchInput({ selectedUser, onSelectUser }: UserSearchInputProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserPublic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const search = async () => {
      if (query.length < 2) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await searchUsers(query);
        setResults(response.data.users);
        setShowResults(true);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const handleSelect = (user: UserPublic) => {
    onSelectUser(user);
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const clearSelection = () => {
    onSelectUser(null);
    setQuery('');
  };

  if (selectedUser) {
    return (
      <View style={styles.selectedContainer}>
        <View style={styles.selectedUser}>
          <Ionicons name="person-circle" size={32} color={colors.accent} />
          <Text style={styles.selectedUsername}>@{selectedUser.username}</Text>
        </View>
        <Pressable onPress={clearSelection} style={styles.clearButton}>
          <Ionicons name="close-circle" size={24} color={colors.textMuted} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <Ionicons name="search" size={20} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          placeholder="Search opponent by username..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {isLoading && <ActivityIndicator size="small" color={colors.accent} />}
      </View>

      {showResults && results.length > 0 && (
        <View style={styles.resultsContainer}>
          {results.map((user) => (
            <Pressable
              key={user.id}
              style={styles.resultItem}
              onPress={() => handleSelect(user)}
            >
              <Ionicons name="person-circle" size={24} color={colors.accent} />
              <Text style={styles.resultUsername}>@{user.username}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {query.length >= 2 && !isLoading && results.length === 0 && (
        <Text style={styles.noResults}>No users found</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    paddingVertical: 14,
  },
  resultsContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resultUsername: {
    color: colors.text,
    fontSize: 16,
  },
  noResults: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    padding: 12,
  },
  selectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: 12,
  },
  selectedUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedUsername: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  clearButton: {
    padding: 4,
  },
});
