import { Timestamp } from 'firebase-admin/firestore';
import { User } from './types';

const X_API_BASE_URL = 'https://api.twitter.com/2';
const HASHTAG = '#バツガク';

/**
 * X APIでツイートを投稿
 */
export async function postTweet(
  accessToken: string,
  text: string
): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  try {
    const response = await fetch(`${X_API_BASE_URL}/tweets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Tweet failed:', errorData);
      return {
        success: false,
        error: errorData.detail || errorData.title || 'Tweet failed',
      };
    }

    const data = await response.json();
    return {
      success: true,
      tweetId: data.data?.id,
    };
  } catch (error) {
    console.error('Tweet error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * サボりツイートのテキストを生成
 */
export function generateSkipTweetText(user: User): string {
  if (!user.goal) {
    return `学習をサボりました ${HASHTAG}`;
  }

  const incomeText = user.goal.incomeType === 'monthly' ? '月収' : '年収';
  const skillsText = user.goal.skills.join('、');
  const monthCount = user.stats.currentMonthSkipDays + 1; // 今回の分を加算
  const totalCount = user.stats.totalSkipDays + 1;

  return `私は${incomeText}${user.goal.targetIncome}万稼ぐエンジニアになるため${skillsText}の学習をすると宣言したにも関わらず、学習をサボった愚かな人間です\n#今月${monthCount}回目 #累計${totalCount}回 ${HASHTAG}`;
}

/**
 * ストリーク達成ツイートのテキストを生成
 */
export function generateStreakTweetText(user: User, days: number): string {
  const skillsText = user.goal?.skills.join('、') || '学習';
  return `${skillsText}学習${days}日連続達成！ #${days}日連続 ${HASHTAG}`;
}

/**
 * 管理者用日次統計ツイートのテキストを生成
 */
export function generateDailyStatsTweetText(
  studyCount: number,
  skipCount: number
): string {
  return `今日学習をした人：${studyCount}人、サボった人：${skipCount}人 ${HASHTAG}`;
}

/**
 * サボりツイートを投稿
 */
export async function postSkipTweet(
  user: User
): Promise<{ success: boolean; error?: string }> {
  if (!user.xAccessToken) {
    return { success: false, error: 'X access token not found' };
  }

  const text = generateSkipTweetText(user);
  return postTweet(user.xAccessToken, text);
}

/**
 * ストリーク達成ツイートを投稿
 */
export async function postStreakTweet(
  user: User,
  days: number
): Promise<{ success: boolean; error?: string }> {
  if (!user.xAccessToken) {
    return { success: false, error: 'X access token not found' };
  }

  const text = generateStreakTweetText(user, days);
  return postTweet(user.xAccessToken, text);
}

/**
 * X トークンの有効期限をチェック
 */
export function isTokenExpired(user: User): boolean {
  if (!user.xTokenExpiresAt) {
    return true;
  }

  const expiresAt = user.xTokenExpiresAt.toDate();
  const now = new Date();
  // 5分のバッファを持たせる
  return expiresAt.getTime() - 5 * 60 * 1000 < now.getTime();
}

/**
 * X トークンをリフレッシュ
 * 注: Cloud FunctionsではクライアントIDとシークレットが必要
 */
export async function refreshXToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Timestamp;
} | null> {
  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      console.error('Token refresh failed:', await response.text());
      return null;
    }

    const data = await response.json();
    const expiresAt = Timestamp.fromDate(
      new Date(Date.now() + data.expires_in * 1000)
    );

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
    };
  } catch (error) {
    console.error('Token refresh error:', error);
    return null;
  }
}
