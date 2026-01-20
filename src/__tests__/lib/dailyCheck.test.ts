// Mock dependencies
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {},
  },
}));

jest.mock('../../lib/github', () => ({
  hasPushedToday: jest.fn(),
  fetchTodayPushEvents: jest.fn(),
  countTotalCommits: jest.fn(),
}));

jest.mock('../../lib/twitter', () => ({
  postTweet: jest.fn(),
}));

import { Timestamp } from 'firebase/firestore';
import {
  checkDailyStudy,
  shouldPostSkipTweet,
  shouldPostStreakTweet,
  generateSkipTweetText,
  generateStreakTweetText,
} from '../../lib/dailyCheck';
import { User, UserGoal } from '../../types';
import { hasPushedToday } from '../../lib/github';

// Helper to create a mock Timestamp
const createMockTimestamp = (date: Date) => ({
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
    currentStreak: 5,
    longestStreak: 15,
    lastStudyDate: createMockTimestamp(new Date('2026-01-19')),
    lastCheckedDate: createMockTimestamp(new Date('2026-01-19')),
  },
  badges: [],
  fcmToken: null,
  notificationsEnabled: true,
  onboardingCompleted: true,
  isAdmin: false,
  subscription: null,
  ...overrides,
});

describe('Daily Check Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkDailyStudy', () => {
    it('should return study result when user has pushed today', async () => {
      (hasPushedToday as jest.Mock).mockResolvedValueOnce(true);

      const user = createMockUser();
      const result = await checkDailyStudy(user, new Date('2026-01-20'));

      expect(result.hasPushed).toBe(true);
      expect(result.isSkipped).toBe(false);
      expect(result.newStreak).toBe(6); // 5 + 1
    });

    it('should return skip result when user has not pushed today', async () => {
      (hasPushedToday as jest.Mock).mockResolvedValueOnce(false);

      const user = createMockUser();
      const result = await checkDailyStudy(user, new Date('2026-01-20'));

      expect(result.hasPushed).toBe(false);
      expect(result.isSkipped).toBe(true);
      expect(result.newStreak).toBe(0);
    });

    it('should throw error when GitHub is not linked', async () => {
      const user = createMockUser({ githubLinked: false });

      await expect(checkDailyStudy(user, new Date())).rejects.toThrow('GitHub account not linked');
    });
  });

  describe('shouldPostSkipTweet', () => {
    it('should return true when X is linked', () => {
      const user = createMockUser({ xLinked: true });
      expect(shouldPostSkipTweet(user)).toBe(true);
    });

    it('should return false when X is not linked', () => {
      const user = createMockUser({ xLinked: false });
      expect(shouldPostSkipTweet(user)).toBe(false);
    });
  });

  describe('shouldPostStreakTweet', () => {
    it('should return true when streak is a milestone and X is linked', () => {
      const user = createMockUser({ xLinked: true });
      expect(shouldPostStreakTweet(user, 7)).toBe(true);
      expect(shouldPostStreakTweet(user, 30)).toBe(true);
      expect(shouldPostStreakTweet(user, 100)).toBe(true);
      expect(shouldPostStreakTweet(user, 365)).toBe(true);
    });

    it('should return false when streak is not a milestone', () => {
      const user = createMockUser({ xLinked: true });
      expect(shouldPostStreakTweet(user, 5)).toBe(false);
      expect(shouldPostStreakTweet(user, 8)).toBe(false);
    });

    it('should return false when X is not linked', () => {
      const user = createMockUser({ xLinked: false });
      expect(shouldPostStreakTweet(user, 7)).toBe(false);
    });
  });

  describe('generateSkipTweetText', () => {
    it('should generate correct skip tweet with user goal', () => {
      const user = createMockUser({
        goal: {
          deadline: createMockTimestamp(new Date('2026-12-31')),
          skills: ['TypeScript', 'React'],
          targetIncome: 100,
          incomeType: 'monthly',
        },
        stats: {
          currentMonthStudyDays: 10,
          currentMonthSkipDays: 3,
          totalStudyDays: 50,
          totalSkipDays: 11,
          currentStreak: 0,
          longestStreak: 15,
          lastStudyDate: null,
          lastCheckedDate: null,
        },
      });

      const text = generateSkipTweetText(user);

      expect(text).toContain('月収100万');
      expect(text).toContain('TypeScript、React');
      expect(text).toContain('#今月3回目');
      expect(text).toContain('#累計11回');
      expect(text).toContain('#バツガク');
    });

    it('should handle yearly income type', () => {
      const user = createMockUser({
        goal: {
          deadline: createMockTimestamp(new Date('2026-12-31')),
          skills: ['Python'],
          targetIncome: 1000,
          incomeType: 'yearly',
        },
      });

      const text = generateSkipTweetText(user);

      expect(text).toContain('年収1000万');
    });
  });

  describe('generateStreakTweetText', () => {
    it('should generate correct streak tweet', () => {
      const user = createMockUser({
        goal: {
          deadline: createMockTimestamp(new Date('2026-12-31')),
          skills: ['TypeScript', 'React'],
          targetIncome: 100,
          incomeType: 'monthly',
        },
      });

      const text = generateStreakTweetText(user, 30);

      expect(text).toContain('TypeScript、React');
      expect(text).toContain('30日連続達成');
      expect(text).toContain('#30日連続');
      expect(text).toContain('#バツガク');
    });
  });
});
