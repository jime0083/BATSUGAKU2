import Constants from 'expo-constants';

// X API Base URL
const X_API_BASE = 'https://api.twitter.com/2';

// X OAuth設定
export interface XAuthConfig {
  clientId: string;
  scopes: string[];
  redirectUri: string;
  usePKCE: boolean;
}

// X Token Response
export interface XTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

// X Tweet Response
export interface XTweetResponse {
  data: {
    id: string;
    text: string;
  };
}

// X User Response
export interface XUser {
  id: string;
  name: string;
  username: string;
}

/**
 * X OAuth設定を取得
 */
export function getXAuthConfig(): XAuthConfig {
  const clientId =
    Constants.expoConfig?.extra?.xClientId ||
    process.env.EXPO_PUBLIC_X_CLIENT_ID ||
    '';

  return {
    clientId,
    scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    redirectUri: 'exp://localhost:8081/--/auth/twitter',
    usePKCE: true,
  };
}

/**
 * ツイートを投稿
 */
export async function postTweet(
  accessToken: string,
  text: string
): Promise<XTweetResponse> {
  // バリデーション
  if (!text || text.trim().length === 0) {
    throw new Error('Tweet text cannot be empty');
  }

  if (text.length > 280) {
    throw new Error('Tweet text exceeds 280 characters');
  }

  const response = await fetch(`${X_API_BASE}/tweets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`X API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * アクセストークンをリフレッシュ
 */
export async function refreshXToken(
  refreshToken: string,
  clientId: string
): Promise<XTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  });

  const response = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Token refresh error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Xユーザー情報を取得
 */
export async function fetchXUser(accessToken: string): Promise<XUser> {
  const response = await fetch(`${X_API_BASE}/users/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`X API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

/**
 * トークンの有効期限をチェック
 */
export function isTokenExpired(expiresAt: Date): boolean {
  const now = new Date();
  // 5分の余裕を持たせる
  const buffer = 5 * 60 * 1000;
  return now.getTime() > expiresAt.getTime() - buffer;
}
