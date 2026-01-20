import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import { COLORS, APP_NAME } from '../../src/constants';

export default function LoginScreen() {
  const { signInWithGoogle } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* ロゴ・タイトル */}
        <View style={styles.header}>
          <Text style={styles.title}>{APP_NAME}</Text>
          <Text style={styles.subtitle}>サボれない学習サポートアプリ</Text>
        </View>

        {/* コンセプト説明 */}
        <View style={styles.conceptBox}>
          <Text style={styles.conceptTitle}>あなたの「サボり」を</Text>
          <Text style={styles.conceptTitle}>フォロワーが監視</Text>
          <Text style={styles.conceptDescription}>
            GitHubにpushしないと{'\n'}
            Xに自動でサボり投稿されます
          </Text>
        </View>

        {/* ログインボタン */}
        <View style={styles.loginSection}>
          <TouchableOpacity
            style={styles.googleButton}
            onPress={signInWithGoogle}
            activeOpacity={0.8}
          >
            <View style={styles.googleIconContainer}>
              <Text style={styles.googleIcon}>G</Text>
            </View>
            <Text style={styles.googleButtonText}>Googleでログイン</Text>
          </TouchableOpacity>

          <Text style={styles.notice}>
            ログイン後、XとGitHubの連携が必要です
          </Text>
        </View>

        {/* フッター */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            ログインすることで利用規約に同意したものとみなします
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  conceptBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  conceptTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.accent,
    textAlign: 'center',
  },
  conceptDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
  loginSection: {
    alignItems: 'center',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    justifyContent: 'center',
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  googleIcon: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  notice: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 16,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
