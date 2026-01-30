import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { COLORS } from '../src/constants';
import { hasPremiumAccess } from '../src/lib/subscription';

function RootLayoutNav() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  // X/GitHub連携が完了しているかチェック
  const isLinked = user?.xLinked && user?.githubLinked;

  // プレミアムアクセスがあるかチェック（管理者またはサブスク加入者）
  const isPremium = user ? hasPremiumAccess(user) : false;

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.primary,
        },
        headerTintColor: COLORS.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        contentStyle: {
          backgroundColor: COLORS.background,
        },
      }}
    >
      {!user ? (
        // 1. 未ログイン → 認証画面
        <Stack.Screen
          name="(auth)"
          options={{ headerShown: false }}
        />
      ) : !user.onboardingCompleted ? (
        // 2. ログイン済みだが目標設定未完了 → オンボーディング
        <Stack.Screen
          name="onboarding"
          options={{ headerShown: false }}
        />
      ) : !isLinked ? (
        // 3. 目標設定済みだがX/GitHub未連携 → 連携画面
        <Stack.Screen
          name="linking"
          options={{ headerShown: false }}
        />
      ) : !isPremium ? (
        // 4. 連携済みだがサブスク未加入 → サブスク画面（必須）
        <Stack.Screen
          name="subscription"
          options={{ headerShown: false }}
        />
      ) : (
        // 5. 全て完了 → メイン画面
        <Stack.Screen
          name="(main)"
          options={{ headerShown: false }}
        />
      )}
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <RootLayoutNav />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
