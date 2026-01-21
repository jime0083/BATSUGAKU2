import { Timestamp } from 'firebase-admin/firestore';

/**
 * ユーザーの目標設定
 */
export interface UserGoal {
  targetIncome: number;
  incomeType: 'monthly' | 'yearly';
  skills: string[];
  deadline: Timestamp;
}

/**
 * ユーザーの統計情報
 */
export interface UserStats {
  currentMonthStudyDays: number;
  currentMonthSkipDays: number;
  totalStudyDays: number;
  totalSkipDays: number;
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: Timestamp | null;
  lastCheckedDate: Timestamp | null;
}

/**
 * サブスクリプション情報
 */
export interface UserSubscription {
  isActive: boolean;
  productId: string;
  purchasedAt: Timestamp;
  expiresAt: Timestamp;
  originalTransactionId: string;
}

/**
 * ユーザー情報
 */
export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  createdAt: Timestamp;
  googleLinked: boolean;
  xLinked: boolean;
  xUserId: string | null;
  xAccessToken: string | null;
  xRefreshToken: string | null;
  xTokenExpiresAt: Timestamp | null;
  githubLinked: boolean;
  githubUsername: string | null;
  githubAccessToken: string | null;
  goal: UserGoal | null;
  stats: UserStats;
  badges: string[];
  fcmToken: string | null;
  notificationsEnabled: boolean;
  onboardingCompleted: boolean;
  isAdmin: boolean;
  subscription: UserSubscription | null;
}

/**
 * 日次ログ
 */
export interface DailyLog {
  id?: string;
  userId: string;
  date: string; // YYYY-MM-DD
  hasPushed: boolean;
  checkedAt: Timestamp;
  tweetedSkip: boolean;
  tweetedStreak: boolean;
  streakAtCheck: number;
  earnedBadges: string[];
}

/**
 * 日次チェック結果
 */
export interface DailyCheckResult {
  userId: string;
  hasPushed: boolean;
  newStreak: number;
  tweetedSkip: boolean;
  tweetedStreak: boolean;
  error?: string;
}

/**
 * 日次統計
 */
export interface DailyStats {
  date: string;
  totalUsers: number;
  studyCount: number;
  skipCount: number;
  createdAt: Timestamp;
}
