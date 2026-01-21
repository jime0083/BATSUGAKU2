import * as admin from 'firebase-admin';
import { onSchedule, ScheduledEvent } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import {
  performDailyCheckForAllUsers,
  performDailyCheckForUser,
  saveDailyStats,
  getTodayDateString,
} from './dailyCheck';
import { generateDailyStatsTweetText, postTweet } from './twitter';
import { User } from './types';

// Firebase Admin初期化
admin.initializeApp();

// 環境変数（Firebase Functions secrets）
const xClientId = defineString('X_CLIENT_ID');
const xClientSecret = defineString('X_CLIENT_SECRET');
const adminXAccessToken = defineString('ADMIN_X_ACCESS_TOKEN', { default: '' });

/**
 * 日次自動チェック（毎日0:00 JST実行）
 *
 * 全ユーザーのGitHub pushをチェックし、
 * サボりツイートまたはストリーク達成ツイートを投稿
 */
export const dailyAutoCheck = onSchedule(
  {
    schedule: '0 0 * * *', // 毎日0:00 UTC
    timeZone: 'Asia/Tokyo', // JST
    retryCount: 3,
    memory: '512MiB',
    timeoutSeconds: 540, // 9分
  },
  async (event: ScheduledEvent) => {
    console.log('Starting daily auto check at', new Date().toISOString());

    try {
      const results = await performDailyCheckForAllUsers(
        xClientId.value(),
        xClientSecret.value()
      );

      console.log('Daily check completed:', {
        totalUsers: results.totalUsers,
        studyCount: results.studyCount,
        skipCount: results.skipCount,
        errorCount: results.errors.length,
      });

      // 日次統計を保存
      await saveDailyStats(results.studyCount, results.skipCount);

      // エラーがあればログ出力
      if (results.errors.length > 0) {
        console.error('Errors during daily check:', results.errors);
      }

      // 管理者向け統計ツイート（ユーザー数が一定以上の場合）
      const MIN_USERS_FOR_STATS_TWEET = 20;
      if (
        results.totalUsers >= MIN_USERS_FOR_STATS_TWEET &&
        adminXAccessToken.value()
      ) {
        const statsText = generateDailyStatsTweetText(
          results.studyCount,
          results.skipCount
        );
        const tweetResult = await postTweet(adminXAccessToken.value(), statsText);
        if (!tweetResult.success) {
          console.error('Failed to post stats tweet:', tweetResult.error);
        }
      }
    } catch (error) {
      console.error('Daily auto check failed:', error);
      throw error;
    }
  }
);

/**
 * 手動日次チェック（管理者用またはテスト用）
 *
 * Cloud Functions HTTPSエンドポイントから呼び出し可能
 */
export const manualDailyCheck = onCall(
  {
    memory: '512MiB',
    timeoutSeconds: 300,
  },
  async (request) => {
    // 認証チェック
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(request.auth.uid).get();

    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'User not found');
    }

    const user = { ...userDoc.data(), uid: userDoc.id } as User;

    // 管理者チェック
    if (!user.isAdmin) {
      throw new HttpsError('permission-denied', 'Admin access required');
    }

    console.log('Manual daily check triggered by', request.auth.uid);

    try {
      const results = await performDailyCheckForAllUsers(
        xClientId.value(),
        xClientSecret.value()
      );

      await saveDailyStats(results.studyCount, results.skipCount);

      return {
        success: true,
        totalUsers: results.totalUsers,
        studyCount: results.studyCount,
        skipCount: results.skipCount,
        errorCount: results.errors.length,
      };
    } catch (error) {
      console.error('Manual daily check failed:', error);
      throw new HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }
);

/**
 * 単一ユーザーの手動チェック（デバッグ用）
 */
export const checkSingleUser = onCall(
  {
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    // 認証チェック
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const targetUserId = request.data?.userId || request.auth.uid;

    // 自分以外のユーザーをチェックする場合は管理者権限が必要
    if (targetUserId !== request.auth.uid) {
      const db = admin.firestore();
      const callerDoc = await db.collection('users').doc(request.auth.uid).get();
      const caller = callerDoc.data() as User;

      if (!caller?.isAdmin) {
        throw new HttpsError('permission-denied', 'Admin access required');
      }
    }

    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(targetUserId).get();

    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'User not found');
    }

    const user = { ...userDoc.data(), uid: userDoc.id } as User;

    try {
      const result = await performDailyCheckForUser(
        user,
        xClientId.value(),
        xClientSecret.value()
      );

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      console.error('Single user check failed:', error);
      throw new HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }
);

/**
 * 日次統計取得
 */
export const getDailyStats = onCall(
  {
    memory: '128MiB',
    timeoutSeconds: 30,
  },
  async (request) => {
    const date = request.data?.date || getTodayDateString();

    const db = admin.firestore();
    const statsDoc = await db.collection('dailyStats').doc(date).get();

    if (!statsDoc.exists) {
      return {
        date,
        totalUsers: 0,
        studyCount: 0,
        skipCount: 0,
        exists: false,
      };
    }

    return {
      ...statsDoc.data(),
      exists: true,
    };
  }
);

/**
 * 月間統計取得
 */
export const getMonthlyStats = onCall(
  {
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    const year = request.data?.year || new Date().getFullYear();
    const month = request.data?.month || new Date().getMonth() + 1;

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

    const db = admin.firestore();
    const statsSnapshot = await db
      .collection('dailyStats')
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .orderBy('date')
      .get();

    const dailyData = statsSnapshot.docs.map((doc) => doc.data());

    const totals = dailyData.reduce(
      (acc, day) => ({
        totalStudyCount: acc.totalStudyCount + (day.studyCount || 0),
        totalSkipCount: acc.totalSkipCount + (day.skipCount || 0),
        daysWithData: acc.daysWithData + 1,
      }),
      { totalStudyCount: 0, totalSkipCount: 0, daysWithData: 0 }
    );

    return {
      year,
      month,
      ...totals,
      dailyData,
    };
  }
);
