import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import { COLORS } from '../../src/constants';

export default function DashboardScreen() {
  const { user } = useAuth();

  // 今週の日付を計算
  const getWeekDays = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    const days = [];
    const dayNames = ['月', '火', '水', '木', '金', '土', '日'];

    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      days.push({
        name: dayNames[i],
        date: date.getDate(),
        isToday: date.toDateString() === today.toDateString(),
        // TODO: 実際のpush状態を取得
        hasStudied: Math.random() > 0.3, // ダミーデータ
      });
    }
    return days;
  };

  const weekDays = getWeekDays();

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
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

        {/* 今週の学習状況 */}
        <View style={styles.weekCard}>
          <Text style={styles.sectionTitle}>今週の学習</Text>
          <View style={styles.weekDays}>
            {weekDays.map((day, index) => (
              <View key={index} style={styles.dayColumn}>
                <Text style={[styles.dayName, day.isToday && styles.todayText]}>
                  {day.name}
                </Text>
                <View
                  style={[
                    styles.dayCircle,
                    day.hasStudied && styles.dayCircleStudied,
                    day.isToday && styles.dayCircleToday,
                  ]}
                >
                  <Text style={styles.dayDate}>{day.date}</Text>
                </View>
                {day.hasStudied && <Text style={styles.checkMark}>✓</Text>}
              </View>
            ))}
          </View>
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
          <View style={styles.connectionRow}>
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
    borderWidth: 1,
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
  dayCircleToday: {
    borderColor: COLORS.accent,
    borderWidth: 2,
  },
  dayDate: {
    fontSize: 14,
    color: COLORS.text,
  },
  checkMark: {
    fontSize: 12,
    color: COLORS.success,
    marginTop: 4,
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
    color: COLORS.warning,
  },
  connected: {
    color: COLORS.success,
  },
});
