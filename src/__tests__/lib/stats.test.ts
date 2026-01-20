import { Timestamp } from 'firebase/firestore';
import {
  createInitialStats,
  recordStudyDay,
  recordSkipDay,
  checkStreakMilestone,
  resetMonthlyStatsIfNeeded,
} from '../../lib/utils/stats';
import { UserStats } from '../../types';

// Helper to create a mock Timestamp
const createMockTimestamp = (date: Date) => ({
  toDate: () => date,
  seconds: Math.floor(date.getTime() / 1000),
  nanoseconds: 0,
}) as unknown as Timestamp;

describe('stats utility functions', () => {
  describe('createInitialStats', () => {
    it('すべてのカウンターが0で初期化されること', () => {
      const stats = createInitialStats();

      expect(stats.currentMonthStudyDays).toBe(0);
      expect(stats.currentMonthSkipDays).toBe(0);
      expect(stats.totalStudyDays).toBe(0);
      expect(stats.totalSkipDays).toBe(0);
      expect(stats.currentStreak).toBe(0);
      expect(stats.longestStreak).toBe(0);
    });

    it('日付フィールドがnullで初期化されること', () => {
      const stats = createInitialStats();

      expect(stats.lastStudyDate).toBeNull();
      expect(stats.lastCheckedDate).toBeNull();
    });
  });

  describe('recordStudyDay', () => {
    it('学習日数が増加すること', () => {
      const initialStats: UserStats = {
        currentMonthStudyDays: 5,
        currentMonthSkipDays: 2,
        totalStudyDays: 30,
        totalSkipDays: 10,
        currentStreak: 3,
        longestStreak: 10,
        lastStudyDate: null,
        lastCheckedDate: null,
      };
      const date = new Date('2026-01-20');

      const result = recordStudyDay(initialStats, date);

      expect(result.currentMonthStudyDays).toBe(6);
      expect(result.totalStudyDays).toBe(31);
    });

    it('連続日数が増加すること', () => {
      const yesterday = new Date('2026-01-19');
      const today = new Date('2026-01-20');
      const initialStats: UserStats = {
        currentMonthStudyDays: 5,
        currentMonthSkipDays: 2,
        totalStudyDays: 30,
        totalSkipDays: 10,
        currentStreak: 3,
        longestStreak: 10,
        lastStudyDate: createMockTimestamp(yesterday),
        lastCheckedDate: createMockTimestamp(yesterday),
      };

      const result = recordStudyDay(initialStats, today);

      expect(result.currentStreak).toBe(4);
    });

    it('連続が途切れた後は1からスタートすること', () => {
      const twoDaysAgo = new Date('2026-01-18');
      const today = new Date('2026-01-20');
      const initialStats: UserStats = {
        currentMonthStudyDays: 5,
        currentMonthSkipDays: 2,
        totalStudyDays: 30,
        totalSkipDays: 10,
        currentStreak: 3,
        longestStreak: 10,
        lastStudyDate: createMockTimestamp(twoDaysAgo),
        lastCheckedDate: createMockTimestamp(twoDaysAgo),
      };

      const result = recordStudyDay(initialStats, today);

      expect(result.currentStreak).toBe(1);
    });

    it('最長連続日数が更新されること', () => {
      const yesterday = new Date('2026-01-19');
      const today = new Date('2026-01-20');
      const initialStats: UserStats = {
        currentMonthStudyDays: 5,
        currentMonthSkipDays: 2,
        totalStudyDays: 30,
        totalSkipDays: 10,
        currentStreak: 10,
        longestStreak: 10,
        lastStudyDate: createMockTimestamp(yesterday),
        lastCheckedDate: createMockTimestamp(yesterday),
      };

      const result = recordStudyDay(initialStats, today);

      expect(result.longestStreak).toBe(11);
    });

    it('lastStudyDateが更新されること', () => {
      const today = new Date('2026-01-20');
      const initialStats: UserStats = {
        currentMonthStudyDays: 0,
        currentMonthSkipDays: 0,
        totalStudyDays: 0,
        totalSkipDays: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastStudyDate: null,
        lastCheckedDate: null,
      };

      const result = recordStudyDay(initialStats, today);

      expect(result.lastStudyDate).not.toBeNull();
    });
  });

  describe('recordSkipDay', () => {
    it('サボり日数が増加すること', () => {
      const initialStats: UserStats = {
        currentMonthStudyDays: 5,
        currentMonthSkipDays: 2,
        totalStudyDays: 30,
        totalSkipDays: 10,
        currentStreak: 3,
        longestStreak: 10,
        lastStudyDate: null,
        lastCheckedDate: null,
      };
      const date = new Date('2026-01-20');

      const result = recordSkipDay(initialStats, date);

      expect(result.currentMonthSkipDays).toBe(3);
      expect(result.totalSkipDays).toBe(11);
    });

    it('連続日数がリセットされること', () => {
      const initialStats: UserStats = {
        currentMonthStudyDays: 5,
        currentMonthSkipDays: 2,
        totalStudyDays: 30,
        totalSkipDays: 10,
        currentStreak: 5,
        longestStreak: 10,
        lastStudyDate: null,
        lastCheckedDate: null,
      };
      const date = new Date('2026-01-20');

      const result = recordSkipDay(initialStats, date);

      expect(result.currentStreak).toBe(0);
    });

    it('最長連続日数は維持されること', () => {
      const initialStats: UserStats = {
        currentMonthStudyDays: 5,
        currentMonthSkipDays: 2,
        totalStudyDays: 30,
        totalSkipDays: 10,
        currentStreak: 5,
        longestStreak: 10,
        lastStudyDate: null,
        lastCheckedDate: null,
      };
      const date = new Date('2026-01-20');

      const result = recordSkipDay(initialStats, date);

      expect(result.longestStreak).toBe(10);
    });
  });

  describe('checkStreakMilestone', () => {
    it('マイルストーン（7日）に達した場合、その値を返すこと', () => {
      const result = checkStreakMilestone(7);
      expect(result).toBe(7);
    });

    it('マイルストーン（30日）に達した場合、その値を返すこと', () => {
      const result = checkStreakMilestone(30);
      expect(result).toBe(30);
    });

    it('マイルストーン（100日）に達した場合、その値を返すこと', () => {
      const result = checkStreakMilestone(100);
      expect(result).toBe(100);
    });

    it('マイルストーン（365日）に達した場合、その値を返すこと', () => {
      const result = checkStreakMilestone(365);
      expect(result).toBe(365);
    });

    it('マイルストーンでない場合、nullを返すこと', () => {
      const result = checkStreakMilestone(5);
      expect(result).toBeNull();
    });

    it('マイルストーンでない場合（8日）、nullを返すこと', () => {
      const result = checkStreakMilestone(8);
      expect(result).toBeNull();
    });
  });

  describe('resetMonthlyStatsIfNeeded', () => {
    it('月が変わった場合、月間統計がリセットされること', () => {
      const lastMonth = new Date('2025-12-31');
      const thisMonth = new Date('2026-01-01');
      const initialStats: UserStats = {
        currentMonthStudyDays: 20,
        currentMonthSkipDays: 5,
        totalStudyDays: 100,
        totalSkipDays: 30,
        currentStreak: 10,
        longestStreak: 15,
        lastStudyDate: createMockTimestamp(lastMonth),
        lastCheckedDate: createMockTimestamp(lastMonth),
      };

      const result = resetMonthlyStatsIfNeeded(initialStats, thisMonth);

      expect(result.currentMonthStudyDays).toBe(0);
      expect(result.currentMonthSkipDays).toBe(0);
    });

    it('月が変わった場合でも、累計統計は維持されること', () => {
      const lastMonth = new Date('2025-12-31');
      const thisMonth = new Date('2026-01-01');
      const initialStats: UserStats = {
        currentMonthStudyDays: 20,
        currentMonthSkipDays: 5,
        totalStudyDays: 100,
        totalSkipDays: 30,
        currentStreak: 10,
        longestStreak: 15,
        lastStudyDate: createMockTimestamp(lastMonth),
        lastCheckedDate: createMockTimestamp(lastMonth),
      };

      const result = resetMonthlyStatsIfNeeded(initialStats, thisMonth);

      expect(result.totalStudyDays).toBe(100);
      expect(result.totalSkipDays).toBe(30);
      expect(result.currentStreak).toBe(10);
      expect(result.longestStreak).toBe(15);
    });

    it('同じ月の場合、統計は変更されないこと', () => {
      const sameMonth1 = new Date('2026-01-15');
      const sameMonth2 = new Date('2026-01-20');
      const initialStats: UserStats = {
        currentMonthStudyDays: 10,
        currentMonthSkipDays: 3,
        totalStudyDays: 50,
        totalSkipDays: 15,
        currentStreak: 5,
        longestStreak: 10,
        lastStudyDate: createMockTimestamp(sameMonth1),
        lastCheckedDate: createMockTimestamp(sameMonth1),
      };

      const result = resetMonthlyStatsIfNeeded(initialStats, sameMonth2);

      expect(result.currentMonthStudyDays).toBe(10);
      expect(result.currentMonthSkipDays).toBe(3);
    });

    it('lastCheckedDateがnullの場合、リセットしないこと', () => {
      const currentDate = new Date('2026-01-20');
      const initialStats: UserStats = {
        currentMonthStudyDays: 10,
        currentMonthSkipDays: 3,
        totalStudyDays: 50,
        totalSkipDays: 15,
        currentStreak: 5,
        longestStreak: 10,
        lastStudyDate: null,
        lastCheckedDate: null,
      };

      const result = resetMonthlyStatsIfNeeded(initialStats, currentDate);

      expect(result.currentMonthStudyDays).toBe(10);
      expect(result.currentMonthSkipDays).toBe(3);
    });
  });
});
