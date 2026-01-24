import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../lib/theme';

export default function LeaderboardScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Leaderboard coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: colors.textMuted,
  },
});
