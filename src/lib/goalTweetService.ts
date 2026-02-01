import { Timestamp } from 'firebase/firestore';
import { TWEET_TEMPLATES } from '../constants';
import { postTweet } from './twitter';
import { updateUser, getUser } from './firestoreService';
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
 * 目標情報からツイート文を生成
 */
export function generateGoalTweetText(
  deadline: Date | Timestamp,
  skill: string,
  incomeType: 'monthly' | 'yearly',
  targetIncome: number
): string {
  // Timestampの場合はDateに変換（ダックタイピングで判定）
  const deadlineDate = isTimestamp(deadline) ? deadline.toDate() : deadline;

  // 日付を「YYYY.MM」形式にフォーマット
  const year = deadlineDate.getFullYear();
  const month = String(deadlineDate.getMonth() + 1).padStart(2, '0');
  const formattedDeadline = `${year}.${month}`;

  return TWEET_TEMPLATES.goalAnnouncement(
    formattedDeadline,
    skill,
    incomeType,
    targetIncome
  );
}

/**
 * 目標投稿が済んでいるかチェック
 */
export async function hasPostedGoalTweet(userId: string): Promise<boolean> {
  const user = await getUser(userId);
  return user?.goalTweetPosted ?? false;
}

/**
 * 目標ツイートを投稿
 */
export async function postGoalTweet(user: User): Promise<{ success: boolean; error?: string }> {
  // 既に投稿済みの場合はスキップ
  if (user.goalTweetPosted) {
    return { success: true };
  }

  // X連携がない場合はエラー
  if (!user.xAccessToken) {
    return { success: false, error: 'X（Twitter）との連携が必要です' };
  }

  // 目標が設定されていない場合はエラー
  if (!user.goal) {
    return { success: false, error: '目標が設定されていません' };
  }

  const { deadline, skills, targetIncome, incomeType } = user.goal;

  // スキルの最初の1つを使用（複数ある場合）
  const skill = skills[0] || 'プログラミング';

  try {
    // ツイート文を生成
    const tweetText = generateGoalTweetText(deadline, skill, incomeType, targetIncome);

    // ツイートを投稿
    await postTweet(user.xAccessToken, tweetText);

    // 投稿成功フラグを更新
    await updateUser(user.uid, { goalTweetPosted: true });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '投稿に失敗しました';
    return { success: false, error: errorMessage };
  }
}

/**
 * ユーザーが初回目標投稿の対象かどうかをチェック
 * - サブスク加入済み
 * - X連携済み
 * - 目標設定済み
 * - まだ目標投稿していない
 */
export function shouldPostGoalTweet(user: User): boolean {
  // サブスク未加入
  if (!user.subscription?.isActive) {
    return false;
  }

  // X連携なし
  if (!user.xLinked || !user.xAccessToken) {
    return false;
  }

  // 目標未設定
  if (!user.goal) {
    return false;
  }

  // 既に投稿済み
  if (user.goalTweetPosted) {
    return false;
  }

  return true;
}
