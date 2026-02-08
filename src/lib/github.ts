import Constants from 'expo-constants';

// GitHub API Base URL
const GITHUB_API_BASE = 'https://api.github.com';

// GitHub OAuth設定
export interface GitHubAuthConfig {
  clientId: string;
  scopes: string[];
  redirectUri: string;
}

// GitHub User型
export interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  name: string | null;
  email: string | null;
}

// GitHub Event型
export interface GitHubEvent {
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

/**
 * GitHub OAuth設定を取得
 */
export function getGitHubAuthConfig(): GitHubAuthConfig {
  const clientId =
    Constants.expoConfig?.extra?.githubClientId ||
    process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID ||
    '';

  return {
    clientId,
    scopes: ['read:user', 'repo'],
    redirectUri: 'exp://localhost:8081/--/auth/github',
  };
}

/**
 * GitHubユーザー情報を取得
 */
export async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  const response = await fetch(`${GITHUB_API_BASE}/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * 今日のpushイベントを取得
 */
export async function fetchTodayPushEvents(
  username: string,
  accessToken: string
): Promise<GitHubEvent[]> {
  console.log('fetchTodayPushEvents: username =', username);

  const response = await fetch(`${GITHUB_API_BASE}/users/${username}/events`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('GitHub API error:', response.status, response.statusText, errorText);
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const events: GitHubEvent[] = await response.json();
  console.log('fetchTodayPushEvents: total events =', events.length);

  // 今日の日付を取得（ローカルタイムゾーンの0時から）
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  console.log('fetchTodayPushEvents: todayStart =', todayStart.toISOString());

  // 全てのPushEventをログ
  const pushEvents = events.filter((event) => event.type === 'PushEvent');
  console.log('fetchTodayPushEvents: total push events =', pushEvents.length);

  if (pushEvents.length > 0) {
    console.log('fetchTodayPushEvents: most recent push events:');
    pushEvents.slice(0, 5).forEach((event, i) => {
      console.log(`  [${i}] created_at: ${event.created_at}, repo: ${event.repo.name}`);
    });
  }

  // PushEventのみ、かつ今日のイベントのみをフィルタ
  const todayPushEvents = events.filter((event) => {
    if (event.type !== 'PushEvent') {
      return false;
    }

    const eventDate = new Date(event.created_at);
    const isToday = eventDate >= todayStart;
    console.log(`fetchTodayPushEvents: event ${event.created_at} >= ${todayStart.toISOString()} = ${isToday}`);
    return isToday;
  });

  console.log('fetchTodayPushEvents: today push events =', todayPushEvents.length);

  return todayPushEvents;
}

/**
 * 今日pushしたかどうかを判定
 */
export async function hasPushedToday(
  username: string,
  accessToken: string
): Promise<boolean> {
  try {
    const events = await fetchTodayPushEvents(username, accessToken);
    console.log('hasPushedToday: result =', events.length > 0);
    return events.length > 0;
  } catch (error) {
    console.error('hasPushedToday error:', error);
    throw error;
  }
}

/**
 * pushイベントの総コミット数を取得
 */
export function countTotalCommits(events: GitHubEvent[]): number {
  return events.reduce((total, event) => {
    return total + (event.payload.commits?.length || 0);
  }, 0);
}
