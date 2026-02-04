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

jest.mock('../../lib/firestoreService', () => ({
  saveDailyCheckResult: jest.fn(),
  getDailyLog: jest.fn(),
  formatDateString: jest.fn((date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }),
}));

import { Timestamp } from 'firebase/firestore';
import {
  performDailyCheck,
  hasCheckedToday,
} from '../../lib/dailyCheckService';
import { User } from '../../types';
import { hasPushedToday, fetchTodayPushEvents, countTotalCommits } from '../../lib/github';
import { postTweet } from '../../lib/twitter';
import { saveDailyCheckResult, getDailyLog } from '../../lib/firestoreService';

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
    currentStreak: 6,
    longestStreak: 15,
    lastStudyDate: createMockTimestamp(new Date('2026-01-19')),
    lastCheckedDate: createMockTimestamp(new Date('2026-01-19')),
  },
  badges: [],
  fcmToken: null,
  notificationsEnabled: true,
  onboardingCompleted: true,
  goalTweetPosted: false,
  postedTotalDaysMilestones: [],
  postedStreakMilestones: [],
  isAdmin: false,
  subscription: null,
  ...overrides,
});

describe('Daily Check Service (Integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('performDailyCheck', () => {
    it('should perform full daily check when user has pushed', async () => {
      const user = createMockUser();
      const mockEvents = [{ id: '1', payload: { commits: [{}, {}, {}] } }];

      (hasPushedToday as jest.Mock).mockResolvedValue(true);
      (fetchTodayPushEvents as jest.Mock).mockResolvedValue(mockEvents);
      (countTotalCommits as jest.Mock).mockReturnValue(3);
      (saveDailyCheckResult as jest.Mock).mockResolvedValue(undefined);

      const result = await performDailyCheck(user, new Date('2026-01-20'));

      expect(result.success).toBe(true);
      expect(result.hasPushed).toBe(true);
      expect(result.newStreak).toBe(7);
      expect(saveDailyCheckResult).toHaveBeenCalled();
    });

    it('should post skip tweet when user has not pushed and X is linked', async () => {
      const user = createMockUser();

      (hasPushedToday as jest.Mock).mockResolvedValue(false);
      (postTweet as jest.Mock).mockResolvedValue({ data: { id: '123' } });
      (saveDailyCheckResult as jest.Mock).mockResolvedValue(undefined);

      const result = await performDailyCheck(user, new Date('2026-01-20'));

      expect(result.success).toBe(true);
      expect(result.hasPushed).toBe(false);
      expect(result.tweetedSkip).toBe(true);
      expect(postTweet).toHaveBeenCalled();
    });

    it('should post streak tweet when milestone is reached', async () => {
      const user = createMockUser({
        stats: {
          ...createMockUser().stats,
          currentStreak: 6,
          lastStudyDate: createMockTimestamp(new Date('2026-01-19')),
        },
      });

      (hasPushedToday as jest.Mock).mockResolvedValue(true);
      (fetchTodayPushEvents as jest.Mock).mockResolvedValue([]);
      (countTotalCommits as jest.Mock).mockReturnValue(1);
      (postTweet as jest.Mock).mockResolvedValue({ data: { id: '123' } });
      (saveDailyCheckResult as jest.Mock).mockResolvedValue(undefined);

      const result = await performDailyCheck(user, new Date('2026-01-20'));

      expect(result.success).toBe(true);
      expect(result.newStreak).toBe(7);
      expect(result.streakMilestone).toBe(7);
      expect(result.tweetedStreak).toBe(true);
    });

    it('should not post tweet when X is not linked', async () => {
      const user = createMockUser({ xLinked: false, xAccessToken: null });

      (hasPushedToday as jest.Mock).mockResolvedValue(false);
      (saveDailyCheckResult as jest.Mock).mockResolvedValue(undefined);

      const result = await performDailyCheck(user, new Date('2026-01-20'));

      expect(result.success).toBe(true);
      expect(result.tweetedSkip).toBe(false);
      expect(postTweet).not.toHaveBeenCalled();
    });

    it('should return error when GitHub is not linked', async () => {
      const user = createMockUser({ githubLinked: false });

      const result = await performDailyCheck(user, new Date('2026-01-20'));

      expect(result.success).toBe(false);
      expect(result.error).toBe('GitHub account not linked');
    });
  });

  describe('hasCheckedToday', () => {
    it('should return true when daily log exists for today', async () => {
      (getDailyLog as jest.Mock).mockResolvedValue({
        id: 'log-1',
        date: '2026-01-20',
      });

      const result = await hasCheckedToday('user-123', new Date('2026-01-20'));

      expect(result).toBe(true);
    });

    it('should return false when no daily log exists for today', async () => {
      (getDailyLog as jest.Mock).mockResolvedValue(null);

      const result = await hasCheckedToday('user-123', new Date('2026-01-20'));

      expect(result).toBe(false);
    });
  });
});
