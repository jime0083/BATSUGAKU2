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
import {
  postTweet,
  generateTotalDaysAchievementText,
  generateStreakAchievementText,
  isTokenExpired,
  refreshXToken,
} from './twitter';

// 達成マイルストーン
const TOTAL_DAYS_MILESTONES = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 150, 200, 250, 300, 365];
const STREAK_MILESTONES = [3, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 150, 200, 250, 300, 365];

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
 * 通算日数の達成マイルストーンをチェック
 */
function checkTotalDaysAchievement(
  totalDays: number,
  postedMilestones: number[] = []
): number | null {
  const postedSet = new Set(postedMilestones);
  for (const milestone of TOTAL_DAYS_MILESTONES) {
    if (totalDays >= milestone && !postedSet.has(milestone)) {
      return milestone;
    }
  }
  // 10日ごとの追加マイルストーン
  if (totalDays > 365) {
    const additionalMilestone = Math.floor(totalDays / 10) * 10;
    if (!postedSet.has(additionalMilestone)) {
      return additionalMilestone;
    }
  }
  return null;
}

/**
 * 連続日数の達成マイルストーンをチェック
 */
function checkStreakAchievement(
  streakDays: number,
  postedMilestones: number[] = []
): number | null {
  const postedSet = new Set(postedMilestones);
  for (const milestone of STREAK_MILESTONES) {
    if (streakDays >= milestone && !postedSet.has(milestone)) {
      return milestone;
    }
  }
  // 5日ごとの追加マイルストーン
  if (streakDays > 365) {
    const additionalMilestone = Math.floor(streakDays / 5) * 5;
    if (!postedSet.has(additionalMilestone)) {
      return additionalMilestone;
    }
  }
  return null;
}

/**
 * GitHub pushイベントを処理
 */
export async function handleGitHubPush(
  senderUsername: string,
  xClientId?: string,
  xClientSecret?: string
): Promise<{
  success: boolean;
  message: string;
  notificationSent?: boolean;
  statsUpdated?: boolean;
  achievementTweeted?: boolean;
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

  // 達成ツイートを投稿（統計更新された場合のみ）
  let achievementTweeted = false;

  if (statsUpdated && user.xLinked && user.xAccessToken) {
    // 最新のユーザー情報を取得
    const updatedUserDoc = await db.collection('users').doc(user.uid).get();
    let updatedUser = { ...updatedUserDoc.data(), uid: updatedUserDoc.id } as User;

    // トークンの有効期限チェック＆リフレッシュ
    if (isTokenExpired(updatedUser) && updatedUser.xRefreshToken && xClientId && xClientSecret) {
      console.log('Refreshing X token for user:', user.uid);
      const refreshed = await refreshXToken(
        updatedUser.xRefreshToken,
        xClientId,
        xClientSecret
      );
      if (refreshed) {
        await db.collection('users').doc(user.uid).update({
          xAccessToken: refreshed.accessToken,
          xRefreshToken: refreshed.refreshToken,
          xTokenExpiresAt: refreshed.expiresAt,
        });
        updatedUser = {
          ...updatedUser,
          xAccessToken: refreshed.accessToken,
          xRefreshToken: refreshed.refreshToken,
          xTokenExpiresAt: refreshed.expiresAt,
        };
      }
    }

    // 通算日数達成ツイート
    const totalDaysMilestone = checkTotalDaysAchievement(
      updatedUser.stats.totalStudyDays,
      updatedUser.postedTotalDaysMilestones || []
    );
    if (totalDaysMilestone && updatedUser.xAccessToken) {
      console.log('Posting total days achievement tweet:', totalDaysMilestone);
      const tweetText = generateTotalDaysAchievementText(updatedUser, totalDaysMilestone);
      const tweetResult = await postTweet(updatedUser.xAccessToken, tweetText);
      if (tweetResult.success) {
        const updatedMilestones = [...(updatedUser.postedTotalDaysMilestones || []), totalDaysMilestone];
        await db.collection('users').doc(user.uid).update({
          postedTotalDaysMilestones: updatedMilestones,
        });
        achievementTweeted = true;
        console.log('Total days achievement tweet posted:', totalDaysMilestone);
      } else {
        console.error('Failed to post total days achievement tweet:', tweetResult.error);
      }
    }

    // 連続日数達成ツイート
    const streakMilestone = checkStreakAchievement(
      updatedUser.stats.currentStreak,
      updatedUser.postedStreakMilestones || []
    );
    if (streakMilestone && updatedUser.xAccessToken) {
      console.log('Posting streak achievement tweet:', streakMilestone);
      const tweetText = generateStreakAchievementText(updatedUser, streakMilestone);
      const tweetResult = await postTweet(updatedUser.xAccessToken, tweetText);
      if (tweetResult.success) {
        const updatedMilestones = [...(updatedUser.postedStreakMilestones || []), streakMilestone];
        await db.collection('users').doc(user.uid).update({
          postedStreakMilestones: updatedMilestones,
        });
        achievementTweeted = true;
        console.log('Streak achievement tweet posted:', streakMilestone);
      } else {
        console.error('Failed to post streak achievement tweet:', tweetResult.error);
      }
    }
  }

  return {
    success: true,
    message: `Processed push for ${senderUsername}`,
    notificationSent,
    statsUpdated,
    achievementTweeted,
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
