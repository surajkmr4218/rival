import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';

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
      // Reset animations
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      bounceAnim.setValue(0);

      // Start animation sequence
      Animated.sequence([
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 4,
            tension: 100,
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
              toValue: -10,
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

      // Auto dismiss after 2.5 seconds
      const timer = setTimeout(onDismiss, 2500);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const formatAmount = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.container,
            isWin ? styles.containerWin : styles.containerLose,
            {
              transform: [
                { scale: scaleAnim },
                { translateY: bounceAnim },
              ],
              opacity: opacityAnim,
            },
          ]}
        >
          <Ionicons
            name={isWin ? 'trophy' : 'sad'}
            size={64}
            color={isWin ? '#FFD700' : colors.textMuted}
          />

          <Text style={styles.title}>{isWin ? 'VICTORY!' : 'DEFEATED'}</Text>

          <Text style={[styles.amount, isWin ? styles.amountWin : styles.amountLose]}>
            {isWin ? '+' : '-'}{formatAmount(amount)}
          </Text>

          <Text style={styles.subtitle}>
            {isWin
              ? 'Great job! Your balance has been updated.'
              : 'Better luck next time!'}
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 3,
    minWidth: 280,
  },
  containerWin: {
    borderColor: colors.accent,
  },
  containerLose: {
    borderColor: colors.error,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 16,
    marginBottom: 8,
  },
  amount: {
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 12,
  },
  amountWin: {
    color: colors.accent,
  },
  amountLose: {
    color: colors.error,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
});
