import React from 'react';
import { Text, StyleSheet, ActivityIndicator, View, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, gradients, radius, glow, type } from '../../lib/theme';
import Gradient from './Gradient';
import PressableScale from '../anim/PressableScale';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  /** 'brand' = neon gradient (default), 'violet' = premium accent. */
  tone?: 'brand' | 'violet';
  style?: StyleProp<ViewStyle>;
}

/**
 * The app's primary call-to-action: a gradient pill with a subtle brand glow,
 * an optional leading icon, and built-in loading/disabled states. One primary
 * CTA per screen (skill: primary-action).
 */
export default function PrimaryButton({
  label,
  onPress,
  icon,
  loading = false,
  disabled = false,
  tone = 'brand',
  style,
}: PrimaryButtonProps) {
  const isOff = disabled || loading;
  const stops = tone === 'violet' ? [colors.secondary, colors.secondaryDim] : gradients.cta;
  const fg = '#04231a';

  return (
    <PressableScale
      onPress={onPress}
      disabled={isOff}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isOff }}
      style={[styles.wrap, !isOff && glow(stops[0], 0.45), style]}
    >
      {isOff && !loading ? (
        <View style={[styles.fill, styles.disabled]}>
          <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
        </View>
      ) : (
        <Gradient colors={stops} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={radius.md} style={styles.fill}>
          {loading ? (
            <ActivityIndicator color={fg} />
          ) : (
            <View style={styles.row}>
              {icon && <Ionicons name={icon} size={18} color={fg} />}
              <Text style={[styles.label, { color: fg }]}>{label}</Text>
            </View>
          )}
        </Gradient>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.md, width: '100%', alignSelf: 'stretch' },
  fill: {
    minHeight: 54,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  disabled: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { ...type.bodyStrong, fontWeight: '800', letterSpacing: 0.5 },
});
