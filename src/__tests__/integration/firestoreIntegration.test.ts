/**
 * Firestore連携統合テスト
 *
 * このテストは、アプリケーションとFirestoreの統合を検証します。
 * 日次チェック、統計更新、バッジ付与などの完全なフローをテストします。
 */

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  getDocs: jest.fn(),
  serverTimestamp: jest.fn(() => ({ _serverTimestamp: true })),
  Timestamp: {
    fromDate: jest.fn((date: Date) => ({
      toDate: () => date,
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0,
    })),
    now: jest.fn(() => ({
      toDate: () => new Date(),
      seconds: Math.floor(Date.now() / 1000),
      nanoseconds: 0,
    })),
  },
}));

jest.mock('../../lib/firebase', () => ({
  db: {},
}));

import { Timestamp } from 'firebase/firestore';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  query,
} from 'firebase/firestore';
import {
  saveDailyLog,
  getDailyLog,
  getUserDailyLogs,
  updateUserStats,
  updateUserBadges,
  saveDailyCheckResult,
  formatDateString,
} from '../../lib/firestoreService';
import { recordStudyDay, recordSkipDay, checkStreakMilestone } from '../../lib/utils/stats';
import { checkEarnableBadges } from '../../lib/dailyCheck';
import { User, UserStats, DailyLog } from '../../types';

// Helper to create a mock Timestamp
const createMockTimestamp = (date: Date) =>
  ({
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  }) as unknown as Timestamp;

// Mock user for testing
const createMockUser = (overrides: Partial<User> = {}): User => ({
  uid: 'test-user-id',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: null,
  createdAt: createMockTimestamp(new Date()),
  googleLinked: true,
  xLinked: true,
  xUserId: 'x-user-id',
  xAccessToken: 'x-access-token',
  xRefreshToken: 'x-refresh-token',
  xTokenExpiresAt: createMockTimestamp(new Date(Date.now() + 3600000)),
  githubLinked: true,
  githubUsername: 'testuser',
  githubAccessToken: 'github-access-token',
  goal: {
    deadline: createMockTimestamp(new Date('2026-12-31')),
    skills: ['TypeScript', 'React'],
    targetIncome: 100,
    incomeType: 'monthly',
  },
  stats: {
    currentMonthStudyDays: 10,
    currentMonthSkipDays: 2,
    totalStudyDays: 50,
    totalSkipDays: 10,
    currentStreak: 6,
    longestStreak: 15,
    lastStudyDate: createMockTimestamp(new Date('2026-01-19')),
    lastCheckedDate: createMockTimestamp(new Date('2026-01-19')),
  },
  badges: ['streak_5', 'streak_10'],
  fcmToken: null,
  notificationsEnabled: true,
  onboardingCompleted: true,
  isAdmin: false,
  subscription: null,
  ...overrides,
});

