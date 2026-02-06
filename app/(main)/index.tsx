import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../../src/contexts/AuthContext';
import { useDashboardData } from '../../src/hooks/useDashboardData';
import { useSubscription } from '../../src/hooks/useSubscription';
import { DailyCheckButton, DailyCheckResultModal, PaywallScreen } from '../../src/components';
import { DailyCheckResultDisplay } from '../../src/hooks/useDailyCheck';
import { shouldPostGoalTweet, postGoalTweet } from '../../src/lib/goalTweetService';

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

export default function DashboardScreen() {
  const { user } = useAuth();
  const { weekDays, loading, error, refresh } = useDashboardData(user?.uid);
  const subscription = useSubscription(user);
  const [refreshing, setRefreshing] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [checkResult, setCheckResult] = useState<DailyCheckResultDisplay | null>(null);
  const goalTweetAttempted = useRef(false);

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleCheckComplete = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleShowResult = useCallback((result: DailyCheckResultDisplay | null) => {
    if (result) {
      setCheckResult(result);
      setShowResultModal(true);
    }
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowResultModal(false);
    setCheckResult(null);
  }, []);

  const handleShowPaywall = useCallback(() => {
    setShowPaywall(true);
  }, []);

  const handleClosePaywall = useCallback(() => {
    setShowPaywall(false);
  }, []);

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
              目標: {user.goal.incomeType === 'monthly' ? '月収' : '年収'}
              {user.goal.targetIncome}万円エンジニア
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

        {/* 日次チェックボタン */}
        <DailyCheckButton
          user={user}
          onCheckComplete={handleCheckComplete}
          onShowResult={handleShowResult}
          onShowPaywall={handleShowPaywall}
        />

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
            <Text style={styles.statValue}>{user?.stats.currentMonthStudyDays || 0}</Text>
            <Text style={styles.statLabel}>今月の学習日数</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{user?.stats.currentMonthSkipDays || 0}</Text>
            <Text style={styles.statLabel}>今月のサボり日数</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{user?.stats.totalStudyDays || 0}</Text>
            <Text style={styles.statLabel}>累計学習日数</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{user?.stats.totalSkipDays || 0}</Text>
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

      {/* 日次チェック結果モーダル */}
      <DailyCheckResultModal
        visible={showResultModal}
        result={checkResult}
        onClose={handleCloseModal}
      />

      {/* Paywallモーダル */}
      <PaywallScreen
        visible={showPaywall}
        onClose={handleClosePaywall}
        subscription={subscription}
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
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
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
