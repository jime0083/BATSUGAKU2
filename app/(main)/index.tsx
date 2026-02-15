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
import { postAchievementTweetsAfterDailyCheck } from '../../src/lib/achievementTweetService';
import { PushSuccessModal, AchievementType } from '../../src/components/PushSuccessModal';

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
  const [showPushSuccessModal, setShowPushSuccessModal] = useState(false);
  const [modalAchievementType, setModalAchievementType] = useState<AchievementType>('normal');
  const [modalStreakDays, setModalStreakDays] = useState(0);
  const [modalTotalDays, setModalTotalDays] = useState(0);
  const goalTweetAttempted = useRef(false);
  const pushCheckAttempted = useRef(false);
  const badgeSyncAttempted = useRef(false);
  const appState = useRef(AppState.currentState);
  const lastCheckTime = useRef<number>(0);

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

  // GitHub pushをチェックして統計を更新する関数
  const checkAndUpdateGitHubPush = useCallback(async (forceCheck: boolean = false) => {
    console.log('=== checkAndUpdateGitHubPush START ===');
    console.log('forceCheck =', forceCheck);

    if (!user) {
      console.log('checkAndUpdateGitHubPush: user is null, skipping');
      return false;
    }

    // GitHub連携がない場合はスキップ
    if (!user.githubLinked || !user.githubUsername || !user.githubAccessToken) {
      console.log('checkAndUpdateGitHubPush: GitHub not linked, skipping');
      return false;
    }

    try {
      // Firestoreから最新のユーザーデータを取得（stale state問題を回避）
      const userRef = doc(db, 'users', user.uid);
      const latestUserDoc = await getDoc(userRef);
      if (!latestUserDoc.exists()) {
        console.log('checkAndUpdateGitHubPush: user doc not found');
        return false;
      }
      const latestUserData = latestUserDoc.data();
      const latestStats = latestUserData.stats || {};

      const todayString = getTodayDateString();
      const lastStudyDateString = timestampToDateString(latestStats.lastStudyDate);

      console.log('checkAndUpdateGitHubPush: todayString =', todayString);
      console.log('checkAndUpdateGitHubPush: lastStudyDateString (from Firestore) =', lastStudyDateString);
      console.log('checkAndUpdateGitHubPush: currentStreak (from Firestore) =', latestStats.currentStreak);

      // 強制チェックでない場合、今日既に更新済みならスキップ
      if (!forceCheck && lastStudyDateString === todayString) {
        console.log('checkAndUpdateGitHubPush: already updated today, skipping');
        // ローカル状態も最新に更新
        updateUser({
          stats: latestStats,
          badges: latestUserData.badges || [],
        });
        return false;
      }

      console.log('checkAndUpdateGitHubPush: calling hasPushedToday...');
      const pushed = await hasPushedToday(user.githubUsername, user.githubAccessToken);
      console.log('checkAndUpdateGitHubPush: pushed =', pushed);

      if (pushed) {
        // 今日既に統計更新済みの場合は統計更新をスキップ（ただしモーダル表示とカレンダーリフレッシュは行う）
        if (lastStudyDateString === todayString) {
          console.log('checkAndUpdateGitHubPush: push detected but stats already updated');
          // ローカル状態を最新に更新
          updateUser({
            stats: latestStats,
            badges: latestUserData.badges || [],
          });

          // 今日まだモーダルを表示していない場合は表示
          const dateKey = getTodayDateString();
          const storageKey = `github_push_notified_${user.uid}_${dateKey}`;
          const alreadyNotified = await AsyncStorage.getItem(storageKey);

          if (!alreadyNotified) {
            await AsyncStorage.setItem(storageKey, 'true');

            // 通知を送信
            const streakDays = latestStats.currentStreak || 1;
            await sendPushDetectedNotification(streakDays);
            console.log('checkAndUpdateGitHubPush: push notification sent with streak =', streakDays);

            // モーダルを表示（統計は既に更新済みなので、通常の達成タイプ）
            setModalAchievementType('normal');
            setModalStreakDays(streakDays);
            setModalTotalDays(latestStats.totalStudyDays || 0);
            setShowPushSuccessModal(true);
            console.log('checkAndUpdateGitHubPush: showing success modal (stats already updated)');
          }

          await refresh();
          return true;
        }

        console.log('checkAndUpdateGitHubPush: push detected, updating stats...');

        // 統計を計算（最新のFirestoreデータを使用）
        const yesterdayString = getYesterdayDateString();
        const today = new Date();
        const currentMonth = today.getMonth();

        // lastStudyDateの月を取得
        let lastStudyMonth: number | undefined;
        if (latestStats.lastStudyDate) {
          let lastDate: Date;
          if (typeof latestStats.lastStudyDate.toDate === 'function') {
            lastDate = latestStats.lastStudyDate.toDate();
          } else if (latestStats.lastStudyDate.seconds) {
            lastDate = new Date(latestStats.lastStudyDate.seconds * 1000);
          } else {
            lastDate = new Date(latestStats.lastStudyDate);
          }
          lastStudyMonth = lastDate.getMonth();
        }

        // 連続日数を計算
        let newStreak = 1;
        console.log('checkAndUpdateGitHubPush: comparing lastStudyDateString =', lastStudyDateString, 'with yesterdayString =', yesterdayString);
        if (lastStudyDateString === yesterdayString) {
          // 昨日も学習していた場合、連続を継続
          newStreak = (latestStats.currentStreak || 0) + 1;
          console.log('checkAndUpdateGitHubPush: consecutive day detected, new streak =', newStreak);
        } else {
          console.log('checkAndUpdateGitHubPush: streak reset to 1 (lastStudyDate != yesterday)');
        }
        console.log('checkAndUpdateGitHubPush: calculated newStreak =', newStreak);

        // 今月の学習日数（月が変わっていたらリセット）
        let newMonthStudyDays = latestStats.currentMonthStudyDays || 0;
        if (lastStudyMonth !== currentMonth) {
          newMonthStudyDays = 1;
        } else {
          newMonthStudyDays += 1;
        }

        const newStats = {
          currentMonthStudyDays: newMonthStudyDays,
          totalStudyDays: (latestStats.totalStudyDays || 0) + 1,
          currentStreak: newStreak,
          longestStreak: Math.max(latestStats.longestStreak || 0, newStreak),
          lastStudyDate: Timestamp.fromDate(today),
        };

        console.log('checkAndUpdateGitHubPush: newStats =', JSON.stringify(newStats, null, 2));

        // push回数を取得
        let pushCount = 0;
        try {
          const events = await fetchTodayPushEvents(user.githubUsername, user.githubAccessToken);
          pushCount = countTotalCommits(events);
        } catch (e) {
          console.log('checkAndUpdateGitHubPush: failed to get push count', e);
        }

        // DailyLogを作成
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
        console.log('checkAndUpdateGitHubPush: DailyLog created for', dateString);

        // バッジをチェック
        const newBadges = computeBadgesFromStats(
          newStreak,
          newStats.longestStreak,
          newStats.totalStudyDays,
          latestStats.totalSkipDays || 0,
          latestUserData.badges || []
        );
        console.log('checkAndUpdateGitHubPush: newBadges =', newBadges);

        // Firestoreを更新
        await updateDoc(userRef, {
          'stats.currentMonthStudyDays': newStats.currentMonthStudyDays,
          'stats.totalStudyDays': newStats.totalStudyDays,
          'stats.currentStreak': newStats.currentStreak,
          'stats.longestStreak': newStats.longestStreak,
          'stats.lastStudyDate': newStats.lastStudyDate,
        });
        console.log('checkAndUpdateGitHubPush: Firestore stats updated');

        // 新しいバッジがあれば追加
        if (newBadges.length > 0) {
          await updateUserBadges(user.uid, newBadges);
          console.log('checkAndUpdateGitHubPush: badges updated');
        }

        // Firestoreから最新データを再取得してローカル状態を更新
        const updatedDoc = await getDoc(userRef);
        if (updatedDoc.exists()) {
          const updatedData = updatedDoc.data();
          console.log('checkAndUpdateGitHubPush: fetched updated stats =', JSON.stringify(updatedData.stats, null, 2));
          updateUser({
            stats: updatedData.stats,
            badges: updatedData.badges || [],
          });

          // 達成ツイートを投稿（連続日数・累計日数のマイルストーン達成時）
          // X連携されている場合のみ
          if (user.xLinked && user.xAccessToken) {
            try {
              // 最新のユーザーデータで達成ツイートをチェック・投稿
              const userForTweet = {
                ...user,
                stats: updatedData.stats,
                postedTotalDaysMilestones: updatedData.postedTotalDaysMilestones || [],
                postedStreakMilestones: updatedData.postedStreakMilestones || [],
              };
              console.log('checkAndUpdateGitHubPush: checking achievement tweets...');
              console.log('checkAndUpdateGitHubPush: totalStudyDays =', updatedData.stats.totalStudyDays);
              console.log('checkAndUpdateGitHubPush: currentStreak =', updatedData.stats.currentStreak);
              console.log('checkAndUpdateGitHubPush: postedTotalDaysMilestones =', updatedData.postedTotalDaysMilestones);
              console.log('checkAndUpdateGitHubPush: postedStreakMilestones =', updatedData.postedStreakMilestones);

              const achievementResult = await postAchievementTweetsAfterDailyCheck(userForTweet);
              console.log('checkAndUpdateGitHubPush: achievement tweet results =', JSON.stringify(achievementResult, null, 2));

              // 投稿成功時はアラートを表示
              if (achievementResult.totalDaysResult.milestone) {
                Alert.alert(
                  '達成おめでとうございます！',
                  `累計${achievementResult.totalDaysResult.milestone}日達成をXに投稿しました！`
                );
              }
              if (achievementResult.streakResult.milestone) {
                Alert.alert(
                  '達成おめでとうございます！',
                  `${achievementResult.streakResult.milestone}日連続達成をXに投稿しました！`
                );
              }
            } catch (tweetError) {
              console.error('checkAndUpdateGitHubPush: achievement tweet error', tweetError);
            }
          } else {
            console.log('checkAndUpdateGitHubPush: X not linked, skipping achievement tweets');
          }
        }

        // 通知を送信
        const dateKey = getTodayDateString();
        const storageKey = `github_push_notified_${user.uid}_${dateKey}`;
        const alreadyNotified = await AsyncStorage.getItem(storageKey);

        console.log('checkAndUpdateGitHubPush: alreadyNotified =', alreadyNotified);

        if (!alreadyNotified) {
          await AsyncStorage.setItem(storageKey, 'true');
          const streakDays = newStats.currentStreak || 1;

          // iPhoneプッシュ通知を送信
          await sendPushDetectedNotification(streakDays);
          console.log('checkAndUpdateGitHubPush: push notification sent with streak =', streakDays);

          // 達成タイプを判定（バッジ獲得状況に基づく）
          // newBadgesに連続バッジがあるかチェック
          const hasStreakBadge = newBadges.some(badge => badge.startsWith('streak_'));
          // newBadgesに累計バッジがあるかチェック
          const hasTotalBadge = newBadges.some(badge => badge.startsWith('total_'));

          console.log('checkAndUpdateGitHubPush: hasStreakBadge =', hasStreakBadge, 'hasTotalBadge =', hasTotalBadge);

          // 達成タイプを決定（連続バッジ優先）
          let achievementType: AchievementType = 'normal';
          if (hasStreakBadge) {
            achievementType = 'streak';
          } else if (hasTotalBadge) {
            achievementType = 'total';
          }

          // モーダルを表示
          setModalAchievementType(achievementType);
          setModalStreakDays(streakDays);
          setModalTotalDays(newStats.totalStudyDays);
          setShowPushSuccessModal(true);
          console.log('checkAndUpdateGitHubPush: showing success modal with type =', achievementType);
        }

        // ダッシュボードデータをリフレッシュ
        await refresh();
        return true;
      } else {
        console.log('checkAndUpdateGitHubPush: no push detected today');
        // ローカル状態を最新に更新
        updateUser({
          stats: latestStats,
          badges: latestUserData.badges || [],
        });
        return false;
      }
    } catch (error) {
      console.error('checkAndUpdateGitHubPush error:', error);
      return false;
    }
  }, [user, updateUser, refresh]);

  // 初回ロード時にGitHub pushをチェック
  useEffect(() => {
    if (user && !pushCheckAttempted.current) {
      pushCheckAttempted.current = true;
      checkAndUpdateGitHubPush(false);
    }
  }, [user, checkAndUpdateGitHubPush]);

  // アプリがフォアグラウンドに復帰したときにpushをチェック
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      // バックグラウンドからフォアグラウンドに復帰した場合
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('=== App became active, checking GitHub push ===');

        // 最後のチェックから10秒以上経過している場合のみチェック
        const now = Date.now();
        if (now - lastCheckTime.current < 10000) {
          console.log('Skipping check: too soon since last check');
          appState.current = nextAppState;
          return;
        }

        lastCheckTime.current = now;

        // GitHub pushをチェック（強制チェック）
        await checkAndUpdateGitHubPush(true);
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [checkAndUpdateGitHubPush]);

  const onRefresh = useCallback(async () => {
    console.log('=== onRefresh START ===');
    setRefreshing(true);

    // GitHub pushをチェック（強制チェック）
    // checkAndUpdateGitHubPush内でFirestoreから最新データを取得し、ローカル状態も更新する
    await checkAndUpdateGitHubPush(true);

    setRefreshing(false);
    console.log('=== onRefresh END ===');
  }, [checkAndUpdateGitHubPush]);

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

      {/* Push成功モーダル */}
      <PushSuccessModal
        visible={showPushSuccessModal}
        onClose={() => setShowPushSuccessModal(false)}
        achievementType={modalAchievementType}
        streakDays={modalStreakDays}
        totalDays={modalTotalDays}
      />
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
