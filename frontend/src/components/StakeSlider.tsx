import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors } from '../theme';

interface StakeSliderProps {
  value: number; // in cents
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export default function StakeSlider({ value, onChange, min = 100, max = 50000 }: StakeSliderProps) {
  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(0)}`;
  const prizePool = value * 2;

  const renderSlider = () => {
    if (Platform.OS === 'web') {
      // Use native HTML input for web
      return (
        <input
          type="range"
          min={min}
          max={max}
          step={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            width: '100%',
            height: 40,
            accentColor: colors.accent,
            cursor: 'pointer',
          }}
        />
      );
    }

    // Use React Native Community Slider for native
    const Slider = require('@react-native-community/slider').default;
    return (
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={100}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.accent}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.column}>
            <Text style={styles.label}>YOUR STAKE</Text>
            <Text style={styles.amount}>{formatCurrency(value)}</Text>
          </View>
          <View style={styles.column}>
            <Text style={styles.label}>PRIZE POOL</Text>
            <Text style={[styles.amount, styles.prizeAmount]}>{formatCurrency(prizePool)}</Text>
          </View>
        </View>

        <View style={styles.sliderContainer}>
          {renderSlider()}
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabel}>{formatCurrency(min)}</Text>
            <Text style={styles.sliderLabel}>{formatCurrency(max)}</Text>
          </View>
        </View>

        <Text style={styles.helper}>Opponent must match your stake to begin.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  column: {
    alignItems: 'center',
  },
  label: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  amount: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '700',
  },
  prizeAmount: {
    color: colors.accent,
  },
  sliderContainer: {
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  helper: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
});
