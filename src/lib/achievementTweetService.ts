import { Timestamp } from 'firebase/firestore';
import {
  TWEET_TEMPLATES,
  TOTAL_DAYS_ACHIEVEMENT_MILESTONES,
  STREAK_ACHIEVEMENT_MILESTONES,
} from '../constants';
import { postTweet } from './twitter';
import { updateUser } from './firestoreService';
import { User } from '../types';

/**
 * Timestampかどうかをダックタイピングでチェック
 */
function isTimestamp(value: unknown): value is Timestamp {
  return (
    value !== null &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: unknown }).toDate === 'function'
  );
}

/**
 * 日付を「◯月◯日」形式にフォーマット
 */
function formatDeadlineForTweet(deadline: Date | Timestamp): string {
  const date = isTimestamp(deadline) ? deadline.toDate() : deadline;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}月${day}日`;
}

/**
 * 通算日数の達成マイルストーンをチェック
 * 指定された通算日数に対して、投稿すべきマイルストーンを返す
 */
export function checkTotalDaysAchievement(
  totalDays: number,
  postedMilestones: number[] = []
): number | null {
  const postedSet = new Set(postedMilestones);

  // マイルストーンをチェック（5, 10, 20, 30, ...）
  for (const milestone of TOTAL_DAYS_ACHIEVEMENT_MILESTONES) {
    if (totalDays >= milestone && !postedSet.has(milestone)) {
      return milestone;
    }
  }

  // 追加のマイルストーン（10日ごと）
  // 365を超えた場合も対応
  if (totalDays > 365) {
    const additionalMilestones = Math.floor(totalDays / 10) * 10;
    if (additionalMilestones > 365 && !postedSet.has(additionalMilestones)) {
      return additionalMilestones;
    }
  }

  return null;
}

/**
 * 連続日数の達成マイルストーンをチェック
 * 指定された連続日数に対して、投稿すべきマイルストーンを返す
 */
export function checkStreakAchievement(
  streakDays: number,
  postedMilestones: number[] = []
): number | null {
  const postedSet = new Set(postedMilestones);

  // マイルストーンをチェック（3, 5, 10, 15, ...）
  for (const milestone of STREAK_ACHIEVEMENT_MILESTONES) {
    if (streakDays >= milestone && !postedSet.has(milestone)) {
      return milestone;
    }
  }

  // 追加のマイルストーン（5日ごと）
  // 365を超えた場合も対応
  if (streakDays > 365) {
    const additionalMilestones = Math.floor(streakDays / 5) * 5;
    if (additionalMilestones > 365 && !postedSet.has(additionalMilestones)) {
      return additionalMilestones;
    }
  }

  return null;
}

/**
 * 通算日数達成ツイートを投稿すべきか判定
 */
export function shouldPostTotalDaysAchievement(user: User): boolean {
  if (!user.xLinked || !user.xAccessToken) {
    return false;
  }

  if (!user.goal) {
    return false;
  }

  const totalDays = user.stats.totalStudyDays;
  const postedMilestones = user.postedTotalDaysMilestones || [];
  const milestone = checkTotalDaysAchievement(totalDays, postedMilestones);

  return milestone !== null;
}

/**
 * 連続日数達成ツイートを投稿すべきか判定
 */
export function shouldPostStreakAchievement(user: User): boolean {
  if (!user.xLinked || !user.xAccessToken) {
    return false;
  }

  if (!user.goal) {
    return false;
  }

  const streakDays = user.stats.currentStreak;
  const postedMilestones = user.postedStreakMilestones || [];
  const milestone = checkStreakAchievement(streakDays, postedMilestones);

  return milestone !== null;
}

/**
 * 通算日数達成ツイートのテキストを生成
 */
export function generateTotalDaysAchievementText(user: User, totalDays: number): string {
  if (!user.goal) {
    return `通算${totalDays}日作業しました目標を達成するため日々がんばっています #バツガク`;
  }

  const { deadline, skills, targetIncome, incomeType } = user.goal;
  const formattedDeadline = formatDeadlineForTweet(deadline);
  const skill = skills[0] || 'プログラミング';

  return TWEET_TEMPLATES.totalDaysAchievement(
    formattedDeadline,
    skill,
    incomeType,
    targetIncome,
    totalDays
  );
}

/**
 * 連続日数達成ツイートのテキストを生成
 */
export function generateStreakAchievementText(user: User, streakDays: number): string {
  if (!user.goal) {
    return `${streakDays}日連続で作業しました目標を達成するため日々がんばっています #バツガク`;
  }

  const { deadline, skills, targetIncome, incomeType } = user.goal;
  const formattedDeadline = formatDeadlineForTweet(deadline);
  const skill = skills[0] || 'プログラミング';

  return TWEET_TEMPLATES.streakAchievement(
    formattedDeadline,
    skill,
    incomeType,
    targetIncome,
    streakDays
  );
}

/**
 * 通算日数達成ツイートを投稿
 */
