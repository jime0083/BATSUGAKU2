import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';
import { useAuth } from '../../src/contexts/AuthContext';
import { useDashboardData } from '../../src/hooks/useDashboardData';
import { shouldPostGoalTweet, postGoalTweet } from '../../src/lib/goalTweetService';
import { hasPushedToday } from '../../src/lib/github';
import { UserStats } from '../../src/types';

// 統一カラーパレット
const COLORS = {
  background: '#FFFFFF',
  surface: '#F5F5F5',
  text: '#000000',
  textSecondary: '#666666',
  accent: '#4285F4',
  border: '#E0E0E0',
  success: '#4CAF50',
  error: '#F44336',
};

// 今日の日付文字列を取得（YYYY-MM-DD形式）
const getTodayDateString = (): string => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

// 昨日の日付文字列を取得
const getYesterdayDateString = (): string => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
};

// TimestampからYYYY-MM-DD形式の文字列を取得
const timestampToDateString = (timestamp: Timestamp | null): string | null => {
  if (!timestamp) return null;
  const date = timestamp.toDate();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export default function DashboardScreen() {
  const { user, updateUser } = useAuth();
  const { weekDays, loading, refresh } = useDashboardData(user?.uid);
  const [refreshing, setRefreshing] = useState(false);
  const goalTweetAttempted = useRef(false);
  const pushCheckAttempted = useRef(false);

  // GitHub push時に統計を更新する関数
  const updateStatsOnPush = useCallback(async () => {
    if (!user) return null;

    const todayString = getTodayDateString();
    const yesterdayString = getYesterdayDateString();
    const lastStudyDateString = timestampToDateString(user.stats.lastStudyDate);

    // 既に今日更新済みの場合はスキップ
    if (lastStudyDateString === todayString) {
      return null;
    }

    // 新しい統計を計算
    const today = new Date();
    const currentMonth = today.getMonth();
    const lastStudyDate = user.stats.lastStudyDate?.toDate();
    const lastStudyMonth = lastStudyDate?.getMonth();

    // 連続日数を計算
    let newStreak = 1;
    if (lastStudyDateString === yesterdayString) {
      // 昨日も学習していた場合、連続を継続
      newStreak = (user.stats.currentStreak || 0) + 1;
    }

    // 今月の学習日数（月が変わっていたらリセット）
    let newMonthStudyDays = user.stats.currentMonthStudyDays || 0;
    if (lastStudyMonth !== currentMonth) {
      newMonthStudyDays = 1;
    } else {
      newMonthStudyDays += 1;
    }

    const newStats: Partial<UserStats> = {
      currentMonthStudyDays: newMonthStudyDays,
      totalStudyDays: (user.stats.totalStudyDays || 0) + 1,
      currentStreak: newStreak,
      longestStreak: Math.max(user.stats.longestStreak || 0, newStreak),
      lastStudyDate: Timestamp.fromDate(today),
    };

    try {
      // Firestoreを更新
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        'stats.currentMonthStudyDays': newStats.currentMonthStudyDays,
        'stats.totalStudyDays': newStats.totalStudyDays,
        'stats.currentStreak': newStats.currentStreak,
        'stats.longestStreak': newStats.longestStreak,
        'stats.lastStudyDate': newStats.lastStudyDate,
      });

      // ローカル状態を更新
      updateUser({
        stats: {
          ...user.stats,
          ...newStats,
        },
      });

      return newStats;
    } catch (error) {
      console.error('Failed to update stats:', error);
      return null;
    }
  }, [user, updateUser]);

  // 初回目標投稿（サブスク完了後に自動実行）
  useEffect(() => {
    const postInitialGoalTweet = async () => {
      if (!user || goalTweetAttempted.current) {
        return;
      }

      if (shouldPostGoalTweet(user)) {
        goalTweetAttempted.current = true;
        const result = await postGoalTweet(user);

        if (result.success) {
          Alert.alert(
            '目標を宣言しました！',
            'Xに目標宣言ツイートを投稿しました。毎日サボらず頑張りましょう！'
          );
        } else if (result.error) {
          Alert.alert('投稿エラー', result.error);
        }
      }
    };

    postInitialGoalTweet();
  }, [user]);

  // GitHub push検出と通知・統計更新
  useEffect(() => {
    const checkGitHubPush = async () => {
      if (!user || pushCheckAttempted.current) {
        return;
      }

      // GitHub連携がない場合はスキップ
      if (!user.githubLinked || !user.githubUsername || !user.githubAccessToken) {
        return;
      }

      pushCheckAttempted.current = true;

      try {
        // 今日の日付キー（通知済みかどうかの判定用）
        const today = new Date();
        const dateKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
        const storageKey = `github_push_notified_${user.uid}_${dateKey}`;

        // 既に今日通知済みかチェック
        const alreadyNotified = await AsyncStorage.getItem(storageKey);
        if (alreadyNotified) {
          return;
        }

        // GitHub pushをチェック
        const pushed = await hasPushedToday(user.githubUsername, user.githubAccessToken);

        if (pushed) {
          // 統計を更新
          const newStats = await updateStatsOnPush();

          // 通知済みフラグを保存
          await AsyncStorage.setItem(storageKey, 'true');

          // 連続日数を取得（更新後の値を使用）
          const streakDays = newStats?.currentStreak || (user.stats.currentStreak || 0) + 1;

          // 達成通知を表示
          Alert.alert(
            'お疲れ様でした！🎉',
            streakDays > 1
              ? `今日もGitHubにpushしました！\nこれで${streakDays}日連続です！`
              : '今日もGitHubにpushしました！\n毎日の学習が力になります！'
          );

          // ダッシュボードデータをリフレッシュ
          refresh();
        }
      } catch (error) {
        console.error('GitHub push check error:', error);
      }
    };

    checkGitHubPush();
  }, [user, updateStatsOnPush, refresh]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();

    // リフレッシュ時にGitHub pushもチェック
    if (user?.githubLinked && user?.githubUsername && user?.githubAccessToken) {
      try {
        const today = new Date();
        const dateKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
        const storageKey = `github_push_notified_${user.uid}_${dateKey}`;

        const alreadyNotified = await AsyncStorage.getItem(storageKey);
        if (!alreadyNotified) {
          const pushed = await hasPushedToday(user.githubUsername, user.githubAccessToken);
          if (pushed) {
            // 統計を更新
            const newStats = await updateStatsOnPush();

            await AsyncStorage.setItem(storageKey, 'true');
            const streakDays = newStats?.currentStreak || (user.stats.currentStreak || 0) + 1;
            Alert.alert(
              'お疲れ様でした！🎉',
              streakDays > 1
                ? `今日もGitHubにpushしました！\nこれで${streakDays}日連続です！`
                : '今日もGitHubにpushしました！\n毎日の学習が力になります！'
            );
          }
        }
      } catch (error) {
        console.error('GitHub push check error:', error);
      }
    }

    setRefreshing(false);
  }, [refresh, user, updateStatsOnPush]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* ユーザー情報 */}
        <View style={styles.userSection}>
          <Text style={styles.greeting}>
            こんにちは、{user?.displayName || 'ユーザー'}さん
          </Text>
          {user?.goal && (
            <Text style={styles.goalText}>
              {(() => {
                const deadline = user.goal.deadline?.toDate?.();
                const year = deadline?.getFullYear() || '';
                const month = deadline ? deadline.getMonth() + 1 : '';
                const skills = user.goal.skills?.join('、') || '';
                const incomeType = user.goal.incomeType === 'monthly' ? '月収' : '年収';
                const income = user.goal.targetIncome || 0;
                return `${year}年${month}月までに${skills}で${incomeType}${income}万円`;
              })()}
            </Text>
          )}
        </View>

        {/* 連続日数 */}
        <View style={styles.streakCard}>
          <Text style={styles.streakLabel}>現在の連続学習日数</Text>
          <View style={styles.streakValueContainer}>
            <Text style={styles.streakValue}>{user?.stats.currentStreak || 0}</Text>
            <Text style={styles.streakUnit}>日</Text>
          </View>
          <Text style={styles.streakSubtext}>
            最長記録: {user?.stats.longestStreak || 0}日
          </Text>
        </View>

        {/* 今週の学習状況 */}
        <View style={styles.weekCard}>
          <Text style={styles.sectionTitle}>今週の学習</Text>
          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={COLORS.accent} />
            </View>
          ) : (
            <View style={styles.weekDays}>
              {weekDays.map((day, index) => (
                <View key={index} style={styles.dayColumn}>
                  <Text style={[styles.dayName, day.isToday && styles.todayText]}>
                    {day.name}
                  </Text>
                  <View
                    style={[
                      styles.dayCircle,
                      day.hasStudied === true && styles.dayCircleStudied,
                      day.hasStudied === false && styles.dayCircleSkipped,
                      day.isToday && styles.dayCircleToday,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayDate,
                        day.hasStudied === true && styles.dayDateStudied,
                        day.hasStudied === false && styles.dayDateSkipped,
                      ]}
                    >
                      {day.date}
                    </Text>
                  </View>
                  {day.hasStudied === true && <Text style={styles.checkMark}>✓</Text>}
                  {day.hasStudied === false && <Text style={styles.skipMark}>✗</Text>}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 統計カード */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statValueContainer}>
              <Text style={styles.statValue}>{user?.stats.currentMonthStudyDays || 0}</Text>
              <Text style={styles.statUnit}>日</Text>
            </View>
            <Text style={styles.statLabel}>今月の学習日数</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statValueContainer}>
              <Text style={styles.statValue}>{user?.stats.currentMonthSkipDays || 0}</Text>
              <Text style={styles.statUnit}>日</Text>
            </View>
            <Text style={styles.statLabel}>今月のサボり日数</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statValueContainer}>
              <Text style={styles.statValue}>{user?.stats.totalStudyDays || 0}</Text>
              <Text style={styles.statUnit}>日</Text>
            </View>
            <Text style={styles.statLabel}>累計学習日数</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statValueContainer}>
              <Text style={styles.statValue}>{user?.stats.totalSkipDays || 0}</Text>
              <Text style={styles.statUnit}>日</Text>
            </View>
            <Text style={styles.statLabel}>累計サボり日数</Text>
          </View>
        </View>

        {/* 連携状態 */}
        <View style={styles.connectionCard}>
          <Text style={styles.sectionTitle}>連携状態</Text>
          <View style={styles.connectionRow}>
            <Text style={styles.connectionLabel}>GitHub</Text>
            <Text style={[styles.connectionStatus, user?.githubLinked && styles.connected]}>
              {user?.githubLinked ? `連携済み (@${user.githubUsername})` : '未連携'}
            </Text>
          </View>
          <View style={[styles.connectionRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.connectionLabel}>X (Twitter)</Text>
            <Text style={[styles.connectionStatus, user?.xLinked && styles.connected]}>
              {user?.xLinked ? '連携済み' : '未連携'}
            </Text>
          </View>
        </View>
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
  userSection: {
    marginTop: 16,
    marginBottom: 24,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  goalText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  streakCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  streakLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  streakValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  streakValue: {
    fontSize: 64,
    fontWeight: 'bold',
    color: COLORS.accent,
  },
  streakUnit: {
    fontSize: 24,
    color: COLORS.accent,
    marginLeft: 4,
  },
  streakSubtext: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  weekCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayColumn: {
    alignItems: 'center',
    flex: 1,
  },
  dayName: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  todayText: {
    color: COLORS.accent,
    fontWeight: 'bold',
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dayCircleStudied: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  dayCircleSkipped: {
    backgroundColor: COLORS.error,
    borderColor: COLORS.error,
  },
  dayCircleToday: {
    borderColor: COLORS.accent,
    borderWidth: 2,
  },
  dayDate: {
    fontSize: 14,
    color: COLORS.text,
  },
  dayDateStudied: {
    color: '#FFFFFF',
  },
  dayDateSkipped: {
    color: '#FFFFFF',
  },
  checkMark: {
    fontSize: 12,
    color: COLORS.success,
    marginTop: 4,
  },
  skipMark: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: 4,
  },
  loadingContainer: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  statValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statUnit: {
    fontSize: 16,
    color: COLORS.text,
    marginLeft: 2,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  connectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 32,
  },
  connectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  connectionLabel: {
    fontSize: 14,
    color: COLORS.text,
  },
  connectionStatus: {
    fontSize: 12,
    color: COLORS.error,
  },
  connected: {
    color: COLORS.success,
  },
});
