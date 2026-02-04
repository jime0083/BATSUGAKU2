import { Timestamp } from 'firebase/firestore';
import {
  hasPremiumAccess,
  isSubscriptionActive,
  getSubscriptionDaysRemaining,
  getSubscriptionStatusText,
  getPremiumRequiredReason,
} from '../../lib/subscription';
import { User, UserSubscription } from '../../types';

// Helper to create a mock Timestamp
const createMockTimestamp = (date: Date) =>
  ({
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  }) as unknown as Timestamp;

// Helper to create future date
const futureDate = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

// Helper to create past date
const pastDate = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

// Mock user factory
const createMockUser = (overrides: Partial<User> = {}): User => ({
  uid: 'test-user-id',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: null,
  createdAt: createMockTimestamp(new Date()),
  googleLinked: true,
  xLinked: false,
  xUserId: null,
  xAccessToken: null,
  xRefreshToken: null,
  xTokenExpiresAt: null,
  githubLinked: false,
  githubUsername: null,
  githubAccessToken: null,
  goal: null,
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
  onboardingCompleted: false,
  goalTweetPosted: false,
  postedTotalDaysMilestones: [],
  postedStreakMilestones: [],
  isAdmin: false,
  subscription: null,
  ...overrides,
});

// Mock subscription factory
const createMockSubscription = (
  overrides: Partial<UserSubscription> = {}
): UserSubscription => ({
  isActive: true,
  productId: 'batsugaku_monthly_300',
  purchasedAt: createMockTimestamp(new Date()),
  expiresAt: createMockTimestamp(futureDate(30)),
  originalTransactionId: 'txn_123456',
  ...overrides,
});

describe('Subscription Utils', () => {
  describe('hasPremiumAccess', () => {
    it('should return true for admin user without subscription', () => {
      const user = createMockUser({ isAdmin: true, subscription: null });
      expect(hasPremiumAccess(user)).toBe(true);
    });

    it('should return true for admin user with expired subscription', () => {
      const user = createMockUser({
        isAdmin: true,
        subscription: createMockSubscription({
          isActive: false,
          expiresAt: createMockTimestamp(pastDate(10)),
        }),
      });
      expect(hasPremiumAccess(user)).toBe(true);
    });

    it('should return true for user with active subscription', () => {
      const user = createMockUser({
        isAdmin: false,
        subscription: createMockSubscription(),
      });
      expect(hasPremiumAccess(user)).toBe(true);
    });

    it('should return false for user without subscription', () => {
      const user = createMockUser({ isAdmin: false, subscription: null });
      expect(hasPremiumAccess(user)).toBe(false);
    });

    it('should return false for user with expired subscription', () => {
      const user = createMockUser({
        isAdmin: false,
        subscription: createMockSubscription({
          isActive: false,
          expiresAt: createMockTimestamp(pastDate(10)),
        }),
      });
      expect(hasPremiumAccess(user)).toBe(false);
    });

    it('should return false for user with subscription past expiry date', () => {
      const user = createMockUser({
        isAdmin: false,
        subscription: createMockSubscription({
          isActive: true,
          expiresAt: createMockTimestamp(pastDate(1)),
        }),
      });
      expect(hasPremiumAccess(user)).toBe(false);
    });
  });

  describe('isSubscriptionActive', () => {
    it('should return false for null subscription', () => {
      expect(isSubscriptionActive(null)).toBe(false);
    });

    it('should return false for inactive subscription', () => {
      const subscription = createMockSubscription({ isActive: false });
      expect(isSubscriptionActive(subscription)).toBe(false);
    });

    it('should return false for expired subscription', () => {
      const subscription = createMockSubscription({
        isActive: true,
        expiresAt: createMockTimestamp(pastDate(1)),
      });
      expect(isSubscriptionActive(subscription)).toBe(false);
    });

    it('should return true for active subscription with future expiry', () => {
      const subscription = createMockSubscription({
        isActive: true,
        expiresAt: createMockTimestamp(futureDate(30)),
      });
      expect(isSubscriptionActive(subscription)).toBe(true);
    });
  });

  describe('getSubscriptionDaysRemaining', () => {
    it('should return 0 for null subscription', () => {
      expect(getSubscriptionDaysRemaining(null)).toBe(0);
    });

    it('should return 0 for inactive subscription', () => {
      const subscription = createMockSubscription({ isActive: false });
      expect(getSubscriptionDaysRemaining(subscription)).toBe(0);
    });

    it('should return 0 for expired subscription', () => {
      const subscription = createMockSubscription({
        isActive: true,
        expiresAt: createMockTimestamp(pastDate(10)),
      });
      expect(getSubscriptionDaysRemaining(subscription)).toBe(0);
    });

    it('should return correct days for active subscription', () => {
      const subscription = createMockSubscription({
        isActive: true,
        expiresAt: createMockTimestamp(futureDate(15)),
      });
      const days = getSubscriptionDaysRemaining(subscription);
      expect(days).toBeGreaterThanOrEqual(14);
      expect(days).toBeLessThanOrEqual(16);
    });
  });

  describe('getSubscriptionStatusText', () => {
    it('should return "管理者（無料）" for admin user', () => {
      const user = createMockUser({ isAdmin: true });
      expect(getSubscriptionStatusText(user)).toBe('管理者（無料）');
    });

    it('should return "未登録" for user without subscription', () => {
      const user = createMockUser({ subscription: null });
      expect(getSubscriptionStatusText(user)).toBe('未登録');
    });

    it('should return "期限切れ" for expired subscription', () => {
      const user = createMockUser({
        subscription: createMockSubscription({
          isActive: true,
          expiresAt: createMockTimestamp(pastDate(1)),
        }),
      });
      expect(getSubscriptionStatusText(user)).toBe('期限切れ');
    });

    it('should return active status with days remaining', () => {
      const user = createMockUser({
        subscription: createMockSubscription({
          isActive: true,
          expiresAt: createMockTimestamp(futureDate(10)),
        }),
      });
      const status = getSubscriptionStatusText(user);
      expect(status).toMatch(/^アクティブ（残り\d+日）$/);
    });
  });

  describe('getPremiumRequiredReason', () => {
    it('should return null for admin user', () => {
      const user = createMockUser({ isAdmin: true });
      expect(getPremiumRequiredReason(user)).toBeNull();
    });

    it('should return null for user with active subscription', () => {
      const user = createMockUser({
        subscription: createMockSubscription(),
      });
      expect(getPremiumRequiredReason(user)).toBeNull();
    });

    it('should return registration message for user without subscription', () => {
      const user = createMockUser({ subscription: null });
      expect(getPremiumRequiredReason(user)).toBe(
        'この機能を使用するにはサブスクリプションへの登録が必要です。'
      );
    });

    it('should return expiry message for user with inactive subscription', () => {
      const user = createMockUser({
        subscription: createMockSubscription({ isActive: false }),
      });
      expect(getPremiumRequiredReason(user)).toBe(
        'サブスクリプションが期限切れです。更新してください。'
      );
    });
  });
});
