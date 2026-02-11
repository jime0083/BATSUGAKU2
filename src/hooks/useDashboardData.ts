import { useState, useEffect, useCallback } from 'react';
import { DailyLog } from '../types';
import { getCurrentWeekLogs, formatDateString } from '../lib/firestoreService';
import { fetchWeeklyPushDates } from '../lib/github';

export interface WeekDay {
  name: string;
  date: number;
  dateString: string;
  isToday: boolean;
  hasStudied: boolean | null; // null = 未取得/該当日のログなし
}

export interface DashboardData {
  weekDays: WeekDay[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

const DAY_NAMES = ['月', '火', '水', '木', '金', '土', '日'];

/**
 * 今週の日付リストを取得（月曜始まり）
 */
export function getWeekDays(today: Date = new Date()): WeekDay[] {
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  // 日曜日(0)の場合は6日前、それ以外は(dayOfWeek - 1)日前
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);

  const days: WeekDay[] = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);

    days.push({
      name: DAY_NAMES[i],
      date: date.getDate(),
      dateString: formatDateString(date),
      isToday: date.toDateString() === today.toDateString(),
      hasStudied: null,
    });
  }

  return days;
}

/**
 * DailyLogを週間カレンダーにマッピング
 */
export function mapLogsToWeekDays(
  weekDays: WeekDay[],
  logs: DailyLog[]
): WeekDay[] {
  // 日付をキーにしたMapを作成
  const logMap = new Map<string, DailyLog>();
  logs.forEach((log) => {
    logMap.set(log.date, log);
  });

  // 新しい配列を返す（イミュータブル）
  return weekDays.map((day) => {
    const log = logMap.get(day.dateString);
    return {
      ...day,
      hasStudied: log ? log.hasPushed : null,
    };
  });
}

/**
 * GitHub認証情報
 */
interface GitHubCredentials {
  username: string | null;
  accessToken: string | null;
}

/**
 * ダッシュボード用のデータを取得するカスタムフック
 * GitHub APIから直接push日を取得し、カレンダーに反映
 */
export function useDashboardData(
  userId: string | undefined,
  github?: GitHubCredentials
): DashboardData {
  const [weekDays, setWeekDays] = useState<WeekDay[]>(() => getWeekDays());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!userId) {
      console.log('useDashboardData: userId is null, skipping fetch');
      return;
    }

    console.log('useDashboardData: fetching data for userId =', userId);
    setLoading(true);
    setError(null);

    try {
      const baseWeekDays = getWeekDays();
      console.log('useDashboardData: baseWeekDays =', baseWeekDays.map(d => d.dateString));

      // GitHub APIから今週のpush日を取得
      let pushDates: string[] = [];
      if (github?.username && github?.accessToken) {
        try {
          pushDates = await fetchWeeklyPushDates(github.username, github.accessToken);
          console.log('useDashboardData: GitHub push dates =', pushDates);
        } catch (githubError) {
          console.error('useDashboardData: GitHub API error', githubError);
          // GitHub APIエラーの場合はDailyLogにフォールバック
        }
      }

      // DailyLogからも取得（バックアップ用）
      let logs: DailyLog[] = [];
      try {
        logs = await getCurrentWeekLogs(userId);
        console.log('useDashboardData: fetched logs =', logs.length, 'logs');
      } catch (logError) {
        console.error('useDashboardData: DailyLog fetch error', logError);
      }

      // GitHub APIとDailyLogの両方からpush日を統合
      const pushDatesSet = new Set(pushDates);
      logs.forEach(log => {
        if (log.hasPushed) {
          pushDatesSet.add(log.date);
        }
      });

      console.log('useDashboardData: combined push dates =', Array.from(pushDatesSet));

      // 週間カレンダーにマッピング
      const mappedDays = baseWeekDays.map((day) => ({
        ...day,
        hasStudied: pushDatesSet.has(day.dateString),
      }));

      console.log('useDashboardData: mappedDays =', mappedDays.map(d => ({ date: d.dateString, hasStudied: d.hasStudied })));

      setWeekDays(mappedDays);
    } catch (err) {
      console.error('useDashboardData: error fetching data', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch data'));
    } finally {
      setLoading(false);
    }
  }, [userId, github?.username, github?.accessToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    weekDays,
    loading,
    error,
    refresh: fetchData,
  };
}
