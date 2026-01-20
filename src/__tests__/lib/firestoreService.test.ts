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

import {
  saveDailyLog,
  getDailyLog,
  getUserDailyLogs,
  updateUserStats,
  updateUserBadges,
  formatDateString,
} from '../../lib/firestoreService';
import { doc, getDoc, setDoc, updateDoc, getDocs, query } from 'firebase/firestore';
import { DailyLog, UserStats } from '../../types';
import { Timestamp } from 'firebase/firestore';

// Helper to create a mock Timestamp
const createMockTimestamp = (date: Date) => ({
  toDate: () => date,
  seconds: Math.floor(date.getTime() / 1000),
  nanoseconds: 0,
}) as unknown as Timestamp;

describe('Firestore Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('formatDateString', () => {
    it('should format date as YYYY-MM-DD', () => {
      const date = new Date('2026-01-20T15:30:00');
      expect(formatDateString(date)).toBe('2026-01-20');
    });

    it('should pad single digit month and day', () => {
      const date = new Date('2026-03-05T10:00:00');
      expect(formatDateString(date)).toBe('2026-03-05');
    });
  });

  describe('saveDailyLog', () => {
    it('should save daily log to Firestore', async () => {
      const mockDocRef = { id: 'test-doc-id' };
      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (setDoc as jest.Mock).mockResolvedValue(undefined);

      const dailyLog: Omit<DailyLog, 'id' | 'createdAt'> = {
        userId: 'user-123',
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

      expect(doc).toHaveBeenCalled();
      expect(setDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          userId: 'user-123',
          date: '2026-01-20',
          hasPushed: true,
        })
      );
    });
  });

  describe('getDailyLog', () => {
    it('should return daily log when it exists', async () => {
      const mockData = {
        userId: 'user-123',
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
        id: 'doc-id',
        data: () => mockData,
      });

      const result = await getDailyLog('user-123', '2026-01-20');

      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user-123');
      expect(result?.date).toBe('2026-01-20');
    });

    it('should return null when daily log does not exist', async () => {
      (doc as jest.Mock).mockReturnValue({ id: 'doc-id' });
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => false,
      });

      const result = await getDailyLog('user-123', '2026-01-20');

      expect(result).toBeNull();
    });
  });

  describe('getUserDailyLogs', () => {
    it('should return array of daily logs', async () => {
      const mockDocs = [
        {
          id: 'log-1',
          data: () => ({
            userId: 'user-123',
            date: '2026-01-20',
            hasPushed: true,
          }),
        },
        {
          id: 'log-2',
          data: () => ({
            userId: 'user-123',
            date: '2026-01-19',
            hasPushed: false,
          }),
        },
      ];

      (query as jest.Mock).mockReturnValue({});
      (getDocs as jest.Mock).mockResolvedValue({
        docs: mockDocs,
      });

      const result = await getUserDailyLogs('user-123', 10);

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2026-01-20');
      expect(result[1].date).toBe('2026-01-19');
    });
  });

  describe('updateUserStats', () => {
    it('should update user stats in Firestore', async () => {
      const mockDocRef = { id: 'user-123' };
      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const newStats: UserStats = {
        currentMonthStudyDays: 15,
        currentMonthSkipDays: 3,
        totalStudyDays: 100,
        totalSkipDays: 20,
        currentStreak: 7,
        longestStreak: 30,
        lastStudyDate: createMockTimestamp(new Date()),
        lastCheckedDate: createMockTimestamp(new Date()),
      };

      await updateUserStats('user-123', newStats);

      expect(doc).toHaveBeenCalled();
      expect(updateDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          stats: newStats,
        })
      );
    });
  });

  describe('updateUserBadges', () => {
    it('should add new badges to user', async () => {
      const mockDocRef = { id: 'user-123' };
      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({ badges: ['badge-1', 'badge-2'] }),
      });
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await updateUserBadges('user-123', ['badge-3', 'badge-4']);

      expect(updateDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          badges: ['badge-1', 'badge-2', 'badge-3', 'badge-4'],
        })
      );
    });

    it('should not duplicate existing badges', async () => {
      const mockDocRef = { id: 'user-123' };
      (doc as jest.Mock).mockReturnValue(mockDocRef);
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({ badges: ['badge-1', 'badge-2'] }),
      });
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await updateUserBadges('user-123', ['badge-2', 'badge-3']);

      expect(updateDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          badges: ['badge-1', 'badge-2', 'badge-3'],
        })
      );
    });
  });
});
