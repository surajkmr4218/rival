import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
  GestureResponderEvent,
} from 'react-native';
import { useReducedMotion } from './useReducedMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  /** Scale applied while pressed (skill: scale-feedback 0.95-1.05). */
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * A drop-in Pressable that springs to a slightly smaller scale on press for
 * tactile feedback, then back on release. Honors Reduce Motion.
 *
 * The scale transform and the caller's style are both applied to the Pressable
 * itself (not an inner wrapper) so layout — including percentage widths in
 * centered containers — resolves exactly as a plain Pressable would.
 */
export default function PressableScale({
  scaleTo = 0.96,
  style,
  children,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();

  const animateTo = (value: number) => {
    if (reduced) return;
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  };

  const handleIn = (e: GestureResponderEvent) => {
    animateTo(scaleTo);
    onPressIn?.(e);
  };
  const handleOut = (e: GestureResponderEvent) => {
    animateTo(1);
    onPressOut?.(e);
  };

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={handleIn}
      onPressOut={handleOut}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}
