import { Stack } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';

export default function MessagesLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
      }}
    />
  );
}
