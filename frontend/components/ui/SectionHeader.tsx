import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { colors, type, space } from '../../lib/theme';

interface SectionHeaderProps {
  title: string;
  /** Optional trailing count chip. */
  count?: number;
  /** Small caption shown under/after the title. */
  hint?: string;
  /** Dot color (defaults to brand accent). */
  dotColor?: string;
  style?: StyleProp<ViewStyle>;
}

/** A consistent eyebrow-style section label with a leading status dot. */
export default function SectionHeader({ title, count, hint, dotColor = colors.accent, style }: SectionHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {typeof count === 'number' && count > 0 ? (
        <View style={styles.countChip}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: space.md },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 8 },
  title: { color: colors.textSecondary, ...type.overline },
  hint: { color: colors.textMuted, ...type.caption, marginLeft: 8 },
  countChip: {
    marginLeft: 8,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { color: colors.accent, ...type.caption, fontWeight: '700', fontSize: 11 },
});
