import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/auth';
import { colors, motion } from '../lib/theme';
import AnimatedMount from '../components/anim/AnimatedMount';

export default function LoginScreen() {
  const { login, register, isLoading, error } = useAuth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const switchToSignIn = () => {
    setIsSignUp(false);
    setEmail('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
  };

  const switchToSignUp = () => {
    setIsSignUp(true);
    setEmail('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
  };

  const canSubmitSignIn = email.trim().length > 0 && password.length > 0;
  const canSubmitSignUp =
    email.trim().length > 0 &&
    username.trim().length > 0 &&
    password.length >= 6 &&
    confirmPassword.length > 0 &&
    password === confirmPassword;

  const canSubmit = isSignUp ? canSubmitSignUp : canSubmitSignIn;

  const handleSubmit = () => {
    if (!canSubmit || isLoading) return;

    if (isSignUp) {
      register(email.trim(), username.trim(), password);
    } else {
      login(email.trim(), password);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <AnimatedMount delay={0} translateY={16}>
          <View style={styles.logoBox}>
            <Ionicons name="trophy" size={40} color={colors.accent} />
          </View>

          <Text style={styles.title}>RIVAL</Text>
          <Text style={styles.subtitle}>HIGH STAKES PRODUCTIVITY</Text>
        </AnimatedMount>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <AnimatedMount delay={motion.stagger} style={styles.toggle}>
          <Pressable
            style={[styles.toggleBtn, !isSignUp && styles.toggleBtnActive]}
            onPress={switchToSignIn}
          >
            <Text style={[styles.toggleText, !isSignUp && styles.toggleTextActive]}>
              Sign In
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, isSignUp && styles.toggleBtnActive]}
            onPress={switchToSignUp}
          >
            <Text style={[styles.toggleText, isSignUp && styles.toggleTextActive]}>
              Sign Up
            </Text>
          </Pressable>
        </AnimatedMount>

        <AnimatedMount delay={motion.stagger * 2} style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor={colors.textMuted}
            placeholder="you@example.com"
            editable={!isLoading}
          />

          {isSignUp ? (
            <>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor={colors.textMuted}
                placeholder="johndoe"
                editable={!isLoading}
              />
            </>
          ) : null}

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor={colors.textMuted}
            placeholder={isSignUp ? 'Min 6 characters' : 'Enter password'}
            editable={!isLoading}
          />

          {isSignUp ? (
            <>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholderTextColor={colors.textMuted}
                placeholder="Repeat password"
                editable={!isLoading}
              />
            </>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.button,
              !canSubmit && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleSubmit}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.buttonText}>
                {isSignUp ? 'Create Account' : 'Sign In'}
              </Text>
            )}
          </Pressable>
        </AnimatedMount>

        <Text style={styles.footer}>WAGER RESPONSIBLY</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logoBox: {
    alignSelf: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 24,
  },
  error: {
    color: colors.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: colors.accent,
    borderRadius: 7,
  },
  toggleText: {
    fontWeight: '600',
    color: colors.textMuted,
  },
  toggleTextActive: {
    color: colors.background,
  },
  form: {},
  label: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 12,
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
    color: colors.text,
    fontSize: 16,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: colors.background,
    fontWeight: '600',
    fontSize: 16,
  },
  footer: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    letterSpacing: 2,
    marginTop: 32,
  },
});
