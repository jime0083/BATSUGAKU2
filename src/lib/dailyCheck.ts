import { User } from '../types';
import { hasPushedToday, fetchTodayPushEvents, countTotalCommits } from './github';
import { postTweet } from './twitter';
import { recordStudyDay, recordSkipDay, checkStreakMilestone } from './utils/stats';
import { TWEET_TEMPLATES, HASHTAG } from '../constants';

// 日次チェック結果
export interface DailyCheckResult {
  hasPushed: boolean;
  isSkipped: boolean;
  pushCount: number;
  newStreak: number;
  streakMilestone: number | null;
  shouldTweetSkip: boolean;
  shouldTweetStreak: boolean;
}

/**
 * ユーザーの日次学習状況をチェックする
 */
export async function checkDailyStudy(user: User, date: Date): Promise<DailyCheckResult> {
  // GitHub連携チェック
  if (!user.githubLinked || !user.githubUsername || !user.githubAccessToken) {
    throw new Error('GitHub account not linked');
  }

  // 今日のpush状況を確認
  const hasPushed = await hasPushedToday(user.githubUsername, user.githubAccessToken);

  let pushCount = 0;
  if (hasPushed) {
    const events = await fetchTodayPushEvents(user.githubUsername, user.githubAccessToken);
    pushCount = countTotalCommits(events);
  }

  // 統計を更新
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

  // ツイート判定
  const shouldTweetSkip = !hasPushed && shouldPostSkipTweet(user);
  const shouldTweetStreak = hasPushed && shouldPostStreakTweet(user, newStreak);

  return {
    hasPushed,
    isSkipped: !hasPushed,
    pushCount,
    newStreak,
    streakMilestone,
    shouldTweetSkip,
    shouldTweetStreak,
  };
}

/**
 * サボりツイートを投稿すべきか判定
 */
export function shouldPostSkipTweet(user: User): boolean {
  return user.xLinked && !!user.xAccessToken;
}

/**
 * ストリークツイートを投稿すべきか判定
 */
export function shouldPostStreakTweet(user: User, streak: number): boolean {
  if (!user.xLinked || !user.xAccessToken) {
    return false;
  }

  const milestone = checkStreakMilestone(streak);
  return milestone !== null;
}

/**
 * サボりツイートのテキストを生成
 */
export function generateSkipTweetText(user: User): string {
  if (!user.goal) {
    return `学習をサボってしまいました... ${HASHTAG}`;
  }

  const { targetIncome, incomeType, skills } = user.goal;
  const { currentMonthSkipDays, totalSkipDays } = user.stats;

  const incomeTypeText = incomeType === 'monthly' ? '月収' : '年収';
  const skillsText = skills.join('、');

  return `私は${incomeTypeText}${targetIncome}万稼ぐエンジニアになるため${skillsText}の学習をすると宣言したにも関わらず、学習をサボった愚かな人間です\n#今月${currentMonthSkipDays}回目 #累計${totalSkipDays}回 ${HASHTAG}`;
}

/**
 * ストリーク達成ツイートのテキストを生成
 */
export function generateStreakTweetText(user: User, streak: number): string {
  const skills = user.goal?.skills || ['プログラミング'];
  const skillsText = skills.join('、');

  return `${skillsText}学習${streak}日連続達成！ #${streak}日連続 ${HASHTAG}`;
}

/**
 * サボりツイートを投稿
 */
export async function postSkipTweet(user: User): Promise<void> {
  if (!user.xAccessToken) {
    throw new Error('X access token not available');
  }

  const text = generateSkipTweetText(user);
  await postTweet(user.xAccessToken, text);
}

/**
 * ストリーク達成ツイートを投稿
 */
export async function postStreakTweet(user: User, streak: number): Promise<void> {
  if (!user.xAccessToken) {
    throw new Error('X access token not available');
  }

  const text = generateStreakTweetText(user, streak);
  await postTweet(user.xAccessToken, text);
}

/**
 * 獲得可能なバッジをチェック
 */
export function checkEarnableBadges(user: User, newStreak: number, isSkipped: boolean): string[] {
  const newBadges: string[] = [];
  const existingBadges = new Set(user.badges);

  // ストリークバッジ
  const streakBadges: { [key: number]: string } = {
    5: 'streak_5',
    10: 'streak_10',
    15: 'streak_15',
    30: 'streak_30',
    100: 'streak_100',
    365: 'streak_365',
  };

  if (newStreak > 0) {
    for (const [threshold, badgeId] of Object.entries(streakBadges)) {
      if (newStreak >= Number(threshold) && !existingBadges.has(badgeId)) {
        newBadges.push(badgeId);
      }
    }
  }

  // 累計学習日数バッジ
  const totalStudyBadges: { [key: number]: string } = {
    10: 'total_10',
    30: 'total_30',
    100: 'total_100',
    365: 'total_365',
  };

  const totalStudyDays = user.stats.totalStudyDays + (isSkipped ? 0 : 1);
  for (const [threshold, badgeId] of Object.entries(totalStudyBadges)) {
    if (totalStudyDays >= Number(threshold) && !existingBadges.has(badgeId)) {
      newBadges.push(badgeId);
    }
  }

  // 累計サボり日数バッジ
  const totalSkipBadges: { [key: number]: string } = {
    1: 'skip_1',
    10: 'skip_10',
    30: 'skip_30',
  };

  const totalSkipDays = user.stats.totalSkipDays + (isSkipped ? 1 : 0);
  for (const [threshold, badgeId] of Object.entries(totalSkipBadges)) {
    if (totalSkipDays >= Number(threshold) && !existingBadges.has(badgeId)) {
      newBadges.push(badgeId);
    }
  }

  return newBadges;
}
