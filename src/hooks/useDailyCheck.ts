import { useState, useCallback } from 'react';
import { User } from '../types';
import { performDailyCheck, hasCheckedToday, canPerformDailyCheck } from '../lib/dailyCheckService';
import { hasPremiumAccess, getPremiumRequiredReason } from '../lib/subscription';

export interface DailyCheckState {
  isChecking: boolean;
  hasCheckedToday: boolean;
  canCheck: boolean;
  cannotCheckReason: string | null;
  lastResult: DailyCheckResultDisplay | null;
  error: Error | null;
}

export interface DailyCheckResultDisplay {
  hasPushed: boolean;
  isSkipped: boolean;
  newStreak: number;
  streakMilestone: number | null;
  tweetedSkip: boolean;
  tweetedStreak: boolean;
  earnedBadges: string[];
}

export interface UseDailyCheckReturn extends DailyCheckState {
  performCheck: () => Promise<DailyCheckResultDisplay | null>;
  clearResult: () => void;
  refreshStatus: () => Promise<void>;
}

export function useDailyCheck(user: User | null): UseDailyCheckReturn {
  const [state, setState] = useState<DailyCheckState>({
    isChecking: false,
    hasCheckedToday: false,
    canCheck: false,
    cannotCheckReason: null,
    lastResult: null,
    error: null,
  });

  const refreshStatus = useCallback(async () => {
    if (!user) {
      setState((prev) => ({
        ...prev,
        canCheck: false,
        cannotCheckReason: 'ログインが必要です',
        hasCheckedToday: false,
      }));
      return;
    }

    // プレミアムアクセスチェック
    if (!hasPremiumAccess(user)) {
      const reason = getPremiumRequiredReason(user);
      setState((prev) => ({
        ...prev,
        canCheck: false,
        cannotCheckReason: reason || 'サブスクリプションが必要です',
        hasCheckedToday: false,
      }));
      return;
    }

    // 日次チェック可能かどうか
    const { canCheck, reason } = canPerformDailyCheck(user);
    if (!canCheck) {
      setState((prev) => ({
        ...prev,
        canCheck: false,
        cannotCheckReason: reason || null,
        hasCheckedToday: false,
      }));
      return;
    }

    // 今日既にチェック済みかどうか
    try {
      const checked = await hasCheckedToday(user.uid);
      setState((prev) => ({
        ...prev,
        canCheck: !checked,
        cannotCheckReason: checked ? '今日は既にチェック済みです' : null,
        hasCheckedToday: checked,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err : new Error('ステータス取得に失敗しました'),
      }));
    }
  }, [user]);

  const performCheck = useCallback(async (): Promise<DailyCheckResultDisplay | null> => {
    if (!user) {
      setState((prev) => ({
        ...prev,
        error: new Error('ログインが必要です'),
      }));
      return null;
    }

    setState((prev) => ({
      ...prev,
      isChecking: true,
      error: null,
    }));

    try {
      const result = await performDailyCheck(user);

      if (result.error) {
        throw new Error(result.error);
      }

      const displayResult: DailyCheckResultDisplay = {
        hasPushed: result.hasPushed,
        isSkipped: !result.hasPushed,
        newStreak: result.newStreak,
        streakMilestone: result.streakMilestone,
        tweetedSkip: result.tweetedSkip,
        tweetedStreak: result.tweetedStreak,
        earnedBadges: result.newBadges,
      };

      setState((prev) => ({
        ...prev,
        isChecking: false,
        hasCheckedToday: true,
        canCheck: false,
        cannotCheckReason: '今日は既にチェック済みです',
        lastResult: displayResult,
      }));

      return displayResult;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('チェックに失敗しました');
      setState((prev) => ({
        ...prev,
        isChecking: false,
        error,
      }));
      return null;
    }
  }, [user]);

  const clearResult = useCallback(() => {
    setState((prev) => ({
      ...prev,
      lastResult: null,
      error: null,
    }));
  }, []);

  return {
    ...state,
    performCheck,
    clearResult,
    refreshStatus,
  };
}
