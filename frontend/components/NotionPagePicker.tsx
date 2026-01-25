import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';
import { searchNotionPages } from '../lib/api';
import type { NotionPage } from '../lib/types';

interface NotionPagePickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectPage: (page: NotionPage) => void;
  selectedPageId?: string | null;
}

export default function NotionPagePicker({
  visible,
  onClose,
  onSelectPage,
  selectedPageId,
}: NotionPagePickerProps) {
  const [query, setQuery] = useState('');
  const [pages, setPages] = useState<NotionPage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPages = useCallback(async (searchQuery?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await searchNotionPages(searchQuery);
      // API returns list directly, not {pages: [...]}
      setPages(Array.isArray(response.data) ? response.data : []);
    } catch (err: any) {
      console.log('Notion pages error:', err.response?.data || err.message);
      setError(err.response?.data?.detail || 'Failed to load pages');
      setPages([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load pages when modal opens
  useEffect(() => {
    if (visible) {
      fetchPages();
    }
  }, [visible, fetchPages]);

  // Debounced search
  useEffect(() => {
    if (!visible) return;

    const debounce = setTimeout(() => {
      fetchPages(query || undefined);
    }, 300);

    return () => clearTimeout(debounce);
  }, [query, visible, fetchPages]);

  const handleSelect = (page: NotionPage) => {
    onSelectPage(page);
    onClose();
  };

  const formatLastEdited = (dateStr: string | null): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const renderPage = ({ item }: { item: NotionPage }) => {
    const isSelected = item.id === selectedPageId;
    return (
      <Pressable
        style={[styles.pageItem, isSelected && styles.pageItemSelected]}
        onPress={() => handleSelect(item)}
      >
        <Ionicons
          name="document-text"
          size={24}
          color={isSelected ? colors.accent : colors.textMuted}
        />
        <View style={styles.pageInfo}>
          <Text style={styles.pageTitle} numberOfLines={1}>
            {item.title || 'Untitled'}
          </Text>
          {item.last_edited && (
            <Text style={styles.pageDate}>
              Edited {formatLastEdited(item.last_edited)}
            </Text>
          )}
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
        )}
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Select Study Page</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search pages..."
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Content */}
          {isLoading && pages.length === 0 ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.loadingText}>Loading pages...</Text>
            </View>
          ) : error ? (
            <View style={styles.centered}>
              <Ionicons name="alert-circle" size={48} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
              <Pressable style={styles.retryButton} onPress={() => fetchPages()}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : pages.length === 0 ? (
            <View style={styles.centered}>
              <Ionicons name="document" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>
                {query ? 'No pages found' : 'No pages in workspace'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={pages}
              keyExtractor={(item) => item.id}
              renderItem={renderPage}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Info */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={16} color={colors.accent} />
            <Text style={styles.infoText}>
              Select a root page. All child pages will be tracked for activity.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    margin: 16,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    paddingVertical: 12,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  retryButton: {
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
  },
  retryText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
  },
  pageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pageItemSelected: {
    borderColor: colors.accent,
  },
  pageInfo: {
    flex: 1,
  },
  pageTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  pageDate: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    gap: 8,
  },
  infoText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
  },
});
