import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Image, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { COLORS } from '../src/constants';
import { hasPremiumAccess } from '../src/lib/subscription';
import { useEffect } from 'react';

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  console.log('=== RootLayoutNav render ===');
  console.log('Loading:', loading);
  console.log('User:', user ? user.uid : 'null');
  console.log('Current segments:', segments);

  // 認証状態に基づいてナビゲーション
  useEffect(() => {
    if (loading) return;

    console.log('=== Navigation Effect ===');
    console.log('User:', user ? user.uid : 'null');
    console.log('Segments:', segments);

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';
    const inLinking = segments[0] === 'linking';
    const inSubscription = segments[0] === 'subscription';
    const inMain = segments[0] === '(main)';

    if (!user) {
      // 未ログイン → 認証画面へ
      if (!inAuthGroup) {
        console.log('Navigating to (auth)');
        router.replace('/(auth)');
      }
      return;
    }

    // ログイン済み
    const isLinked = user.xLinked && user.githubLinked;
    const isPremium = hasPremiumAccess(user);

    console.log('onboardingCompleted:', user.onboardingCompleted);
    console.log('isLinked:', isLinked);
    console.log('isPremium:', isPremium);

    if (!user.onboardingCompleted) {
      // オンボーディング未完了
      if (!inOnboarding) {
        console.log('Navigating to /onboarding');
        router.replace('/onboarding');
      }
    } else if (!isLinked) {
      // X/GitHub未連携
      if (!inLinking) {
        console.log('Navigating to /linking');
        router.replace('/linking');
      }
    } else if (!isPremium) {
      // サブスク未加入
      if (!inSubscription) {
        console.log('Navigating to /subscription');
        router.replace('/subscription');
      }
    } else {
      // 全て完了 → メイン画面
      if (!inMain) {
        console.log('Navigating to /(main)');
        router.replace('/(main)');
      }
    }
  }, [user, loading, segments]);

  if (loading) {
    console.log('Showing loading screen');
    return (
      <View style={loadingStyles.container}>
        <View style={loadingStyles.iconContainer}>
          <Image
            source={require('../assets/images/icon.png')}
            style={loadingStyles.icon}
            resizeMode="contain"
          />
        </View>
        <View style={loadingStyles.animationContainer}>
          <LottieView
            source={require('../assets/animations/Loading Dots Blue.json')}
            autoPlay
            loop
            style={loadingStyles.animation}
          />
        </View>
      </View>
    );
  }

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
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="linking" options={{ headerShown: false }} />
      <Stack.Screen name="subscription" options={{ headerShown: false }} />
      <Stack.Screen name="(main)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootLayoutNav />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  icon: {
    width: 200,
    height: 200,
    borderRadius: 20,
  },
  animationContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  animation: {
    width: 300,
    height: 200,
  },
});
