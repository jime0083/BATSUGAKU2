import { User } from './types';

const GITHUB_API_BASE_URL = 'https://api.github.com';

/**
 * ユーザーの今日のpushイベントを取得
 */
export async function getTodayPushEvents(
  accessToken: string,
  username: string
): Promise<{ hasPushed: boolean; error?: string }> {
  try {
    // 今日の日付範囲を計算（JST基準）
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000; // JST = UTC + 9時間
    const jstNow = new Date(now.getTime() + jstOffset);

    // JSTでの今日の0:00を計算
    const todayStart = new Date(jstNow);
    todayStart.setUTCHours(0, 0, 0, 0);
    todayStart.setTime(todayStart.getTime() - jstOffset); // UTCに戻す

    const response = await fetch(
      `${GITHUB_API_BASE_URL}/users/${username}/events?per_page=100`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Batsugaku-App',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GitHub API error:', errorText);
      return {
        hasPushed: false,
        error: `GitHub API error: ${response.status}`,
      };
    }

    const events = await response.json();

    // PushEventをフィルタリング
    const pushEvents = events.filter((event: any) => {
      if (event.type !== 'PushEvent') return false;

      const eventDate = new Date(event.created_at);
      return eventDate >= todayStart;
    });

    return {
      hasPushed: pushEvents.length > 0,
    };
  } catch (error) {
    console.error('GitHub API error:', error);
    return {
      hasPushed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * ユーザーがGitHub連携済みかつ今日pushしたかをチェック
 */
export async function checkUserPush(
  user: User
): Promise<{ hasPushed: boolean; error?: string }> {
  // GitHub連携チェック
  if (!user.githubLinked || !user.githubAccessToken || !user.githubUsername) {
    return {
      hasPushed: false,
      error: 'GitHub not linked',
    };
  }

  return getTodayPushEvents(user.githubAccessToken, user.githubUsername);
}
