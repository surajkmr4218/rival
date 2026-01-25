import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';

interface TopUpDrawerProps {
  visible: boolean;
  onComplete: (amountCents: number) => void;
}

const PRESET_AMOUNTS = [1000, 2000]; // $10, $20 in cents
const MIN_AMOUNT = 1000; // $10 minimum

export default function TopUpDrawer({ visible, onComplete }: TopUpDrawerProps) {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const checkmarkOpacity = useRef(new Animated.Value(0)).current;

  // Reset state when drawer visibility changes
  useEffect(() => {
    if (visible) {
      // Reset to initial state when drawer opens
      setSelectedAmount(null);
      setCustomAmount('');
      setIsCustom(false);
      setShowSuccess(false);
      setIsProcessing(false);
      checkmarkScale.setValue(0);
      checkmarkOpacity.setValue(0);
    }
  }, [visible]);

  const getEffectiveAmount = (): number => {
    if (isCustom) {
      const parsed = parseFloat(customAmount);
      return isNaN(parsed) ? 0 : Math.round(parsed * 100);
    }
    return selectedAmount || 0;
  };

  const effectiveAmount = getEffectiveAmount();
  const isValidAmount = effectiveAmount >= MIN_AMOUNT;

  const handlePresetSelect = (amount: number) => {
    setSelectedAmount(amount);
    setIsCustom(false);
    setCustomAmount('');
  };

  const handleCustomSelect = () => {
    setIsCustom(true);
    setSelectedAmount(null);
  };

  const handleApplePay = () => {
    if (!isValidAmount) return;

    setIsProcessing(true);

    // Simulate Apple Pay processing
    setTimeout(() => {
      setIsProcessing(false);
      setShowSuccess(true);

      // Animate checkmark
      Animated.parallel([
        Animated.spring(checkmarkScale, {
          toValue: 1,
          friction: 3,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(checkmarkOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Complete after animation
      setTimeout(() => {
        onComplete(effectiveAmount);
      }, 1500);
    }, 1200);
  };

  const formatAmount = (cents: number) => `$${(cents / 100).toFixed(0)}`;

  if (showSuccess) {
    return (
      <Modal visible={visible} transparent animationType="none">
        <View style={styles.overlay}>
          <View style={styles.successContainer}>
            <Animated.View
              style={[
                styles.checkmarkCircle,
                {
                  transform: [{ scale: checkmarkScale }],
                  opacity: checkmarkOpacity,
                },
              ]}
            >
              <Ionicons name="checkmark" size={60} color={colors.background} />
            </Animated.View>
            <Text style={styles.successText}>Payment Successful!</Text>
            <Text style={styles.successAmount}>
              {formatAmount(effectiveAmount)} added to wallet
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.overlay}>
            <View style={styles.drawer}>
              {/* Header */}
              <View style={styles.header}>
                <Ionicons name="wallet" size={28} color={colors.accent} />
                <Text style={styles.title}>Top Up Wallet</Text>
              </View>

              <Text style={styles.subtitle}>
                Add funds to start competing in challenges
              </Text>

              {/* Amount Options */}
              <View style={styles.amountGrid}>
                {PRESET_AMOUNTS.map((amount) => (
                  <Pressable
                    key={amount}
                    style={[
                      styles.amountButton,
                      selectedAmount === amount && !isCustom && styles.amountButtonSelected,
                    ]}
                    onPress={() => handlePresetSelect(amount)}
                  >
                    <Text
                      style={[
                        styles.amountText,
                        selectedAmount === amount && !isCustom && styles.amountTextSelected,
                      ]}
                    >
                      {formatAmount(amount)}
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  style={[
                    styles.amountButton,
                    isCustom && styles.amountButtonSelected,
                  ]}
                  onPress={handleCustomSelect}
                >
                  <Text
                    style={[
                      styles.amountText,
                      isCustom && styles.amountTextSelected,
                    ]}
                  >
                    Custom
                  </Text>
                </Pressable>
              </View>

              {/* Custom Amount Input */}
              {isCustom && (
                <View style={styles.customInputContainer}>
                  <Text style={styles.dollarSign}>$</Text>
                  <TextInput
                    style={styles.customInput}
                    placeholder="Enter amount"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={customAmount}
                    onChangeText={setCustomAmount}
                    autoFocus
                  />
                  <Text style={styles.minText}>(min $10)</Text>
                </View>
              )}

              {/* Apple Pay Button */}
              <Pressable
                style={[
                  styles.applePayButton,
                  !isValidAmount && styles.applePayButtonDisabled,
                ]}
                onPress={handleApplePay}
                disabled={!isValidAmount || isProcessing}
              >
                {isProcessing ? (
                  <Text style={styles.applePayText}>Processing...</Text>
                ) : (
                  <>
                    <Ionicons
                      name="logo-apple"
                      size={20}
                      color={isValidAmount ? '#fff' : '#666'}
                    />
                    <Text
                      style={[
                        styles.applePayText,
                        !isValidAmount && styles.applePayTextDisabled,
                      ]}
                    >
                      Pay with Apple Pay
                    </Text>
                  </>
                )}
              </Pressable>

              <Text style={styles.secureText}>
                <Ionicons name="lock-closed" size={12} color={colors.textMuted} /> Secure payment
              </Text>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  drawer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 8,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  amountGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  amountButton: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 16,
    alignItems: 'center',
  },
  amountButtonSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
  },
  amountText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  amountTextSelected: {
    color: colors.accent,
  },
  customInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  dollarSign: {
    color: colors.accent,
    fontSize: 24,
    fontWeight: '700',
  },
  customInput: {
    flex: 1,
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    paddingVertical: 16,
    marginLeft: 8,
  },
  minText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  applePayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    borderRadius: 12,
    padding: 18,
    gap: 8,
    marginTop: 8,
  },
  applePayButtonDisabled: {
    backgroundColor: '#333',
  },
  applePayText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  applePayTextDisabled: {
    color: '#666',
  },
  secureText: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  checkmarkCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successText: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  successAmount: {
    color: colors.accent,
    fontSize: 18,
  },
});
