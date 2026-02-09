/**
 * GitHub Webhook処理
 *
 * GitHubからのpushイベントを受け取り、
 * 該当ユーザーにプッシュ通知を送信し、統計を更新する
 */

import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { User, UserStats } from './types';
import { sendGitHubPushNotification } from './pushNotification';

/**
 * GitHub Webhookペイロードの署名を検証
 */
export function verifyGitHubSignature(
  payload: string,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature) {
    console.error('No signature provided');
    return false;
  }

  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * 今日の日付文字列を取得（JST）
 */
function getTodayDateString(): string {
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffset);
  return jstNow.toISOString().split('T')[0];
}

/**
 * 昨日の日付文字列を取得（JST）
 */
function getYesterdayDateString(): string {
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffset);
  jstNow.setDate(jstNow.getDate() - 1);
  return jstNow.toISOString().split('T')[0];
}

/**
 * 統計を更新（学習日）
 */
function updateStatsForStudy(stats: UserStats, today: string): UserStats {
  const lastStudyDate = stats.lastStudyDate?.toDate?.() || null;
  const todayDate = new Date(today + 'T00:00:00+09:00');
  const yesterdayString = getYesterdayDateString();

  // 最終学習日を文字列に変換
  let lastStudyDateString: string | null = null;
  if (lastStudyDate) {
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstDate = new Date(lastStudyDate.getTime() + jstOffset);
    lastStudyDateString = jstDate.toISOString().split('T')[0];
  }

  // 連続日数の計算
  let newStreak = 1;
  if (lastStudyDateString === yesterdayString) {
    // 昨日も学習していた場合、連続を継続
    newStreak = (stats.currentStreak || 0) + 1;
  } else if (lastStudyDateString === today) {
    // 今日既に更新済みの場合、現在のストリークを維持
    newStreak = stats.currentStreak || 1;
  }

  // 月初めの場合は月間統計をリセット
  const currentMonth = todayDate.getMonth();
  const lastStudyMonth = lastStudyDate?.getMonth();
  const isNewMonth = lastStudyMonth !== currentMonth;

  return {
    ...stats,
    currentMonthStudyDays: isNewMonth ? 1 : (stats.currentMonthStudyDays || 0) + 1,
    currentMonthSkipDays: isNewMonth ? 0 : stats.currentMonthSkipDays,
    totalStudyDays: (stats.totalStudyDays || 0) + 1,
    currentStreak: newStreak,
    longestStreak: Math.max(stats.longestStreak || 0, newStreak),
    lastStudyDate: Timestamp.fromDate(todayDate),
    lastCheckedDate: Timestamp.now(),
  };
}

/**
 * GitHubユーザー名でFirestoreユーザーを検索
 */
async function findUserByGitHubUsername(username: string): Promise<User | null> {
  const db = admin.firestore();

  const snapshot = await db
    .collection('users')
    .where('githubUsername', '==', username)
    .where('githubLinked', '==', true)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return { ...doc.data(), uid: doc.id } as User;
}

/**
 * 今日既に通知済みかチェック
 */
async function hasNotifiedToday(userId: string): Promise<boolean> {
  const db = admin.firestore();
  const today = getTodayDateString();

  const doc = await db
    .collection('pushNotifications')
    .doc(`${userId}_${today}`)
    .get();

  return doc.exists;
}

/**
 * 通知済みフラグを保存
 */
async function markAsNotified(userId: string): Promise<void> {
  const db = admin.firestore();
  const today = getTodayDateString();

  await db.collection('pushNotifications').doc(`${userId}_${today}`).set({
    userId,
    date: today,
    notifiedAt: Timestamp.now(),
  });
}

/**
 * GitHub pushイベントを処理
 */
export async function handleGitHubPush(
  senderUsername: string
): Promise<{
  success: boolean;
  message: string;
  notificationSent?: boolean;
  statsUpdated?: boolean;
}> {
  console.log(`Processing GitHub push for user: ${senderUsername}`);

  // ユーザーを検索
  const user = await findUserByGitHubUsername(senderUsername);

  if (!user) {
    console.log(`User not found for GitHub username: ${senderUsername}`);
    return {
      success: false,
      message: `User not found for GitHub username: ${senderUsername}`,
    };
  }

  console.log(`Found user: ${user.uid} (${user.displayName})`);

  const today = getTodayDateString();
  const db = admin.firestore();

  // 今日既に統計更新済みかチェック
  const lastStudyDate = user.stats.lastStudyDate?.toDate?.() || null;
  let lastStudyDateString: string | null = null;
  if (lastStudyDate) {
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstDate = new Date(lastStudyDate.getTime() + jstOffset);
    lastStudyDateString = jstDate.toISOString().split('T')[0];
  }

  let statsUpdated = false;
  let newStreak = user.stats.currentStreak || 0;

  // 今日まだ統計が更新されていない場合のみ更新
  if (lastStudyDateString !== today) {
    console.log('Updating stats for user:', user.uid);

    const newStats = updateStatsForStudy(user.stats, today);
    newStreak = newStats.currentStreak;

    await db.collection('users').doc(user.uid).update({
      stats: newStats,
    });

    statsUpdated = true;
    console.log('Stats updated:', { newStreak, totalStudyDays: newStats.totalStudyDays });
  } else {
    console.log('Stats already updated today, skipping');
    newStreak = user.stats.currentStreak || 1;
  }

  // 通知を送信（今日まだ通知していない場合のみ）
  let notificationSent = false;

  if (user.fcmToken && user.notificationsEnabled) {
    const alreadyNotified = await hasNotifiedToday(user.uid);

    if (!alreadyNotified) {
      console.log('Sending push notification to:', user.uid);

      const result = await sendGitHubPushNotification(user.fcmToken, newStreak);

      if (result.success) {
        await markAsNotified(user.uid);
        notificationSent = true;
        console.log('Push notification sent successfully');
      } else {
        console.error('Failed to send push notification:', result.error);
      }
    } else {
      console.log('Already notified today, skipping notification');
    }
  } else {
    console.log('User has no fcmToken or notifications disabled');
  }

  return {
    success: true,
    message: `Processed push for ${senderUsername}`,
    notificationSent,
    statsUpdated,
  };
}

/**
 * GitHub Webhookペイロードをパース
 */
export interface GitHubPushPayload {
  ref: string;
  repository: {
    name: string;
    full_name: string;
  };
  sender: {
    login: string;
  };
  pusher: {
    name: string;
  };
  commits?: Array<{
    id: string;
    message: string;
  }>;
}