export async function postTotalDaysAchievementTweet(
  user: User
): Promise<{ success: boolean; milestone?: number; error?: string }> {
  if (!user.xAccessToken) {
    return { success: false, error: 'X（Twitter）との連携が必要です' };
  }

  const totalDays = user.stats.totalStudyDays;
  const postedMilestones = user.postedTotalDaysMilestones || [];
  const milestone = checkTotalDaysAchievement(totalDays, postedMilestones);

  if (milestone === null) {
    return { success: true }; // 投稿対象なし
  }

  try {
    const tweetText = generateTotalDaysAchievementText(user, milestone);
    await postTweet(user.xAccessToken, tweetText);

    // 投稿済みマイルストーンを更新
    const updatedMilestones = [...postedMilestones, milestone];
    await updateUser(user.uid, { postedTotalDaysMilestones: updatedMilestones });

    return { success: true, milestone };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '投稿に失敗しました';
    return { success: false, error: errorMessage };
  }
}

/**
 * 連続日数達成ツイートを投稿
 */
export async function postStreakAchievementTweet(
  user: User
): Promise<{ success: boolean; milestone?: number; error?: string }> {
  if (!user.xAccessToken) {
    return { success: false, error: 'X（Twitter）との連携が必要です' };
  }

  const streakDays = user.stats.currentStreak;
  const postedMilestones = user.postedStreakMilestones || [];
  const milestone = checkStreakAchievement(streakDays, postedMilestones);

  if (milestone === null) {
    return { success: true }; // 投稿対象なし
  }

  try {
    const tweetText = generateStreakAchievementText(user, milestone);
    await postTweet(user.xAccessToken, tweetText);

    // 投稿済みマイルストーンを更新
    const updatedMilestones = [...postedMilestones, milestone];
    await updateUser(user.uid, { postedStreakMilestones: updatedMilestones });

    return { success: true, milestone };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '投稿に失敗しました';
    return { success: false, error: errorMessage };
  }
}

/**
 * 日次チェック後に達成ツイートを投稿（通算・連続両方）
 */
export async function postAchievementTweetsAfterDailyCheck(
  user: User
): Promise<{
  totalDaysResult: { success: boolean; milestone?: number; error?: string };
  streakResult: { success: boolean; milestone?: number; error?: string };
}> {
  const totalDaysResult = await postTotalDaysAchievementTweet(user);
  const streakResult = await postStreakAchievementTweet(user);

  return { totalDaysResult, streakResult };
}

/**
 * 全ての未投稿マイルストーンを取得
 */
export function getAllMissingTotalDaysMilestones(
  totalDays: number,
  postedMilestones: number[] = []
): number[] {
  const postedSet = new Set(postedMilestones);
  const missing: number[] = [];

  for (const milestone of TOTAL_DAYS_ACHIEVEMENT_MILESTONES) {
    if (totalDays >= milestone && !postedSet.has(milestone)) {
      missing.push(milestone);
    }
  }

  return missing;
}

/**
 * 全ての未投稿通算日数マイルストーンのツイートを投稿
 * 一度に複数投稿する場合はスパム防止のため最大1件のみ
 */
export async function postAllMissingTotalDaysTweets(
  user: User
): Promise<{ success: boolean; postedMilestones: number[]; error?: string }> {
  if (!user.xAccessToken) {
    return { success: false, postedMilestones: [], error: 'X連携が必要です' };
  }

  if (!user.goal) {
    return { success: false, postedMilestones: [], error: '目標設定が必要です' };
  }

  const totalDays = user.stats.totalStudyDays;
  const postedMilestones = user.postedTotalDaysMilestones || [];
  const missingMilestones = getAllMissingTotalDaysMilestones(totalDays, postedMilestones);

  if (missingMilestones.length === 0) {
    return { success: true, postedMilestones: [] };
  }

  console.log('postAllMissingTotalDaysTweets: missing milestones =', missingMilestones);

  // 最新のマイルストーンのみ投稿（スパム防止）
  const latestMilestone = Math.max(...missingMilestones);

  try {
    const tweetText = generateTotalDaysAchievementText(user, latestMilestone);
    console.log('postAllMissingTotalDaysTweets: posting tweet for milestone', latestMilestone);
    await postTweet(user.xAccessToken, tweetText);

    // 全ての未投稿マイルストーンを投稿済みとして記録
    const updatedMilestones = [...postedMilestones, ...missingMilestones];
    await updateUser(user.uid, { postedTotalDaysMilestones: updatedMilestones });

    console.log('postAllMissingTotalDaysTweets: success, marked as posted:', missingMilestones);
    return { success: true, postedMilestones: missingMilestones };
  } catch (error) {
    console.error('postAllMissingTotalDaysTweets: error', error);
    const errorMessage = error instanceof Error ? error.message : '投稿に失敗しました';
    return { success: false, postedMilestones: [], error: errorMessage };
  }
}
