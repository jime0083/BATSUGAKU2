import { Timestamp } from 'firebase/firestore';
import {
  getWeekDays,
  mapLogsToWeekDays,
  WeekDay,
} from '../../hooks/useDashboardData';
import { DailyLog } from '../../types';

// Helper to create a mock Timestamp
const createMockTimestamp = (date: Date) =>
  ({
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  }) as unknown as Timestamp;

// Helper to create mock DailyLog
const createMockDailyLog = (
  date: string,
  hasPushed: boolean
): DailyLog => ({
  id: `user_${date}`,
  userId: 'test-user',
  date,
  hasPushed,
  pushCount: hasPushed ? 1 : 0,
  pushedAt: hasPushed ? createMockTimestamp(new Date(date)) : null,
  skipped: !hasPushed,
  tweetedSkip: !hasPushed,
  tweetedStreak: false,
  streakMilestone: null,
  createdAt: createMockTimestamp(new Date(date)),
});

describe('useDashboardData utilities', () => {
  describe('getWeekDays', () => {
    it('should return 7 days starting from Monday', () => {
      // Fixed date: Wednesday, January 15, 2026
      const testDate = new Date('2026-01-15');
      const days = getWeekDays(testDate);

      expect(days).toHaveLength(7);
      expect(days[0].name).toBe('月');
      expect(days[6].name).toBe('日');
    });

    it('should mark correct day as today', () => {
      const testDate = new Date('2026-01-15'); // Thursday
      const days = getWeekDays(testDate);

      // Thursday is index 3 (Mon=0, Tue=1, Wed=2, Thu=3)
      expect(days[3].isToday).toBe(true);
      expect(days[0].isToday).toBe(false);
      expect(days[6].isToday).toBe(false);
    });

    it('should handle Sunday as today correctly', () => {
      const testDate = new Date('2026-01-18'); // Sunday
      const days = getWeekDays(testDate);

      expect(days[6].isToday).toBe(true);
      expect(days[6].name).toBe('日');
    });

    it('should handle Monday as today correctly', () => {
      const testDate = new Date('2026-01-12'); // Monday
      const days = getWeekDays(testDate);

      expect(days[0].isToday).toBe(true);
      expect(days[0].name).toBe('月');
    });

    it('should return correct date numbers', () => {
      // Monday Jan 12, 2026
      const testDate = new Date('2026-01-15');
      const days = getWeekDays(testDate);

      // Week of Jan 12-18
      expect(days[0].date).toBe(12); // Mon
      expect(days[1].date).toBe(13); // Tue
      expect(days[2].date).toBe(14); // Wed
      expect(days[3].date).toBe(15); // Thu
      expect(days[4].date).toBe(16); // Fri
      expect(days[5].date).toBe(17); // Sat
      expect(days[6].date).toBe(18); // Sun
    });

    it('should return date strings in YYYY-MM-DD format', () => {
      const testDate = new Date('2026-01-15');
      const days = getWeekDays(testDate);

      expect(days[0].dateString).toBe('2026-01-12');
      expect(days[6].dateString).toBe('2026-01-18');
    });

    it('should initialize hasStudied as null (unknown)', () => {
      const testDate = new Date('2026-01-15');
      const days = getWeekDays(testDate);

      days.forEach((day) => {
        expect(day.hasStudied).toBeNull();
      });
    });
  });

  describe('mapLogsToWeekDays', () => {
    it('should map DailyLogs to corresponding week days', () => {
      const testDate = new Date('2026-01-15');
      const weekDays = getWeekDays(testDate);
      const logs: DailyLog[] = [
        createMockDailyLog('2026-01-12', true), // Mon - studied
        createMockDailyLog('2026-01-13', false), // Tue - skipped
        createMockDailyLog('2026-01-14', true), // Wed - studied
      ];

      const result = mapLogsToWeekDays(weekDays, logs);

      expect(result[0].hasStudied).toBe(true); // Mon
      expect(result[1].hasStudied).toBe(false); // Tue
      expect(result[2].hasStudied).toBe(true); // Wed
      expect(result[3].hasStudied).toBeNull(); // Thu - no log
      expect(result[4].hasStudied).toBeNull(); // Fri - no log
    });

    it('should return original weekDays when logs is empty', () => {
      const testDate = new Date('2026-01-15');
      const weekDays = getWeekDays(testDate);
      const logs: DailyLog[] = [];

      const result = mapLogsToWeekDays(weekDays, logs);

      result.forEach((day) => {
        expect(day.hasStudied).toBeNull();
      });
    });

    it('should not mutate original weekDays', () => {
      const testDate = new Date('2026-01-15');
      const weekDays = getWeekDays(testDate);
      const logs: DailyLog[] = [createMockDailyLog('2026-01-12', true)];

      const result = mapLogsToWeekDays(weekDays, logs);

      expect(weekDays[0].hasStudied).toBeNull(); // Original unchanged
      expect(result[0].hasStudied).toBe(true); // New copy changed
    });

    it('should handle all days studied', () => {
      const testDate = new Date('2026-01-15');
      const weekDays = getWeekDays(testDate);
      const logs: DailyLog[] = [
        createMockDailyLog('2026-01-12', true),
        createMockDailyLog('2026-01-13', true),
        createMockDailyLog('2026-01-14', true),
        createMockDailyLog('2026-01-15', true),
        createMockDailyLog('2026-01-16', true),
        createMockDailyLog('2026-01-17', true),
        createMockDailyLog('2026-01-18', true),
      ];

      const result = mapLogsToWeekDays(weekDays, logs);

      result.forEach((day) => {
        expect(day.hasStudied).toBe(true);
      });
    });

    it('should handle all days skipped', () => {
      const testDate = new Date('2026-01-15');
      const weekDays = getWeekDays(testDate);
      const logs: DailyLog[] = [
        createMockDailyLog('2026-01-12', false),
        createMockDailyLog('2026-01-13', false),
        createMockDailyLog('2026-01-14', false),
      ];

      const result = mapLogsToWeekDays(weekDays, logs);

      expect(result[0].hasStudied).toBe(false);
      expect(result[1].hasStudied).toBe(false);
      expect(result[2].hasStudied).toBe(false);
    });
  });
});
