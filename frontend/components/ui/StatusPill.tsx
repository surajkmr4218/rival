import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, type } from '../../lib/theme';

export type PillTone = 'accent' | 'pending' | 'info' | 'loss' | 'violet' | 'muted';

const TONES: Record<PillTone, { fg: string; bg: string }> = {
  accent: { fg: colors.accent, bg: colors.accentSoft },
  pending: { fg: colors.pending, bg: colors.pendingSoft },
  info: { fg: colors.info, bg: colors.infoSoft },
  loss: { fg: colors.loss, bg: colors.lossSoft },
  violet: { fg: colors.secondary, bg: colors.secondarySoft },
  muted: { fg: colors.textSecondary, bg: 'rgba(143,227,184,0.08)' },
};

interface StatusPillProps {
  label: string;
  tone?: PillTone;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Show a small leading status dot. */
  dot?: boolean;
}

/**
 * A compact, tinted status chip. Color always pairs with text/icon so meaning
 * never relies on hue alone (skill: color-not-only).
 */
export default function StatusPill({ label, tone = 'muted', icon, dot }: StatusPillProps) {
  const c = TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      {dot && <View style={[styles.dot, { backgroundColor: c.fg }]} />}
      {icon && <Ionicons name={icon} size={12} color={c.fg} />}
      <Text style={[styles.text, { color: c.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { ...type.overline, fontSize: 10.5, letterSpacing: 0.8 },
});
