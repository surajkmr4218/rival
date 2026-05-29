import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, type, space, glow } from '../lib/theme';
import Gradient from './ui/Gradient';

interface ChallengeResultPopupProps {
  visible: boolean;
  isWin: boolean;
  amount: number; // in cents
  onDismiss: () => void;
}

export default function ChallengeResultPopup({
  visible,
  isWin,
  amount,
  onDismiss,
}: ChallengeResultPopupProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      bounceAnim.setValue(0);

      Animated.sequence([
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 5,
            tension: 110,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        Animated.loop(
          Animated.sequence([
            Animated.timing(bounceAnim, {
              toValue: -8,
              duration: 300,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(bounceAnim, {
              toValue: 0,
              duration: 300,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          { iterations: 2 }
        ),
      ]).start();

      const timer = setTimeout(onDismiss, 2600);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const formatAmount = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const accentColor = isWin ? colors.accent : colors.loss;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <Animated.View
          style={{
            transform: [{ scale: scaleAnim }, { translateY: bounceAnim }],
            opacity: opacityAnim,
          }}
        >
          <Gradient
            colors={isWin ? ['#0d5a39', '#0e3826'] : ['#4a2230', '#0e3826']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            radius={radius.xl}
            style={[styles.container, { borderColor: accentColor }, glow(accentColor, 0.35)]}
          >
            <View style={[styles.iconRing, { borderColor: accentColor }]}>
              <Ionicons name={isWin ? 'trophy' : 'flag'} size={44} color={accentColor} />
            </View>
            <Text style={styles.title}>{isWin ? 'VICTORY!' : 'DEFEATED'}</Text>
            <Text style={[styles.amount, { color: accentColor }]}>
              {isWin ? '+' : '-'}
              {formatAmount(amount)}
            </Text>
            <Text style={styles.subtitle}>
              {isWin ? 'The pot is yours — balance updated.' : 'Better luck next battle.'}
            </Text>
          </Gradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.xl,
  },
  container: {
    alignItems: 'center',
    padding: space.xxxl,
    borderWidth: 2,
    minWidth: 300,
  },
  iconRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.lg,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: space.sm,
  },
  amount: {
    fontSize: 38,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    marginBottom: space.md,
  },
  subtitle: {
    color: colors.textSecondary,
    ...type.callout,
    textAlign: 'center',
  },
});
