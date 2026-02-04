import { Timestamp } from 'firebase/firestore';
import {
  checkTotalDaysAchievement,
  checkStreakAchievement,
  shouldPostTotalDaysAchievement,
  shouldPostStreakAchievement,
  generateTotalDaysAchievementText,
  generateStreakAchievementText,
  postTotalDaysAchievementTweet,
  postStreakAchievementTweet,
  postAchievementTweetsAfterDailyCheck,
} from '../../lib/achievementTweetService';
import { User } from '../../types';
import * as twitter from '../../lib/twitter';
import * as firestoreService from '../../lib/firestoreService';

// モック
jest.mock('../../lib/twitter');
jest.mock('../../lib/firestoreService');

const mockPostTweet = twitter.postTweet as jest.MockedFunction<typeof twitter.postTweet>;
const mockUpdateUser = firestoreService.updateUser as jest.MockedFunction<typeof firestoreService.updateUser>;

describe('achievementTweetService', () => {
  const mockTimestamp = {
    toDate: () => new Date('2026-12-31'),
    seconds: 1798761600,
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
      skills: ['TypeScript', 'React'],
      targetIncome: 100,
      incomeType: 'monthly',
    },
    stats: {
      currentMonthStudyDays: 5,
      currentMonthSkipDays: 0,
      totalStudyDays: 10,
      totalSkipDays: 0,
      currentStreak: 5,
      longestStreak: 10,
      lastStudyDate: mockTimestamp,
      lastCheckedDate: mockTimestamp,
    },
    badges: [],
    fcmToken: null,
    notificationsEnabled: true,
    onboardingCompleted: true,
    goalTweetPosted: true,
    postedTotalDaysMilestones: [],
    postedStreakMilestones: [],
    isAdmin: false,
    subscription: {
      isActive: true,
      productId: 'monthly_300',
      purchasedAt: mockTimestamp,
      expiresAt: mockTimestamp,
      originalTransactionId: 'txn-123',
    },
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPostTweet.mockResolvedValue({ data: { id: 'tweet-123', text: 'test' } });
    mockUpdateUser.mockResolvedValue();
  });

  describe('checkTotalDaysAchievement', () => {
    it('5日達成時にマイルストーンを返す', () => {
      expect(checkTotalDaysAchievement(5, [])).toBe(5);
    });

    it('10日達成時にマイルストーンを返す', () => {
      expect(checkTotalDaysAchievement(10, [5])).toBe(10);
    });

    it('20日達成時にマイルストーンを返す（10日ごと）', () => {
      expect(checkTotalDaysAchievement(20, [5, 10])).toBe(20);
    });

    it('既に投稿済みの場合はnullを返す', () => {
      expect(checkTotalDaysAchievement(10, [5, 10])).toBe(null);
    });

    it('マイルストーン未達の場合はnullを返す', () => {
      expect(checkTotalDaysAchievement(4, [])).toBe(null);
    });

    it('複数マイルストーン未投稿の場合は最小のものを返す', () => {
      expect(checkTotalDaysAchievement(30, [])).toBe(5);
    });
  });

  describe('checkStreakAchievement', () => {
    it('3日達成時にマイルストーンを返す', () => {
      expect(checkStreakAchievement(3, [])).toBe(3);
    });

    it('5日達成時にマイルストーンを返す', () => {
      expect(checkStreakAchievement(5, [3])).toBe(5);
    });

    it('10日達成時にマイルストーンを返す（5日ごと）', () => {
      expect(checkStreakAchievement(10, [3, 5])).toBe(10);
    });

    it('既に投稿済みの場合はnullを返す', () => {
      expect(checkStreakAchievement(5, [3, 5])).toBe(null);
    });

    it('マイルストーン未達の場合はnullを返す', () => {
      expect(checkStreakAchievement(2, [])).toBe(null);
    });
  });

  describe('shouldPostTotalDaysAchievement', () => {
    it('条件を満たす場合はtrueを返す', () => {
      const user = createMockUser({
        stats: {
          ...createMockUser().stats,
          totalStudyDays: 10,
        },
        postedTotalDaysMilestones: [5],
      });
      expect(shouldPostTotalDaysAchievement(user)).toBe(true);
    });

    it('X連携がない場合はfalseを返す', () => {
      const user = createMockUser({
        xLinked: false,
        xAccessToken: null,
      });
      expect(shouldPostTotalDaysAchievement(user)).toBe(false);
    });

    it('目標が設定されていない場合はfalseを返す', () => {
      const user = createMockUser({ goal: null });
      expect(shouldPostTotalDaysAchievement(user)).toBe(false);
    });

    it('マイルストーン未達の場合はfalseを返す', () => {
      const user = createMockUser({
        stats: {
          ...createMockUser().stats,
          totalStudyDays: 4,
        },
      });
      expect(shouldPostTotalDaysAchievement(user)).toBe(false);
    });
  });

  describe('shouldPostStreakAchievement', () => {
    it('条件を満たす場合はtrueを返す', () => {
      const user = createMockUser({
        stats: {
          ...createMockUser().stats,
          currentStreak: 5,
        },
        postedStreakMilestones: [3],
      });
      expect(shouldPostStreakAchievement(user)).toBe(true);
    });

    it('X連携がない場合はfalseを返す', () => {
      const user = createMockUser({
        xLinked: false,
        xAccessToken: null,
      });
      expect(shouldPostStreakAchievement(user)).toBe(false);
    });

    it('マイルストーン未達の場合はfalseを返す', () => {
      const user = createMockUser({
        stats: {
          ...createMockUser().stats,
          currentStreak: 2,
        },
      });
      expect(shouldPostStreakAchievement(user)).toBe(false);
    });
  });

  describe('generateTotalDaysAchievementText', () => {
    it('正しいフォーマットでツイートを生成する', () => {
      const user = createMockUser();
      const text = generateTotalDaysAchievementText(user, 10);

      expect(text).toContain('12月31日');
      expect(text).toContain('TypeScript');
      expect(text).toContain('月収');
      expect(text).toContain('100万円');
      expect(text).toContain('通算10日');
      expect(text).toContain('#バツガク');
    });

    it('目標がない場合は簡易フォーマットを使用する', () => {
      const user = createMockUser({ goal: null });
      const text = generateTotalDaysAchievementText(user, 10);

      expect(text).toContain('通算10日');
      expect(text).toContain('#バツガク');
    });
  });

  describe('generateStreakAchievementText', () => {
    it('正しいフォーマットでツイートを生成する', () => {
      const user = createMockUser();
      const text = generateStreakAchievementText(user, 5);

      expect(text).toContain('12月31日');
      expect(text).toContain('TypeScript');
      expect(text).toContain('月収');
      expect(text).toContain('100万円');
      expect(text).toContain('5日連続');
      expect(text).toContain('#バツガク');
    });

    it('目標がない場合は簡易フォーマットを使用する', () => {
      const user = createMockUser({ goal: null });
      const text = generateStreakAchievementText(user, 5);

      expect(text).toContain('5日連続');
      expect(text).toContain('#バツガク');
    });
  });

  describe('postTotalDaysAchievementTweet', () => {
    it('ツイートを投稿してマイルストーンを更新する', async () => {
      const user = createMockUser({
        stats: {
          ...createMockUser().stats,
          totalStudyDays: 10,
        },
        postedTotalDaysMilestones: [5],
      });

      const result = await postTotalDaysAchievementTweet(user);

      expect(result.success).toBe(true);
      expect(result.milestone).toBe(10);
      expect(mockPostTweet).toHaveBeenCalled();
      expect(mockUpdateUser).toHaveBeenCalledWith(user.uid, {
        postedTotalDaysMilestones: [5, 10],
      });
    });

    it('投稿対象がない場合は何もしない', async () => {
      const user = createMockUser({
        stats: {
          ...createMockUser().stats,
          totalStudyDays: 4,
        },
      });

      const result = await postTotalDaysAchievementTweet(user);

      expect(result.success).toBe(true);
      expect(result.milestone).toBeUndefined();
      expect(mockPostTweet).not.toHaveBeenCalled();
    });

    it('Xトークンがない場合はエラーを返す', async () => {
      const user = createMockUser({ xAccessToken: null });

      const result = await postTotalDaysAchievementTweet(user);

      expect(result.success).toBe(false);
      expect(result.error).toContain('X（Twitter）との連携が必要です');
    });

    it('投稿失敗時はエラーを返す', async () => {
      mockPostTweet.mockRejectedValue(new Error('API Error'));
      const user = createMockUser({
        stats: {
          ...createMockUser().stats,
          totalStudyDays: 10,
        },
        postedTotalDaysMilestones: [5],
      });

      const result = await postTotalDaysAchievementTweet(user);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
    });
  });

  describe('postStreakAchievementTweet', () => {
    it('ツイートを投稿してマイルストーンを更新する', async () => {
      const user = createMockUser({
        stats: {
          ...createMockUser().stats,
          currentStreak: 5,
        },
        postedStreakMilestones: [3],
      });

      const result = await postStreakAchievementTweet(user);

      expect(result.success).toBe(true);
      expect(result.milestone).toBe(5);
      expect(mockPostTweet).toHaveBeenCalled();
      expect(mockUpdateUser).toHaveBeenCalledWith(user.uid, {
        postedStreakMilestones: [3, 5],
      });
    });

    it('投稿対象がない場合は何もしない', async () => {
      const user = createMockUser({
        stats: {
          ...createMockUser().stats,
          currentStreak: 2,
        },
      });

      const result = await postStreakAchievementTweet(user);

      expect(result.success).toBe(true);
      expect(result.milestone).toBeUndefined();
      expect(mockPostTweet).not.toHaveBeenCalled();
    });
  });

  describe('postAchievementTweetsAfterDailyCheck', () => {
    it('両方の達成ツイートを投稿する', async () => {
      const user = createMockUser({
        stats: {
          ...createMockUser().stats,
          totalStudyDays: 10,
          currentStreak: 5,
        },
        postedTotalDaysMilestones: [5],
        postedStreakMilestones: [3],
      });

      const result = await postAchievementTweetsAfterDailyCheck(user);

      expect(result.totalDaysResult.success).toBe(true);
      expect(result.totalDaysResult.milestone).toBe(10);
      expect(result.streakResult.success).toBe(true);
      expect(result.streakResult.milestone).toBe(5);
      expect(mockPostTweet).toHaveBeenCalledTimes(2);
    });
  });
});
