import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../lib/theme';
import { connectGitHub } from '../../lib/api';
import AnimatedMount from '../../components/anim/AnimatedMount';

export default function GitHubCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; error?: string }>();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Connecting to GitHub...');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    // Check for error from GitHub
    if (params.error) {
      setStatus('error');
      setMessage('GitHub authorization was denied');
      redirectAfterDelay();
      return;
    }

    // Check for code
    if (!params.code) {
      setStatus('error');
      setMessage('No authorization code received');
      redirectAfterDelay();
      return;
    }

    try {
      // Exchange code for token via backend
      const response = await connectGitHub(params.code);

      setStatus('success');
      setMessage(`Connected as @${response.data.github_username}`);
      redirectAfterDelay();
    } catch (error: any) {
      setStatus('error');
      const errorMsg = error.response?.data?.detail || 'Failed to connect GitHub';
      setMessage(errorMsg);
      redirectAfterDelay();
    }
  };

  const redirectAfterDelay = () => {
    setTimeout(() => {
      router.replace('/(tabs)/profile');
    }, 2000);
  };

  return (
    <View style={styles.container}>
      <AnimatedMount key={status} style={styles.card}>
        {status === 'loading' && (
          <>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.message}>{message}</Text>
          </>
        )}

        {status === 'success' && (
          <>
            <View style={styles.iconContainer}>
              <Ionicons name="checkmark-circle" size={64} color={colors.accent} />
            </View>
            <Text style={styles.title}>Success!</Text>
            <Text style={styles.message}>{message}</Text>
            <Text style={styles.redirect}>Redirecting...</Text>
          </>
        )}

        {status === 'error' && (
          <>
            <View style={styles.iconContainer}>
              <Ionicons name="close-circle" size={64} color={colors.error} />
            </View>
            <Text style={styles.title}>Connection Failed</Text>
            <Text style={styles.message}>{message}</Text>
            <Text style={styles.redirect}>Redirecting...</Text>
          </>
        )}
      </AnimatedMount>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  message: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  redirect: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 24,
    fontStyle: 'italic',
  },
});
