import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Alert, AppState, AppStateStatus } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, updateDoc, Timestamp, getDoc } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';
import { useAuth } from '../../src/contexts/AuthContext';
import { useDashboardData } from '../../src/hooks/useDashboardData';
import { shouldPostGoalTweet, postGoalTweet } from '../../src/lib/goalTweetService';
import { hasPushedToday, fetchTodayPushEvents, countTotalCommits } from '../../src/lib/github';
import { sendPushDetectedNotification } from '../../src/lib/notificationService';
import { saveDailyLog, formatDateString, updateUserBadges } from '../../src/lib/firestoreService';
import { checkEarnableBadges } from '../../src/lib/dailyCheck';
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
const timestampToDateString = (timestamp: Timestamp | Date | null | undefined): string | null => {
  if (!timestamp) return null;

  let date: Date;
  if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else if (typeof timestamp === 'object' && 'seconds' in timestamp) {
    // Firestore Timestamp形式のオブジェクト
    date = new Date((timestamp as { seconds: number }).seconds * 1000);
  } else {
    console.warn('Unknown timestamp format:', timestamp);
    return null;
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// 既存の統計に基づいてバッジを計算する関数
const computeBadgesFromStats = (
  currentStreak: number,
  longestStreak: number,
  totalStudyDays: number,
  totalSkipDays: number,
  existingBadges: string[]
): string[] => {
  const badgesToAdd: string[] = [];
  const existingSet = new Set(existingBadges);

  // 連続学習日数バッジ（現在のストリークまたは最長記録のいずれか大きい方で判定）
  const maxStreak = Math.max(currentStreak, longestStreak);
  const streakThresholds = [3, 5, 10, 15, 20, 25, 30, 35, 40, 50];
  for (const threshold of streakThresholds) {
    const badgeId = `streak_${threshold}`;
    if (maxStreak >= threshold && !existingSet.has(badgeId)) {
      badgesToAdd.push(badgeId);
    }
  }

  // 累計学習日数バッジ
  const totalStudyThresholds = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  for (const threshold of totalStudyThresholds) {
    const badgeId = `total_${threshold}`;
    if (totalStudyDays >= threshold && !existingSet.has(badgeId)) {
      badgesToAdd.push(badgeId);
    }
  }

  // 累計サボり日数バッジ
  const totalSkipThresholds = [1, 3, 5, 10, 15, 20, 25, 30];
  for (const threshold of totalSkipThresholds) {
    const badgeId = `skip_${threshold}`;
    if (totalSkipDays >= threshold && !existingSet.has(badgeId)) {
      badgesToAdd.push(badgeId);
    }
  }

  return badgesToAdd;
};

export default function DashboardScreen() {
  const { user, updateUser } = useAuth();
  const { weekDays, loading, refresh } = useDashboardData(user?.uid, {
    username: user?.githubUsername || null,
    accessToken: user?.githubAccessToken || null,
  });
  const [refreshing, setRefreshing] = useState(false);
  const goalTweetAttempted = useRef(false);
  const pushCheckAttempted = useRef(false);
  const badgeSyncAttempted = useRef(false);
  const appState = useRef(AppState.currentState);
  const lastCheckTime = useRef<number>(0);

  // GitHub push時に統計を更新する関数
  const updateStatsOnPush = useCallback(async (): Promise<Partial<UserStats> | null> => {
    if (!user) {
      console.log('updateStatsOnPush: user is null');
      return null;
    }

    const todayString = getTodayDateString();
    const yesterdayString = getYesterdayDateString();
    const lastStudyDateString = timestampToDateString(user.stats.lastStudyDate);

    console.log('updateStatsOnPush: todayString =', todayString);
    console.log('updateStatsOnPush: lastStudyDateString =', lastStudyDateString);

    // 既に今日更新済みの場合はスキップ
    if (lastStudyDateString === todayString) {
      console.log('updateStatsOnPush: already updated today, skipping');
      return null;
    }

    // 新しい統計を計算
    const today = new Date();
    const currentMonth = today.getMonth();
    const lastStudyDate = user.stats.lastStudyDate?.toDate?.();
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

    console.log('updateStatsOnPush: newStats =', JSON.stringify(newStats, null, 2));

    try {
      // push回数を取得
      let pushCount = 0;
      if (user.githubUsername && user.githubAccessToken) {
        try {
          const events = await fetchTodayPushEvents(user.githubUsername, user.githubAccessToken);
          pushCount = countTotalCommits(events);
        } catch (e) {
          console.log('updateStatsOnPush: failed to get push count', e);
        }
      }

      // DailyLogを作成（今週の学習カレンダーに反映させるため）
      const dateString = formatDateString(today);
      await saveDailyLog({
        userId: user.uid,
        date: dateString,
        hasPushed: true,
        pushCount,
        pushedAt: Timestamp.fromDate(today),
        skipped: false,
        tweetedSkip: false,
        tweetedStreak: false,
        streakMilestone: null,
      });
      console.log('updateStatsOnPush: DailyLog created for', dateString);

      // バッジをチェックして付与
      const newBadges = checkEarnableBadges(user, newStreak, false);
      console.log('updateStatsOnPush: newBadges =', newBadges);

      // Firestoreを更新
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        'stats.currentMonthStudyDays': newStats.currentMonthStudyDays,
        'stats.totalStudyDays': newStats.totalStudyDays,
        'stats.currentStreak': newStats.currentStreak,
        'stats.longestStreak': newStats.longestStreak,
        'stats.lastStudyDate': newStats.lastStudyDate,
      });

      console.log('updateStatsOnPush: Firestore stats updated successfully');

      // 新しいバッジがあれば追加
      if (newBadges.length > 0) {
        await updateUserBadges(user.uid, newBadges);
        console.log('updateStatsOnPush: badges updated');
      }

      // Firestoreから最新データを再取得してローカル状態を更新
      const updatedDoc = await getDoc(userRef);
      if (updatedDoc.exists()) {
        const updatedData = updatedDoc.data();
        console.log('updateStatsOnPush: fetched updated data =', JSON.stringify(updatedData.stats, null, 2));
        updateUser({
          stats: updatedData.stats,
          badges: updatedData.badges || [],
        });
      }

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

  // 既存の統計に基づいてバッジを同期（初回ロード時）
  useEffect(() => {
    const syncBadges = async () => {
      if (!user || badgeSyncAttempted.current) {
        return;
      }

      // user.statsが存在するまで待つ
      if (!user.stats) {
        return;
      }

      badgeSyncAttempted.current = true;

      const { currentStreak, longestStreak, totalStudyDays, totalSkipDays } = user.stats;
      const existingBadges = user.badges || [];

      // 統計に基づいて獲得すべきバッジを計算
      const badgesToAdd = computeBadgesFromStats(
        currentStreak || 0,
        longestStreak || 0,
        totalStudyDays || 0,
        totalSkipDays || 0,
        existingBadges
      );

      console.log('syncBadges: existing badges =', existingBadges);
      console.log('syncBadges: badges to add =', badgesToAdd);

      if (badgesToAdd.length > 0) {
        try {
          // Firestoreにバッジを追加
          await updateUserBadges(user.uid, badgesToAdd);

          // ローカル状態を更新
          const userRef = doc(db, 'users', user.uid);
          const updatedDoc = await getDoc(userRef);
          if (updatedDoc.exists()) {
            const updatedData = updatedDoc.data();
            updateUser({
              badges: updatedData.badges || [],
            });
          }

          console.log('syncBadges: badges synced successfully');
        } catch (error) {
          console.error('syncBadges: failed to sync badges', error);
        }
      }
    };

    syncBadges();
  }, [user, updateUser]);

  // GitHub push検出と統計更新（統計更新と通知を分離）
  useEffect(() => {
    const checkGitHubPush = async () => {
      console.log('=== checkGitHubPush START ===');

      if (!user) {
        console.log('checkGitHubPush: user is null, skipping');
        return;
      }

      console.log('checkGitHubPush: user.githubLinked =', user.githubLinked);
      console.log('checkGitHubPush: user.githubUsername =', user.githubUsername);
      console.log('checkGitHubPush: user.githubAccessToken exists =', !!user.githubAccessToken);

      // GitHub連携がない場合はスキップ
      if (!user.githubLinked || !user.githubUsername || !user.githubAccessToken) {
        console.log('checkGitHubPush: GitHub not linked, skipping');
        return;
      }

      // 既に今日の統計が更新済みかチェック
      const todayString = getTodayDateString();
      const lastStudyDateString = timestampToDateString(user.stats.lastStudyDate);

      console.log('checkGitHubPush: todayString =', todayString);
      console.log('checkGitHubPush: lastStudyDateString =', lastStudyDateString);

      // 今日既に更新済みの場合はスキップ
      if (lastStudyDateString === todayString) {
        console.log('checkGitHubPush: already updated today, skipping');
        pushCheckAttempted.current = true;
        return;
      }

      // 統計が未更新の場合はpushCheckAttemptedをリセットして再チェック
      // これにより、pushした後にアプリを開いても確実にチェックされる
      if (pushCheckAttempted.current && lastStudyDateString !== todayString) {
        console.log('checkGitHubPush: stats not updated yet, resetting flag for recheck');
        pushCheckAttempted.current = false;
      }

      // 一度チェック済みの場合はスキップ
      if (pushCheckAttempted.current) {
        console.log('checkGitHubPush: already attempted and up to date, skipping');
        return;
      }

      pushCheckAttempted.current = true;
      console.log('checkGitHubPush: calling hasPushedToday...');

      try {
        // GitHub pushをチェック
        const pushed = await hasPushedToday(user.githubUsername, user.githubAccessToken);

        console.log('checkGitHubPush: pushed =', pushed);

        if (pushed) {
          console.log('checkGitHubPush: push detected, updating stats...');
          // 統計を更新
          const newStats = await updateStatsOnPush();

          console.log('checkGitHubPush: newStats =', newStats ? JSON.stringify(newStats) : 'null');

          if (newStats) {
            // 今日の日付キー（通知済みかどうかの判定用）
            const today = new Date();
            const dateKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
            const storageKey = `github_push_notified_${user.uid}_${dateKey}`;

            // 既に今日通知済みかチェック
            const alreadyNotified = await AsyncStorage.getItem(storageKey);

            console.log('checkGitHubPush: alreadyNotified =', alreadyNotified);

            if (!alreadyNotified) {
              // 通知済みフラグを保存
              await AsyncStorage.setItem(storageKey, 'true');

              // 連続日数を取得（更新後の値を使用）
              const streakDays = newStats.currentStreak || 1;

              // iPhoneプッシュ通知を送信
              await sendPushDetectedNotification(streakDays);
              console.log('checkGitHubPush: push notification sent');

              // アプリ内アラートも表示
              Alert.alert(
                'お疲れ様でした！',
                streakDays > 1
                  ? `今日もGitHubにpushしました！\nこれで${streakDays}日連続です！`
                  : '今日もGitHubにpushしました！\n毎日の学習が力になります！'
              );
            }

            // ダッシュボードデータをリフレッシュ
            refresh();
          }
        } else {
          console.log('checkGitHubPush: no push detected today');
        }
      } catch (error) {
        console.error('GitHub push check error:', error);
        // エラー時は次回再チェックできるようにリセット
        pushCheckAttempted.current = false;
      }

      console.log('=== checkGitHubPush END ===');
    };

    checkGitHubPush();
  }, [user, updateStatsOnPush, refresh]);

  // アプリがフォアグラウンドに復帰したときにpushをチェック
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      // バックグラウンドからフォアグラウンドに復帰した場合
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('=== App became active, checking GitHub push ===');

        // 最後のチェックから30秒以上経過している場合のみチェック
        const now = Date.now();
        if (now - lastCheckTime.current < 30000) {
          console.log('Skipping check: too soon since last check');
          appState.current = nextAppState;
          return;
        }

        if (!user?.githubLinked || !user?.githubUsername || !user?.githubAccessToken) {
          appState.current = nextAppState;
          return;
        }

        // 今日既に統計更新済みかチェック
        const todayString = getTodayDateString();
        const lastStudyDateString = timestampToDateString(user.stats.lastStudyDate);

        if (lastStudyDateString === todayString) {
          console.log('Already updated today, skipping');
          appState.current = nextAppState;
          return;
        }

        lastCheckTime.current = now;
        pushCheckAttempted.current = false; // フラグをリセットして再チェックを許可

        try {
          console.log('Checking GitHub push on app resume...');
          const pushed = await hasPushedToday(user.githubUsername, user.githubAccessToken);

          if (pushed) {
            console.log('Push detected on app resume, updating stats...');
            const newStats = await updateStatsOnPush();

            if (newStats) {
              const today = new Date();
              const dateKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
              const storageKey = `github_push_notified_${user.uid}_${dateKey}`;

              const alreadyNotified = await AsyncStorage.getItem(storageKey);
              if (!alreadyNotified) {
                await AsyncStorage.setItem(storageKey, 'true');
                const streakDays = newStats.currentStreak || 1;

                // iPhoneプッシュ通知を送信
                await sendPushDetectedNotification(streakDays);

                // アプリ内アラートも表示
                Alert.alert(
                  'お疲れ様でした！',
                  streakDays > 1
                    ? `今日もGitHubにpushしました！\nこれで${streakDays}日連続です！`
                    : '今日もGitHubにpushしました！\n毎日の学習が力になります！'
                );
              }

              refresh();
            }
          }
        } catch (error) {
          console.error('GitHub push check on resume error:', error);
        }
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [user, updateStatsOnPush, refresh]);

  const onRefresh = useCallback(async () => {
    console.log('=== onRefresh START ===');
    setRefreshing(true);

    // Firestoreから最新のユーザーデータを取得
    let latestStats = user?.stats;
    if (user) {
      try {
        console.log('onRefresh: fetching latest user data from Firestore...');
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          latestStats = userData.stats;
          console.log('onRefresh: latest stats =', JSON.stringify(latestStats, null, 2));
          // ローカル状態を最新データで更新
          updateUser({
            stats: userData.stats,
          });
        }
      } catch (error) {
        console.error('Failed to refresh user data:', error);
      }
    }

    await refresh();

    // リフレッシュ時にGitHub pushもチェック（統計が未更新の場合のみ）
    if (user?.githubLinked && user?.githubUsername && user?.githubAccessToken) {
      try {
        const todayString = getTodayDateString();
        const lastStudyDateString = latestStats?.lastStudyDate
          ? timestampToDateString(latestStats.lastStudyDate)
          : null;

        console.log('onRefresh: todayString =', todayString);
        console.log('onRefresh: lastStudyDateString =', lastStudyDateString);

        // 今日既に更新済みの場合はスキップ
        if (lastStudyDateString === todayString) {
          console.log('onRefresh: already updated today, skipping');
          setRefreshing(false);
          return;
        }

        console.log('onRefresh: checking GitHub push...');
        const pushed = await hasPushedToday(user.githubUsername, user.githubAccessToken);
        console.log('onRefresh: pushed =', pushed);

        if (pushed) {
          // 統計を更新
          const newStats = await updateStatsOnPush();

          console.log('onRefresh: newStats =', newStats ? JSON.stringify(newStats) : 'null');

          if (newStats) {
            const today = new Date();
            const dateKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
            const storageKey = `github_push_notified_${user.uid}_${dateKey}`;

            const alreadyNotified = await AsyncStorage.getItem(storageKey);
            if (!alreadyNotified) {
              await AsyncStorage.setItem(storageKey, 'true');
              const streakDays = newStats.currentStreak || 1;

              // iPhoneプッシュ通知を送信
              await sendPushDetectedNotification(streakDays);
              console.log('onRefresh: push notification sent');

              // アプリ内アラートも表示
              Alert.alert(
                'お疲れ様でした！',
                streakDays > 1
                  ? `今日もGitHubにpushしました！\nこれで${streakDays}日連続です！`
                  : '今日もGitHubにpushしました！\n毎日の学習が力になります！'
              );
            }
          }
        }
      } catch (error) {
        console.error('GitHub push check error:', error);
      }
    }

    setRefreshing(false);
    console.log('=== onRefresh END ===');
  }, [refresh, user, updateStatsOnPush, updateUser]);

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
              {weekDays.map((day, index) => {
                // DailyLogからの学習状態のみを使用（実際のpush確認に基づく）
                const isStudied = day.hasStudied === true;

                return (
                  <View key={index} style={styles.dayColumn}>
                    <Text style={styles.dayName}>
                      {day.name}
                    </Text>
                    <View
                      style={[
                        styles.dayCircle,
                        isStudied && styles.dayCircleStudied,
                        day.isToday && !isStudied && styles.dayCircleToday,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayDate,
                          isStudied && styles.dayDateStudied,
                        ]}
                      >
                      {day.date}
                    </Text>
                  </View>
                </View>
                );
              })}
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
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCircleStudied: {
    backgroundColor: COLORS.accent,
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
