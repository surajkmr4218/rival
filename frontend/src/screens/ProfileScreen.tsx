import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../store/auth';
import { colors } from '../theme';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const balance = user ? `$${(user.balance_cents / 100).toFixed(2)}` : '$0.00';

  return (
    <View style={styles.container}>
      {/* Avatar */}
      <Ionicons name="person-circle" size={80} color={colors.accent} />

      <Text style={styles.username}>@{user?.username}</Text>
      <Text style={styles.email}>{user?.email}</Text>

      {/* Balance */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>BALANCE</Text>
        <Text style={styles.balanceValue}>{balance}</Text>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>LOGOUT</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 24,
  },
  username: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
  },
  email: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  balanceCard: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginTop: 32,
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  balanceValue: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.accent,
    marginTop: 8,
  },
  logoutBtn: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  logoutText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
});
