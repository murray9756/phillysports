import { Stack } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';

export default function RafflesLayout() {
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
