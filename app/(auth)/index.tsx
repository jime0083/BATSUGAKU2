import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../../src/contexts/AuthContext';

const PRIVACY_POLICY_URL = 'https://batugaku2-ad498.web.app/privacy-policy.html';
const TERMS_URL = 'https://batugaku2-ad498.web.app/terms-of-service.html';

export default function LoginScreen() {
  const { signInWithGoogle, signInWithApple } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'apple' | null>(null);

  const handleGoogleLogin = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setLoadingProvider('google');
    try {
      console.log('=== Google Login Button Pressed ===');
      await signInWithGoogle();
      console.log('=== signInWithGoogle completed successfully ===');
    } catch (error: any) {
      console.error('=== Login Error Caught ===');
      console.error('Error:', error);

      const errorMessage = error instanceof Error ? error.message : 'ログインに失敗しました';
      console.error('Error message to display:', errorMessage);

      if (!errorMessage.includes('キャンセル')) {
        Alert.alert(
          'ログインエラー',
          `${errorMessage}\n\n(Xcodeのコンソールで詳細なログを確認してください)`
        );
      }
    } finally {
      setIsLoading(false);
      setLoadingProvider(null);
    }
  };

  const handleAppleLogin = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setLoadingProvider('apple');
    try {
      console.log('=== Apple Login Button Pressed ===');
      await signInWithApple();
      console.log('=== signInWithApple completed successfully ===');
    } catch (error: any) {
      console.error('=== Apple Login Error Caught ===');
      console.error('Error:', error);

      const errorMessage = error instanceof Error ? error.message : 'ログインに失敗しました';

      if (!errorMessage.includes('キャンセル')) {
        Alert.alert('ログインエラー', errorMessage);
      }
    } finally {
      setIsLoading(false);
      setLoadingProvider(null);
    }
  };

  const handleOpenTerms = () => {
    Linking.openURL(TERMS_URL);
  };

  const handleOpenPrivacy = () => {
    Linking.openURL(PRIVACY_POLICY_URL);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Lottieアニメーション */}
        <View style={styles.animationContainer}>
          <LottieView
            source={require('../../assets/animations/Growth Illustration.json')}
            autoPlay
            loop
            style={styles.animation}
          />
        </View>

        {/* キャッチコピー */}
        <View style={styles.catchCopySection}>
          <Text style={styles.catchCopyLine}>「サボり」をフォロワーが監視</Text>
          <Text style={styles.catchCopyLine}>絶対サボれない</Text>
          <Text style={styles.catchCopyLine}>学習習慣化サポートアプリ</Text>
        </View>

        {/* ログインボタン */}
        <View style={styles.loginSection}>
          {/* Apple Sign In ボタン（iOS のみ） */}
          {Platform.OS === 'ios' && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={30}
              style={styles.appleButton}
              onPress={handleAppleLogin}
            />
          )}

          {/* Google ログインボタン */}
          <TouchableOpacity
            style={[styles.googleButton, isLoading && styles.googleButtonDisabled]}
            onPress={handleGoogleLogin}
            activeOpacity={0.8}
            disabled={isLoading}
          >
            {loadingProvider === 'google' ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#4285F4" />
                <Text style={styles.googleButtonText}>ログイン中...</Text>
              </View>
            ) : (
              <Text style={styles.googleButtonText}>Googleアカウントでログイン</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* フッター */}
        <View style={styles.footer}>
          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={handleOpenTerms}>
              <Text style={styles.footerLinkText}>利用規約</Text>
            </TouchableOpacity>
            <Text style={styles.footerSpacer}>{'    '}</Text>
            <TouchableOpacity onPress={handleOpenPrivacy}>
              <Text style={styles.footerLinkText}>プライバシーポリシー</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  animationContainer: {
    alignItems: 'center',
    marginTop: 20,
    height: 280,
  },
  animation: {
    width: 320,
    height: 280,
  },
  catchCopySection: {
    marginTop: 8,
  },
  catchCopyLine: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    lineHeight: 34,
  },
  loginSection: {
    alignItems: 'center',
    marginTop: 24,
    gap: 12,
  },
  appleButton: {
    width: '100%',
    height: 54,
  },
  googleButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 30,
    width: '100%',
    borderWidth: 2,
    borderColor: '#4285F4',
  },
  googleButtonDisabled: {
    opacity: 0.7,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4285F4',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footer: {
    alignItems: 'center',
    marginTop: 40,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerLinkText: {
    fontSize: 12,
    color: '#999999',
  },
  footerSpacer: {
    fontSize: 12,
  },
});
