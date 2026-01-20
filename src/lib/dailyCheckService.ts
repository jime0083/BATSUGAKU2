import { User } from '../types';
import { hasPushedToday, fetchTodayPushEvents, countTotalCommits } from './github';
import { postTweet } from './twitter';
import { recordStudyDay, recordSkipDay, checkStreakMilestone } from './utils/stats';
import {
  saveDailyCheckResult,
  getDailyLog,
  formatDateString,
} from './firestoreService';
import {
  checkEarnableBadges,
  generateSkipTweetText,
  generateStreakTweetText,
} from './dailyCheck';

/**
 * 日次チェック結果
 */
export interface DailyCheckResult {
  success: boolean;
  error?: string;
  hasPushed: boolean;
  pushCount: number;
  newStreak: number;
  streakMilestone: number | null;
  newBadges: string[];
  tweetedSkip: boolean;
  tweetedStreak: boolean;
}

/**
 * 日次チェックを実行し、結果をFirestoreに保存
 */
export async function performDailyCheck(
  user: User,
  date: Date = new Date()
): Promise<DailyCheckResult> {
  // GitHub連携チェック
  if (!user.githubLinked || !user.githubUsername || !user.githubAccessToken) {
    return {
      success: false,
      error: 'GitHub account not linked',
      hasPushed: false,
      pushCount: 0,
      newStreak: 0,
      streakMilestone: null,
      newBadges: [],
      tweetedSkip: false,
      tweetedStreak: false,
    };
  }

  try {
    // GitHub pushチェック
    const hasPushed = await hasPushedToday(user.githubUsername, user.githubAccessToken);

    let pushCount = 0;
    if (hasPushed) {
      const events = await fetchTodayPushEvents(user.githubUsername, user.githubAccessToken);
      pushCount = countTotalCommits(events);
    }

    // 統計更新
    let newStats;
    let newStreak: number;
    let streakMilestone: number | null = null;

    if (hasPushed) {
      newStats = recordStudyDay(user.stats, date);
      newStreak = newStats.currentStreak;
      streakMilestone = checkStreakMilestone(newStreak);
    } else {
      newStats = recordSkipDay(user.stats, date);
      newStreak = 0;
    }

    // バッジチェック
    const newBadges = checkEarnableBadges(user, newStreak, !hasPushed);

    // ツイート投稿
    let tweetedSkip = false;
    let tweetedStreak = false;

    if (user.xLinked && user.xAccessToken) {
      // サボりツイート
      if (!hasPushed) {
        try {
          const skipText = generateSkipTweetText(user);
          await postTweet(user.xAccessToken, skipText);
          tweetedSkip = true;
        } catch (error) {
          console.error('Failed to post skip tweet:', error);
        }
      }

      // ストリークツイート
      if (hasPushed && streakMilestone !== null) {
        try {
          const streakText = generateStreakTweetText(user, streakMilestone);
          await postTweet(user.xAccessToken, streakText);
          tweetedStreak = true;
        } catch (error) {
          console.error('Failed to post streak tweet:', error);
        }
      }
    }

    // Firestoreに保存
    await saveDailyCheckResult({
      userId: user.uid,
      date,
      hasPushed,
      pushCount,
      newStats,
      newBadges,
      tweetedSkip,
      tweetedStreak,
      streakMilestone,
    });

    return {
      success: true,
      hasPushed,
      pushCount,
      newStreak,
      streakMilestone,
      newBadges,
      tweetedSkip,
      tweetedStreak,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
      hasPushed: false,
      pushCount: 0,
      newStreak: 0,
      streakMilestone: null,
      newBadges: [],
      tweetedSkip: false,
      tweetedStreak: false,
    };
  }
}

/**
 * 今日既にチェック済みかどうか
 */
export async function hasCheckedToday(
  userId: string,
  date: Date = new Date()
): Promise<boolean> {
  const dateString = formatDateString(date);
  const log = await getDailyLog(userId, dateString);
  return log !== null;
}

/**
 * 日次チェックを実行可能かどうか
 */
export function canPerformDailyCheck(user: User): {
  canCheck: boolean;
  reason?: string;
} {
  if (!user.githubLinked) {
    return { canCheck: false, reason: 'GitHubアカウントを連携してください' };
  }

  if (!user.onboardingCompleted) {
    return { canCheck: false, reason: '初期設定を完了してください' };
  }

  return { canCheck: true };
}
