import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';
import { useAuth } from '../../src/contexts/AuthContext';

const PRIVACY_POLICY_URL = 'https://batugaku2-ad498.web.app/privacy-policy.html';
const TERMS_URL = 'https://batugaku2-ad498.web.app/terms-of-service.html';

export default function LoginScreen() {
  const { signInWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      console.log('=== Login Button Pressed ===');
      await signInWithGoogle();
      console.log('=== signInWithGoogle completed successfully ===');
      // ログイン成功時は_layout.tsxが自動的に次の画面に遷移させる
    } catch (error: any) {
      console.error('=== Login Error Caught ===');
      console.error('Error:', error);

      const errorMessage = error instanceof Error ? error.message : 'ログインに失敗しました';
      console.error('Error message to display:', errorMessage);

      // キャンセルの場合はアラートを表示しない
      if (!errorMessage.includes('キャンセル')) {
        Alert.alert(
          'ログインエラー',
          `${errorMessage}\n\n(Xcodeのコンソールで詳細なログを確認してください)`
        );
      }
    } finally {
      setIsLoading(false);
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
          <TouchableOpacity
            style={[styles.googleButton, isLoading && styles.googleButtonDisabled]}
            onPress={handleLogin}
            activeOpacity={0.8}
            disabled={isLoading}
          >
            {isLoading ? (
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
