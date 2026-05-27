import React, { useEffect, useRef } from 'react';
import { Animated, DimensionValue, Easing, StyleProp, ViewStyle } from 'react-native';
import { colors } from '../../lib/theme';
import { useReducedMotion } from './useReducedMotion';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A pulsing placeholder block for loading states (skill: progressive-loading,
 * loading-states). Reserve layout with these instead of a blank/spinner screen.
 */
export default function Skeleton({
  width = '100%',
  height = 16,
  radius = 8,
  style,
}: SkeletonProps) {
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (reduced) {
      pulse.setValue(0.6);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.9,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduced]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: colors.card, opacity: pulse },
        style,
      ]}
    />
  );
}

/** A card-shaped skeleton matching ChallengeCard's footprint. */
export function SkeletonCard() {
  return (
    <Animated.View
      style={{
        backgroundColor: colors.card,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
        marginBottom: 12,
        gap: 12,
      }}
    >
      <Skeleton width={90} height={20} radius={6} />
      <Skeleton width="80%" height={18} />
      <Skeleton width="40%" height={12} />
      <Skeleton width="100%" height={14} radius={6} />
    </Animated.View>
  );
}