describe('Firestore Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Daily Check Complete Flow', () => {
    it('should save daily log when user has pushed', async () => {
      const mockDocRef = { id: 'test-user-id_2026-01-20' };
      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (setDoc as jest.Mock).mockResolvedValue(undefined);

      const dailyLog = {
        userId: 'test-user-id',
        date: '2026-01-20',
        hasPushed: true,
        pushCount: 5,
        pushedAt: createMockTimestamp(new Date('2026-01-20T18:00:00')),
        skipped: false,
        tweetedSkip: false,
        tweetedStreak: true,
        streakMilestone: 7,
      };

      await saveDailyLog(dailyLog);

      expect(setDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          userId: 'test-user-id',
          date: '2026-01-20',
          hasPushed: true,
          pushCount: 5,
        })
      );
    });

    it('should update stats correctly after study day', () => {
      const user = createMockUser();
      const date = new Date('2026-01-20');

      const newStats = recordStudyDay(user.stats, date);

      expect(newStats.currentStreak).toBe(7);
      expect(newStats.currentMonthStudyDays).toBe(11);
      expect(newStats.totalStudyDays).toBe(51);
    });

    it('should reset streak after skip day', () => {
      const user = createMockUser();
      const date = new Date('2026-01-20');

      const newStats = recordSkipDay(user.stats, date);

      expect(newStats.currentStreak).toBe(0);
      expect(newStats.currentMonthSkipDays).toBe(3);
      expect(newStats.totalSkipDays).toBe(11);
    });

    it('should detect streak milestone', () => {
      // Milestones are: 7, 30, 100, 365
      expect(checkStreakMilestone(7)).toBe(7);
      expect(checkStreakMilestone(30)).toBe(30);
      expect(checkStreakMilestone(100)).toBe(100);
      expect(checkStreakMilestone(365)).toBe(365);
      expect(checkStreakMilestone(8)).toBeNull();
      expect(checkStreakMilestone(14)).toBeNull();
      expect(checkStreakMilestone(15)).toBeNull();
    });
  });

  describe('Badge Award Flow', () => {
    it('should add new badges without duplicates', async () => {
      const mockDocRef = { id: 'test-user-id' };
      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({ badges: ['streak_5', 'streak_10'] }),
      });
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await updateUserBadges('test-user-id', ['streak_10', 'streak_15']);

      expect(updateDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          badges: ['streak_5', 'streak_10', 'streak_15'],
        })
      );
    });

    it('should check earnable badges correctly', () => {
      const userWithNoStreak = createMockUser({
        badges: [],
        stats: {
          ...createMockUser().stats,
          currentStreak: 0,
          totalStudyDays: 0,
          totalSkipDays: 0,
        },
      });

      // Streak badges: 5, 10, 15, 30, 100, 365
      const streak5Badges = checkEarnableBadges(userWithNoStreak, 5, false);
      expect(streak5Badges).toContain('streak_5');

      // Streak 10 badge
      const streak10Badges = checkEarnableBadges(userWithNoStreak, 10, false);
      expect(streak10Badges).toContain('streak_10');

      // Total study badges: 10, 30, 100, 365
      const userWith9Studies = createMockUser({
        badges: [],
        stats: {
          ...createMockUser().stats,
          totalStudyDays: 9,
        },
      });
      const totalBadges = checkEarnableBadges(userWith9Studies, 1, false);
      expect(totalBadges).toContain('total_10');

      // Skip badges: 1, 10, 30
      const userNoSkips = createMockUser({
        badges: [],
        stats: {
          ...createMockUser().stats,
          totalSkipDays: 0,
        },
      });
      const skipBadges = checkEarnableBadges(userNoSkips, 0, true);
      expect(skipBadges).toContain('skip_1');
    });
  });

  describe('Daily Log Retrieval', () => {
    it('should retrieve existing daily log', async () => {
      const mockData = {
        userId: 'test-user-id',
        date: '2026-01-20',
        hasPushed: true,
        pushCount: 3,
        pushedAt: createMockTimestamp(new Date()),
        skipped: false,
        tweetedSkip: false,
        tweetedStreak: false,
        streakMilestone: null,
        createdAt: createMockTimestamp(new Date()),
      };

      (doc as jest.Mock).mockReturnValue({ id: 'doc-id' });
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        id: 'test-user-id_2026-01-20',
        data: () => mockData,
      });

      const result = await getDailyLog('test-user-id', '2026-01-20');

      expect(result).not.toBeNull();
      expect(result?.hasPushed).toBe(true);
      expect(result?.date).toBe('2026-01-20');
    });

    it('should return null for non-existent daily log', async () => {
      (doc as jest.Mock).mockReturnValue({ id: 'doc-id' });
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => false,
      });

      const result = await getDailyLog('test-user-id', '2026-01-21');

      expect(result).toBeNull();
    });

    it('should retrieve user daily logs in order', async () => {
      const mockDocs = [
        {
          id: 'log-1',
          data: () => ({
            userId: 'test-user-id',
            date: '2026-01-20',
            hasPushed: true,
          }),
        },
        {
          id: 'log-2',
          data: () => ({
            userId: 'test-user-id',
            date: '2026-01-19',
            hasPushed: false,
          }),
        },
        {
          id: 'log-3',
          data: () => ({
            userId: 'test-user-id',
            date: '2026-01-18',
            hasPushed: true,
          }),
        },
      ];

      (query as jest.Mock).mockReturnValue({});
      (getDocs as jest.Mock).mockResolvedValue({
        docs: mockDocs,
      });

      const result = await getUserDailyLogs('test-user-id', 30);

      expect(result).toHaveLength(3);
      expect(result[0].date).toBe('2026-01-20');
      expect(result[1].date).toBe('2026-01-19');
      expect(result[2].date).toBe('2026-01-18');
    });
  });

  describe('Stats Update Flow', () => {
    it('should update user stats in Firestore', async () => {
      const mockDocRef = { id: 'test-user-id' };
      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const newStats: UserStats = {
        currentMonthStudyDays: 15,
        currentMonthSkipDays: 3,
        totalStudyDays: 100,
        totalSkipDays: 20,
        currentStreak: 7,
        longestStreak: 30,
        lastStudyDate: createMockTimestamp(new Date('2026-01-20')),
        lastCheckedDate: createMockTimestamp(new Date('2026-01-20')),
      };

      await updateUserStats('test-user-id', newStats);

      expect(updateDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          stats: newStats,
        })
      );
    });

    it('should preserve longest streak when current is shorter', () => {
      const user = createMockUser({
        stats: {
          ...createMockUser().stats,
          currentStreak: 5,
          longestStreak: 30,
        },
      });
      const date = new Date('2026-01-20');

      const newStats = recordStudyDay(user.stats, date);

      expect(newStats.currentStreak).toBe(6);
      expect(newStats.longestStreak).toBe(30);
    });

    it('should update longest streak when current exceeds it', () => {
      const user = createMockUser({
        stats: {
          ...createMockUser().stats,
          currentStreak: 29,
          longestStreak: 29,
          lastStudyDate: createMockTimestamp(new Date('2026-01-19')),
        },
      });
      const date = new Date('2026-01-20');

      const newStats = recordStudyDay(user.stats, date);

      expect(newStats.currentStreak).toBe(30);
      expect(newStats.longestStreak).toBe(30);
    });
  });

  describe('Date Formatting', () => {
    it('should format dates correctly', () => {
      expect(formatDateString(new Date('2026-01-05'))).toBe('2026-01-05');
      expect(formatDateString(new Date('2026-12-25'))).toBe('2026-12-25');
      expect(formatDateString(new Date('2026-01-20'))).toBe('2026-01-20');
    });
  });

  describe('Complete Daily Check Integration', () => {
    it('should save complete daily check result', async () => {
      const mockDocRef = { id: 'test-user-id_2026-01-20' };
      const mockUserDocRef = { id: 'test-user-id' };

      (doc as jest.Mock)
        .mockReturnValueOnce(mockDocRef)
        .mockReturnValueOnce(mockUserDocRef)
        .mockReturnValueOnce(mockUserDocRef);

      (setDoc as jest.Mock).mockResolvedValue(undefined);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({ badges: ['streak_5'] }),
      });

      const date = new Date('2026-01-20');
      const newStats: UserStats = {
        currentMonthStudyDays: 11,
        currentMonthSkipDays: 2,
        totalStudyDays: 51,
        totalSkipDays: 10,
        currentStreak: 7,
        longestStreak: 15,
        lastStudyDate: createMockTimestamp(date),
        lastCheckedDate: createMockTimestamp(date),
      };

      await saveDailyCheckResult({
        userId: 'test-user-id',
        date,
        hasPushed: true,
        pushCount: 3,
        newStats,
        newBadges: ['streak_10'],
        tweetedSkip: false,
        tweetedStreak: true,
        streakMilestone: 7,
      });

      // Verify daily log was saved
      expect(setDoc).toHaveBeenCalled();

      // Verify stats were updated
      expect(updateDoc).toHaveBeenCalled();
    });

    it('should handle skip day flow correctly', async () => {
      const mockDocRef = { id: 'test-user-id_2026-01-20' };
      const mockUserDocRef = { id: 'test-user-id' };

      (doc as jest.Mock)
        .mockReturnValueOnce(mockDocRef)
        .mockReturnValueOnce(mockUserDocRef);

      (setDoc as jest.Mock).mockResolvedValue(undefined);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const date = new Date('2026-01-20');
      const user = createMockUser();
      const newStats = recordSkipDay(user.stats, date);

      await saveDailyCheckResult({
        userId: 'test-user-id',
        date,
        hasPushed: false,
        pushCount: 0,
        newStats,
        newBadges: [],
        tweetedSkip: true,
        tweetedStreak: false,
        streakMilestone: null,
      });

      expect(setDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          hasPushed: false,
          skipped: true,
          tweetedSkip: true,
        })
      );
    });
  });

  describe('Week Calendar Data', () => {
    it('should provide correct data for week calendar display', async () => {
      const mockDocs = [
        { id: 'log-1', data: () => ({ date: '2026-01-20', hasPushed: true }) },
        { id: 'log-2', data: () => ({ date: '2026-01-19', hasPushed: true }) },
        { id: 'log-3', data: () => ({ date: '2026-01-18', hasPushed: false }) },
        { id: 'log-4', data: () => ({ date: '2026-01-17', hasPushed: true }) },
        { id: 'log-5', data: () => ({ date: '2026-01-16', hasPushed: true }) },
        { id: 'log-6', data: () => ({ date: '2026-01-15', hasPushed: true }) },
        { id: 'log-7', data: () => ({ date: '2026-01-14', hasPushed: false }) },
      ];

      (query as jest.Mock).mockReturnValue({});
      (getDocs as jest.Mock).mockResolvedValue({
        docs: mockDocs,
      });

      const logs = await getUserDailyLogs('test-user-id', 7);

      const pushedDays = logs.filter((log) => log.hasPushed).length;
      const skippedDays = logs.filter((log) => !log.hasPushed).length;

      expect(pushedDays).toBe(5);
      expect(skippedDays).toBe(2);
    });
  });
});
