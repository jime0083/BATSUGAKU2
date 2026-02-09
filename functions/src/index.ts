import * as admin from 'firebase-admin';
import { onSchedule, ScheduledEvent } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError, onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import {
  performDailyCheckForAllUsers,
  performDailyCheckForUser,
  saveDailyStats,
  getTodayDateString,
} from './dailyCheck';
import { generateDailyStatsTweetText, postTweet } from './twitter';
import {
  verifyAppleReceipt,
  verifyGoogleReceipt,
  saveSubscriptionToFirestore,
} from './receiptValidation';
import {
  verifyGitHubSignature,
  handleGitHubPush,
  GitHubPushPayload,
} from './githubWebhook';
import { User } from './types';

// Firebase Admin初期化
admin.initializeApp();

// 環境変数（Firebase Functions secrets）
const xClientId = defineSecret('X_CLIENT_ID');
const xClientSecret = defineSecret('X_CLIENT_SECRET');
const adminXAccessToken = defineSecret('ADMIN_X_ACCESS_TOKEN');
const githubWebhookSecret = defineSecret('GITHUB_WEBHOOK_SECRET');

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
    secrets: [xClientId, xClientSecret, adminXAccessToken],
  },
  async (_event: ScheduledEvent) => {
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
    secrets: [xClientId, xClientSecret],
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
    secrets: [xClientId, xClientSecret],
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

// シークレット定義（レシート検証用）
const appleSharedSecret = defineSecret('APPLE_SHARED_SECRET');
const googleServiceAccountJson = defineSecret('GOOGLE_SERVICE_ACCOUNT_JSON');

/**
 * iOSレシート検証
 *
 * クライアントから送られたレシートをApple App Storeで検証し、
 * 有効な場合はFirestoreのユーザーデータを更新
 */
export const verifyIosReceipt = onCall(
  {
    memory: '256MiB',
    timeoutSeconds: 60,
    secrets: [appleSharedSecret],
  },
  async (request) => {
    // 認証チェック
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { receipt } = request.data || {};

    if (!receipt) {
      throw new HttpsError('invalid-argument', 'Receipt is required');
    }

    try {
      const result = await verifyAppleReceipt(
        receipt,
        appleSharedSecret.value()
      );

      if (result.isValid) {
        await saveSubscriptionToFirestore(request.auth.uid, result);
      }

      return {
        success: result.isValid,
        productId: result.productId,
        expirationDate: result.expirationDate?.toISOString() || null,
        isExpired: result.isExpired,
        error: result.error,
      };
    } catch (error) {
      console.error('iOS receipt verification failed:', error);
      throw new HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }
);

/**
 * Androidレシート検証
 *
 * クライアントから送られた購入トークンをGoogle Play Developer APIで検証し、
 * 有効な場合はFirestoreのユーザーデータを更新
 */
export const verifyAndroidReceipt = onCall(
  {
    memory: '256MiB',
    timeoutSeconds: 60,
    secrets: [googleServiceAccountJson],
  },
  async (request) => {
    // 認証チェック
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { purchaseToken, subscriptionId } = request.data || {};

    if (!purchaseToken || !subscriptionId) {
      throw new HttpsError(
        'invalid-argument',
        'purchaseToken and subscriptionId are required'
      );
    }

    try {
      const serviceAccountCredentials = JSON.parse(
        googleServiceAccountJson.value()
      );

      const result = await verifyGoogleReceipt(
        'com.batsugaku.app', // パッケージ名
        subscriptionId,
        purchaseToken,
        serviceAccountCredentials
      );

      if (result.isValid) {
        await saveSubscriptionToFirestore(request.auth.uid, result);
      }

      return {
        success: result.isValid,
        productId: result.productId,
        expirationDate: result.expirationDate?.toISOString() || null,
        isExpired: result.isExpired,
        error: result.error,
      };
    } catch (error) {
      console.error('Android receipt verification failed:', error);
      throw new HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }
);

/**
 * サブスクリプション状態確認
 *
 * ユーザーの現在のサブスクリプション状態を返す
 */
export const getSubscriptionStatus = onCall(
  {
    memory: '128MiB',
    timeoutSeconds: 30,
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

    const userData = userDoc.data();
    const subscription = userData?.subscription;

    if (!subscription) {
      return {
        isActive: false,
        isPremium: userData?.isAdmin || false,
        productId: null,
        expirationDate: null,
      };
    }

    // 有効期限チェック
    const expiresAt = subscription.expiresAt?.toDate?.() || null;
    const isExpired = expiresAt ? expiresAt < new Date() : false;

    return {
      isActive: subscription.isActive && !isExpired,
      isPremium: userData?.isAdmin || (subscription.isActive && !isExpired),
      productId: subscription.productId,
      expirationDate: expiresAt?.toISOString() || null,
      isExpired,
    };
  }
);

/**
 * GitHub Webhook エンドポイント
 *
 * GitHubからのpushイベントを受け取り、
 * 該当ユーザーにプッシュ通知を送信し、統計を更新する
 *
 * 設定方法:
 * 1. GitHubリポジトリの Settings > Webhooks で新規作成
 * 2. Payload URL: https://<region>-<project-id>.cloudfunctions.net/githubWebhook
 * 3. Content type: application/json
 * 4. Secret: GITHUB_WEBHOOK_SECRET と同じ値
 * 5. Events: "Just the push event" を選択
 */
export const githubWebhook = onRequest(
  {
    memory: '256MiB',
    timeoutSeconds: 60,
    secrets: [githubWebhookSecret],
    cors: false,
  },
  async (req, res) => {
    // POSTメソッドのみ許可
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    // イベントタイプをチェック
    const event = req.headers['x-github-event'];
    if (event !== 'push') {
      console.log(`Ignoring non-push event: ${event}`);
      res.status(200).json({ message: `Ignored event: ${event}` });
      return;
    }

    // 署名を検証
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const rawBody = JSON.stringify(req.body);

    if (!verifyGitHubSignature(rawBody, signature, githubWebhookSecret.value())) {
      console.error('Invalid GitHub webhook signature');
      res.status(401).send('Invalid signature');
      return;
    }

    try {
      const payload = req.body as GitHubPushPayload;
      const senderUsername = payload.sender?.login;

      if (!senderUsername) {
        console.error('No sender username in payload');
        res.status(400).json({ error: 'No sender username' });
        return;
      }

      console.log('Received GitHub push from:', senderUsername);
      console.log('Repository:', payload.repository?.full_name);
      console.log('Commits:', payload.commits?.length || 0);

      // pushイベントを処理
      const result = await handleGitHubPush(senderUsername);

      console.log('GitHub push handled:', result);

      res.status(200).json(result);
    } catch (error) {
      console.error('GitHub webhook error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);
