import { Stack } from 'expo-router';
import { COLORS } from '../../src/constants';

export default function LinkingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: COLORS.background,
        },
      }}
    />
  );
}
