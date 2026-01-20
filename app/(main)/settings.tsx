import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useAuth } from '../../src/contexts/AuthContext';
import { COLORS } from '../../src/constants';

export default function SettingsScreen() {
  const { user, signOut, linkXAccount, linkGitHubAccount, unlinkXAccount, unlinkGitHubAccount } = useAuth();
  const [linkingGitHub, setLinkingGitHub] = useState(false);
  const [linkingX, setLinkingX] = useState(false);

  const handleSignOut = () => {
    Alert.alert(
      'ログアウト',
      'ログアウトしますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: 'ログアウト', style: 'destructive', onPress: signOut },
      ]
    );
  };

  const handleLinkX = async () => {
    setLinkingX(true);
    try {
      await linkXAccount();
    } catch (error) {
      Alert.alert('エラー', 'X連携に失敗しました');
    } finally {
      setLinkingX(false);
    }
  };

  const handleUnlinkX = () => {
    Alert.alert(
      'X連携解除',
      'X連携を解除すると、サボりツイートの自動投稿ができなくなります。解除しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '解除',
          style: 'destructive',
          onPress: async () => {
            try {
              await unlinkXAccount();
              Alert.alert('完了', 'X連携を解除しました');
            } catch (error) {
              Alert.alert('エラー', 'X連携解除に失敗しました');
            }
          },
        },
      ]
    );
  };

  const handleLinkGitHub = async () => {
    setLinkingGitHub(true);
    try {
      await linkGitHubAccount();
    } catch (error) {
      Alert.alert('エラー', 'GitHub連携に失敗しました');
    } finally {
      setLinkingGitHub(false);
    }
  };

  const handleUnlinkGitHub = () => {
    Alert.alert(
      'GitHub連携解除',
      'GitHub連携を解除すると、日次チェック機能が使えなくなります。解除しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '解除',
          style: 'destructive',
          onPress: async () => {
            try {
              await unlinkGitHubAccount();
              Alert.alert('完了', 'GitHub連携を解除しました');
            } catch (error) {
              Alert.alert('エラー', 'GitHub連携解除に失敗しました');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* プロフィール */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>プロフィール</Text>
          <View style={styles.card}>
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user?.displayName?.charAt(0) || '?'}
                </Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{user?.displayName || '名前未設定'}</Text>
                <Text style={styles.profileEmail}>{user?.email}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 目標設定 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>目標設定</Text>
          <View style={styles.card}>
            {user?.goal ? (
              <>
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>目標収入</Text>
                  <Text style={styles.settingValue}>
                    {user.goal.incomeType === 'monthly' ? '月収' : '年収'}
                    {user.goal.targetIncome}万円
                  </Text>
                </View>
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>学習スキル</Text>
                  <Text style={styles.settingValue}>
                    {user.goal.skills.join(', ')}
                  </Text>
                </View>
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>目標期限</Text>
                  <Text style={styles.settingValue}>
                    {user.goal.deadline?.toDate?.()?.toLocaleDateString('ja-JP') || '未設定'}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={styles.notSetText}>目標が設定されていません</Text>
            )}
            <TouchableOpacity style={styles.editButton}>
              <Text style={styles.editButtonText}>目標を編集</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* アカウント連携 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>アカウント連携</Text>
          <View style={styles.card}>
            {/* GitHub連携 */}
            <View style={styles.connectionRow}>
              <View style={styles.connectionInfo}>
                <Text style={styles.connectionLabel}>GitHub</Text>
                <Text style={[
                  styles.connectionStatus,
                  user?.githubLinked && styles.connectionStatusLinked
                ]}>
                  {user?.githubLinked
                    ? `@${user.githubUsername}`
                    : '未連携 - pushの監視に必要です'}
                </Text>
              </View>
              {linkingGitHub ? (
                <ActivityIndicator size="small" color={COLORS.accent} />
              ) : user?.githubLinked ? (
                <TouchableOpacity style={styles.unlinkButton} onPress={handleUnlinkGitHub}>
                  <Text style={styles.unlinkButtonText}>解除</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.linkButton} onPress={handleLinkGitHub}>
                  <Text style={styles.linkButtonText}>連携</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* X連携 */}
            <View style={[styles.connectionRow, { borderBottomWidth: 0 }]}>
              <View style={styles.connectionInfo}>
                <Text style={styles.connectionLabel}>X (Twitter)</Text>
                <Text style={[
                  styles.connectionStatus,
                  user?.xLinked && styles.connectionStatusLinked
                ]}>
                  {user?.xLinked
                    ? '連携済み'
                    : '未連携 - 自動投稿に必要です'}
                </Text>
              </View>
              {linkingX ? (
                <ActivityIndicator size="small" color={COLORS.accent} />
              ) : user?.xLinked ? (
                <TouchableOpacity style={styles.unlinkButton} onPress={handleUnlinkX}>
                  <Text style={styles.unlinkButtonText}>解除</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.linkButton} onPress={handleLinkX}>
                  <Text style={styles.linkButtonText}>連携</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* 通知設定 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>通知設定</Text>
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <Text style={styles.settingLabel}>プッシュ通知</Text>
              <Switch
                value={user?.notificationsEnabled}
                onValueChange={() => {}}
                trackColor={{ false: COLORS.border, true: COLORS.accent }}
                thumbColor={COLORS.text}
              />
            </View>
          </View>
        </View>

        {/* アカウント */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>アカウント</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.dangerButton} onPress={handleSignOut}>
              <Text style={styles.dangerButtonText}>ログアウト</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* アプリ情報 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>アプリ情報</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>バージョン</Text>
              <Text style={styles.settingValue}>1.0.0</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  profileInfo: {
    marginLeft: 12,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  profileEmail: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingLabel: {
    fontSize: 14,
    color: COLORS.text,
  },
  settingValue: {
    fontSize: 14,
    color: COLORS.textSecondary,
    maxWidth: '60%',
    textAlign: 'right',
  },
  notSetText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: 8,
  },
  editButton: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.accent,
  },
  connectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  connectionInfo: {
    flex: 1,
  },
  connectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  connectionStatus: {
    fontSize: 12,
    color: COLORS.warning,
    marginTop: 2,
  },
  connectionStatusLinked: {
    color: COLORS.success,
  },
  linkButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  linkButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  unlinkButton: {
    backgroundColor: 'transparent',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  unlinkButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.error,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dangerButton: {
    backgroundColor: COLORS.error,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dangerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
});
