import { Timestamp } from 'firebase/firestore';
import {
  generateGoalTweetText,
  shouldPostGoalTweet,
  hasPostedGoalTweet,
  postGoalTweet,
} from '../../lib/goalTweetService';
import { User } from '../../types';
import * as twitter from '../../lib/twitter';
import * as firestoreService from '../../lib/firestoreService';

// モック
jest.mock('../../lib/twitter');
jest.mock('../../lib/firestoreService');

const mockPostTweet = twitter.postTweet as jest.MockedFunction<typeof twitter.postTweet>;
const mockUpdateUser = firestoreService.updateUser as jest.MockedFunction<typeof firestoreService.updateUser>;
const mockGetUser = firestoreService.getUser as jest.MockedFunction<typeof firestoreService.getUser>;

describe('goalTweetService', () => {
  const mockTimestamp = {
    toDate: () => new Date('2026-12-01'),
    seconds: 1796313600,
    nanoseconds: 0,
  } as Timestamp;

  const createMockUser = (overrides: Partial<User> = {}): User => ({
    uid: 'test-user-id',
    email: 'test@example.com',
    displayName: 'Test User',
    photoURL: null,
    createdAt: mockTimestamp,
    googleLinked: true,
    xLinked: true,
    xUserId: 'x-user-id',
    xAccessToken: 'x-access-token',
    xRefreshToken: 'x-refresh-token',
    xTokenExpiresAt: mockTimestamp,
    githubLinked: true,
    githubUsername: 'testuser',
    githubAccessToken: 'github-token',
    goal: {
      deadline: mockTimestamp,
      skills: ['React Native'],
      targetIncome: 50,
      incomeType: 'monthly',
    },
    stats: {
      currentMonthStudyDays: 0,
      currentMonthSkipDays: 0,
      totalStudyDays: 0,
      totalSkipDays: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastStudyDate: null,
      lastCheckedDate: null,
    },
    badges: [],
    fcmToken: null,
    notificationsEnabled: true,
    onboardingCompleted: true,
    goalTweetPosted: false,
    postedTotalDaysMilestones: [],
    postedStreakMilestones: [],
    isAdmin: false,
    subscription: {
      isActive: true,
      productId: 'batsugaku_monthly_300',
      purchasedAt: mockTimestamp,
      expiresAt: mockTimestamp,
      originalTransactionId: 'txn-123',
    },
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateGoalTweetText', () => {
    it('should generate correct tweet text with monthly income', () => {
      const result = generateGoalTweetText(
        mockTimestamp,
        'React Native',
        'monthly',
        50
      );

      expect(result).toContain('2026.12');
      expect(result).toContain('React Native');
      expect(result).toContain('月収');
      expect(result).toContain('50');
      expect(result).toContain('#バツガク');
    });

    it('should generate correct tweet text with yearly income', () => {
      const result = generateGoalTweetText(
        mockTimestamp,
        'Python',
        'yearly',
        600
      );

      expect(result).toContain('年収');
      expect(result).toContain('600');
    });

    it('should handle Date object as deadline', () => {
      const date = new Date('2027-06-15');
      const result = generateGoalTweetText(date, 'TypeScript', 'monthly', 80);

      expect(result).toContain('2027.06');
    });
  });

  describe('shouldPostGoalTweet', () => {
    it('should return true when all conditions are met', () => {
      const user = createMockUser();
      expect(shouldPostGoalTweet(user)).toBe(true);
    });

    it('should return false when subscription is not active', () => {
      const user = createMockUser({
        subscription: null,
      });
      expect(shouldPostGoalTweet(user)).toBe(false);
    });

    it('should return false when X is not linked', () => {
      const user = createMockUser({
        xLinked: false,
        xAccessToken: null,
      });
      expect(shouldPostGoalTweet(user)).toBe(false);
    });

    it('should return false when goal is not set', () => {
      const user = createMockUser({
        goal: null,
      });
      expect(shouldPostGoalTweet(user)).toBe(false);
    });

    it('should return false when goal tweet is already posted', () => {
      const user = createMockUser({
        goalTweetPosted: true,
      });
      expect(shouldPostGoalTweet(user)).toBe(false);
    });
  });

  describe('hasPostedGoalTweet', () => {
    it('should return true when goalTweetPosted is true', async () => {
      mockGetUser.mockResolvedValue(createMockUser({ goalTweetPosted: true }));

      const result = await hasPostedGoalTweet('test-user-id');
      expect(result).toBe(true);
    });

    it('should return false when goalTweetPosted is false', async () => {
      mockGetUser.mockResolvedValue(createMockUser({ goalTweetPosted: false }));

      const result = await hasPostedGoalTweet('test-user-id');
      expect(result).toBe(false);
    });

    it('should return false when user does not exist', async () => {
      mockGetUser.mockResolvedValue(null);

      const result = await hasPostedGoalTweet('non-existent-user');
      expect(result).toBe(false);
    });
  });

  describe('postGoalTweet', () => {
    it('should post tweet and update user flag on success', async () => {
      const user = createMockUser();
      mockPostTweet.mockResolvedValue({
        data: { id: 'tweet-123', text: 'test tweet' },
      });
      mockUpdateUser.mockResolvedValue();

      const result = await postGoalTweet(user);

      expect(result.success).toBe(true);
      expect(mockPostTweet).toHaveBeenCalledWith(
        'x-access-token',
        expect.stringContaining('React Native')
      );
      expect(mockUpdateUser).toHaveBeenCalledWith('test-user-id', {
        goalTweetPosted: true,
      });
    });

    it('should skip posting when already posted', async () => {
      const user = createMockUser({ goalTweetPosted: true });

      const result = await postGoalTweet(user);

      expect(result.success).toBe(true);
      expect(mockPostTweet).not.toHaveBeenCalled();
    });

    it('should return error when X is not linked', async () => {
      const user = createMockUser({ xAccessToken: null });

      const result = await postGoalTweet(user);

      expect(result.success).toBe(false);
      expect(result.error).toContain('X（Twitter）との連携が必要');
    });

    it('should return error when goal is not set', async () => {
      const user = createMockUser({ goal: null });

      const result = await postGoalTweet(user);

      expect(result.success).toBe(false);
      expect(result.error).toContain('目標が設定されていません');
    });

    it('should handle API errors', async () => {
      const user = createMockUser();
      mockPostTweet.mockRejectedValue(new Error('API Error'));

      const result = await postGoalTweet(user);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
    });
  });
});
