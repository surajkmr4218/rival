import { Stack } from 'expo-router';
import { colors } from '../../src/theme';

export default function ChallengeLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="create" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="pending" />
    </Stack>
  );
}
