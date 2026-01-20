import { Timestamp } from 'firebase/firestore';
import { UserStats } from '../../types';

// 連続日数のマイルストーン（ツイート対象）
const STREAK_MILESTONES = [7, 30, 100, 365];

/**
 * 新しいユーザー統計の初期値を作成する
 */
export function createInitialStats(): UserStats {
  return {
    currentMonthStudyDays: 0,
    currentMonthSkipDays: 0,
    totalStudyDays: 0,
    totalSkipDays: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastStudyDate: null,
    lastCheckedDate: null,
  };
}

/**
 * 2つの日付が連続しているかどうかを判定する（昨日と今日）
 */
function isConsecutiveDay(lastDate: Date, currentDate: Date): boolean {
  const lastDay = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
  const currentDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

  const diffTime = currentDay.getTime() - lastDay.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);

  return diffDays === 1;
}

/**
 * 学習日を記録し、統計を更新する
 */
export function recordStudyDay(stats: UserStats, date: Date): UserStats {
  let newStreak = 1;

  // 前回の学習日が昨日であれば連続日数を増やす
  if (stats.lastStudyDate) {
    const lastStudyDate = stats.lastStudyDate.toDate();
    if (isConsecutiveDay(lastStudyDate, date)) {
      newStreak = stats.currentStreak + 1;
    }
  }

  // 最長連続日数を更新
  const newLongestStreak = Math.max(stats.longestStreak, newStreak);

  return {
    ...stats,
    currentMonthStudyDays: stats.currentMonthStudyDays + 1,
    totalStudyDays: stats.totalStudyDays + 1,
    currentStreak: newStreak,
    longestStreak: newLongestStreak,
    lastStudyDate: Timestamp.fromDate(date),
    lastCheckedDate: Timestamp.fromDate(date),
  };
}

/**
 * サボり日を記録し、統計を更新する
 */
export function recordSkipDay(stats: UserStats, date: Date): UserStats {
  return {
    ...stats,
    currentMonthSkipDays: stats.currentMonthSkipDays + 1,
    totalSkipDays: stats.totalSkipDays + 1,
    currentStreak: 0,
    lastCheckedDate: Timestamp.fromDate(date),
  };
}

/**
 * 連続日数がマイルストーンに達したかチェックする
 * @returns マイルストーンに達していればその値、そうでなければnull
 */
export function checkStreakMilestone(streak: number): number | null {
  if (STREAK_MILESTONES.includes(streak)) {
    return streak;
  }
  return null;
}

/**
 * 月が変わった場合、月間統計をリセットする
 */
export function resetMonthlyStatsIfNeeded(stats: UserStats, currentDate: Date): UserStats {
  // lastCheckedDateがnullの場合はリセットしない
  if (!stats.lastCheckedDate) {
    return stats;
  }

  const lastCheckedDate = stats.lastCheckedDate.toDate();
  const lastMonth = lastCheckedDate.getMonth();
  const lastYear = lastCheckedDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // 月または年が異なる場合、月間統計をリセット
  if (lastMonth !== currentMonth || lastYear !== currentYear) {
    return {
      ...stats,
      currentMonthStudyDays: 0,
      currentMonthSkipDays: 0,
    };
  }

  return stats;
}
