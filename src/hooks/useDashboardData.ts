import { useState, useEffect, useCallback } from 'react';
import { DailyLog } from '../types';
import { getCurrentWeekLogs, formatDateString } from '../lib/firestoreService';

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
 * ダッシュボード用のデータを取得するカスタムフック
 */
export function useDashboardData(userId: string | undefined): DashboardData {
  const [weekDays, setWeekDays] = useState<WeekDay[]>(() => getWeekDays());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!userId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const logs = await getCurrentWeekLogs(userId);
      const baseWeekDays = getWeekDays();
      const mappedDays = mapLogsToWeekDays(baseWeekDays, logs);
      setWeekDays(mappedDays);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch data'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

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
