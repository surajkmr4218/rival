import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';
import { motion } from '../../lib/theme';
import { useReducedMotion } from './useReducedMotion';

interface AnimatedMountProps {
  children: React.ReactNode;
  /** Delay before entrance; pass index * motion.stagger for list staggering. */
  delay?: number;
  /** Distance (px) the content rises from. */
  translateY?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Fades + rises its children in on mount with ease-out (skill: easing,
 * stagger-sequence). Reduce Motion renders instantly. Wrap screen sections or
 * list items (with delay={index * motion.stagger}) for a cohesive entrance.
 */
export default function AnimatedMount({
  children,
  delay = 0,
  translateY = 12,
  duration = motion.base,
  style,
}: AnimatedMountProps) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [reduced, delay, duration]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [translateY, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
