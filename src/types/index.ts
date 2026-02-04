import { Timestamp } from 'firebase/firestore';

// ユーザー情報
export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  createdAt: Timestamp;

  // OAuth連携
  googleLinked: boolean;
  xLinked: boolean;
  xUserId: string | null;
  xAccessToken: string | null;
  xRefreshToken: string | null;
  xTokenExpiresAt: Timestamp | null;
  githubLinked: boolean;
  githubUsername: string | null;
  githubAccessToken: string | null;

  // 目標設定
  goal: UserGoal | null;

  // 統計
  stats: UserStats;

  // バッジ
  badges: string[];

  // 通知設定
  fcmToken: string | null;
  notificationsEnabled: boolean;

  // 初回設定完了フラグ
  onboardingCompleted: boolean;

  // 初回目標投稿済みフラグ
  goalTweetPosted: boolean;

  // 達成ツイート投稿済みマイルストーン
  postedTotalDaysMilestones: number[];  // 投稿済みの通算日数マイルストーン
  postedStreakMilestones: number[];     // 投稿済みの連続日数マイルストーン

  // 管理者フラグ（サブスクバイパス用）
  isAdmin: boolean;

  // サブスクリプション
  subscription: UserSubscription | null;
}

export interface UserGoal {
  deadline: Timestamp;
  skills: string[];
  targetIncome: number;
  incomeType: 'monthly' | 'yearly';
}

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

// サブスクリプション情報
export interface UserSubscription {
  isActive: boolean;
  productId: string;
  purchasedAt: Timestamp;
  expiresAt: Timestamp;
  originalTransactionId: string;
}

// 日次ログ
export interface DailyLog {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  hasPushed: boolean;
  pushCount: number;
  pushedAt: Timestamp | null;
  skipped: boolean;
  tweetedSkip: boolean;
  tweetedStreak: boolean;
  streakMilestone: number | null; // 5, 10, 15...
  createdAt: Timestamp;
}

// バッジ定義
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'streak' | 'total_study' | 'total_skip';
  requirement: number;
}

// アプリ全体統計
export interface AppStats {
  totalUsers: number;
  todayStudyCount: number;
  todaySkipCount: number;
  lastUpdated: Timestamp;
}

// GitHub関連
export interface GitHubPushEvent {
  id: string;
  type: string;
  repo: {
    name: string;
  };
  created_at: string;
  payload: {
    commits?: Array<{
      sha: string;
      message: string;
    }>;
  };
}

// X (Twitter) 関連
export interface XTweetRequest {
  text: string;
}

export interface XTweetResponse {
  data: {
    id: string;
    text: string;
  };
}

// 認証コンテキスト
export interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  linkXAccount: () => Promise<void>;
  linkGitHubAccount: () => Promise<void>;
  unlinkXAccount: () => Promise<void>;
  unlinkGitHubAccount: () => Promise<void>;
}

// ナビゲーション
export type RootStackParamList = {
  '(auth)': undefined;
  '(main)': undefined;
  onboarding: undefined;
};
