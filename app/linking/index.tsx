import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import { COLORS } from '../../src/constants';

export default function LinkingScreen() {
  const { user, linkXAccount, linkGitHubAccount, signOut } = useAuth();
  const [xLoading, setXLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);

  const handleLinkX = async () => {
    setXLoading(true);
    try {
      await linkXAccount();
    } catch (error) {
      console.error('X連携エラー:', error);
      Alert.alert('エラー', 'X（Twitter）との連携に失敗しました。もう一度お試しください。');
    } finally {
      setXLoading(false);
    }
  };

  const handleLinkGitHub = async () => {
    setGithubLoading(true);
    try {
      await linkGitHubAccount();
    } catch (error) {
      console.error('GitHub連携エラー:', error);
      Alert.alert('エラー', 'GitHubとの連携に失敗しました。もう一度お試しください。');
    } finally {
      setGithubLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('ログアウトエラー:', error);
    }
  };

  const xLinked = user?.xLinked ?? false;
  const githubLinked = user?.githubLinked ?? false;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <Text style={styles.title}>アカウント連携</Text>
          <Text style={styles.subtitle}>
            バツガクを利用するには、XとGitHubの{'\n'}アカウント連携が必要です
          </Text>
        </View>

        {/* 説明 */}
        <View style={styles.descriptionContainer}>
          <View style={styles.descriptionItem}>
            <Text style={styles.descriptionIcon}>🐦</Text>
            <Text style={styles.descriptionText}>
              サボり投稿・達成投稿の自動投稿に使用します
            </Text>
          </View>
          <View style={styles.descriptionItem}>
            <Text style={styles.descriptionIcon}>🐙</Text>
            <Text style={styles.descriptionText}>
              GitHubへのpush状況を確認するために使用します
            </Text>
          </View>
        </View>

        {/* 連携ボタン */}
        <View style={styles.buttonsContainer}>
          {/* X連携ボタン */}
          <TouchableOpacity
            style={[
              styles.linkButton,
              xLinked ? styles.linkedButton : styles.unlinkedButton,
            ]}
            onPress={handleLinkX}
            disabled={xLinked || xLoading}
          >
            {xLoading ? (
              <ActivityIndicator size="small" color={COLORS.text} />
            ) : (
              <>
                <Text style={styles.buttonIcon}>🐦</Text>
                <Text style={[styles.linkButtonText, xLinked && styles.linkedText]}>
                  {xLinked ? 'X連携済み' : 'X（Twitter）と連携する'}
                </Text>
                {xLinked && <Text style={styles.checkIcon}>✅</Text>}
              </>
            )}
          </TouchableOpacity>

          {/* GitHub連携ボタン */}
          <TouchableOpacity
            style={[
              styles.linkButton,
              githubLinked ? styles.linkedButton : styles.unlinkedButton,
            ]}
            onPress={handleLinkGitHub}
            disabled={githubLinked || githubLoading}
          >
            {githubLoading ? (
              <ActivityIndicator size="small" color={COLORS.text} />
            ) : (
              <>
                <Text style={styles.buttonIcon}>🐙</Text>
                <Text style={[styles.linkButtonText, githubLinked && styles.linkedText]}>
                  {githubLinked
                    ? `GitHub連携済み（${user?.githubUsername || ''}）`
                    : 'GitHubと連携する'}
                </Text>
                {githubLinked && <Text style={styles.checkIcon}>✅</Text>}
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* 連携状態メッセージ */}
        <View style={styles.statusContainer}>
          {xLinked && githubLinked ? (
            <View style={styles.completeMessage}>
              <Text style={styles.completeIcon}>✅</Text>
              <Text style={styles.completeText}>連携完了！</Text>
              <Text style={styles.completeSubtext}>次のステップへ進みます...</Text>
            </View>
          ) : (
            <Text style={styles.statusText}>
              {!xLinked && !githubLinked
                ? '両方のアカウントを連携してください'
                : !xLinked
                  ? 'Xアカウントを連携してください'
                  : 'GitHubアカウントを連携してください'}
            </Text>
          )}
        </View>

        {/* ログアウトボタン */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>別のアカウントでログインする</Text>
        </TouchableOpacity>
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
    paddingTop: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  descriptionContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
  },
  descriptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    gap: 12,
  },
  descriptionIcon: {
    fontSize: 24,
  },
  descriptionText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  buttonsContainer: {
    gap: 16,
    marginBottom: 32,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  unlinkedButton: {
    backgroundColor: COLORS.accent,
  },
  linkedButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.success,
  },
  buttonIcon: {
    fontSize: 24,
  },
  linkButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  linkedText: {
    color: COLORS.success,
  },
  checkIcon: {
    fontSize: 20,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  statusText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  completeMessage: {
    alignItems: 'center',
    gap: 8,
  },
  completeIcon: {
    fontSize: 32,
  },
  completeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  completeSubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  signOutButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  signOutText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textDecorationLine: 'underline',
  },
});
