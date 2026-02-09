"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.githubWebhook = exports.getSubscriptionStatus = exports.verifyAndroidReceipt = exports.verifyIosReceipt = exports.getMonthlyStats = exports.getDailyStats = exports.checkSingleUser = exports.manualDailyCheck = exports.dailyAutoCheck = void 0;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const dailyCheck_1 = require("./dailyCheck");
const twitter_1 = require("./twitter");
const receiptValidation_1 = require("./receiptValidation");
const githubWebhook_1 = require("./githubWebhook");
// Firebase Admin初期化
admin.initializeApp();
// 環境変数（Firebase Functions secrets）
const xClientId = (0, params_1.defineSecret)('X_CLIENT_ID');
const xClientSecret = (0, params_1.defineSecret)('X_CLIENT_SECRET');
const adminXAccessToken = (0, params_1.defineSecret)('ADMIN_X_ACCESS_TOKEN');
const githubWebhookSecret = (0, params_1.defineSecret)('GITHUB_WEBHOOK_SECRET');
/**
 * 日次自動チェック（毎日0:00 JST実行）
 *
 * 全ユーザーのGitHub pushをチェックし、
 * サボりツイートまたはストリーク達成ツイートを投稿
 */
exports.dailyAutoCheck = (0, scheduler_1.onSchedule)({
    schedule: '0 0 * * *', // 毎日0:00 UTC
    timeZone: 'Asia/Tokyo', // JST
    retryCount: 3,
    memory: '512MiB',
    timeoutSeconds: 540, // 9分
    secrets: [xClientId, xClientSecret, adminXAccessToken],
}, async (_event) => {
    console.log('Starting daily auto check at', new Date().toISOString());
    try {
        const results = await (0, dailyCheck_1.performDailyCheckForAllUsers)(xClientId.value(), xClientSecret.value());
        console.log('Daily check completed:', {
            totalUsers: results.totalUsers,
            studyCount: results.studyCount,
            skipCount: results.skipCount,
            errorCount: results.errors.length,
        });
        // 日次統計を保存
        await (0, dailyCheck_1.saveDailyStats)(results.studyCount, results.skipCount);
        // エラーがあればログ出力
        if (results.errors.length > 0) {
            console.error('Errors during daily check:', results.errors);
        }
        // 管理者向け統計ツイート（ユーザー数が一定以上の場合）
        const MIN_USERS_FOR_STATS_TWEET = 20;
        if (results.totalUsers >= MIN_USERS_FOR_STATS_TWEET &&
            adminXAccessToken.value()) {
            const statsText = (0, twitter_1.generateDailyStatsTweetText)(results.studyCount, results.skipCount);
            const tweetResult = await (0, twitter_1.postTweet)(adminXAccessToken.value(), statsText);
            if (!tweetResult.success) {
                console.error('Failed to post stats tweet:', tweetResult.error);
            }
        }
    }
    catch (error) {
        console.error('Daily auto check failed:', error);
        throw error;
    }
});
/**
 * 手動日次チェック（管理者用またはテスト用）
 *
 * Cloud Functions HTTPSエンドポイントから呼び出し可能
 */
exports.manualDailyCheck = (0, https_1.onCall)({
    memory: '512MiB',
    timeoutSeconds: 300,
    secrets: [xClientId, xClientSecret],
}, async (request) => {
    // 認証チェック
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    }
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!userDoc.exists) {
        throw new https_1.HttpsError('not-found', 'User not found');
    }
    const user = Object.assign(Object.assign({}, userDoc.data()), { uid: userDoc.id });
    // 管理者チェック
    if (!user.isAdmin) {
        throw new https_1.HttpsError('permission-denied', 'Admin access required');
    }
    console.log('Manual daily check triggered by', request.auth.uid);
    try {
        const results = await (0, dailyCheck_1.performDailyCheckForAllUsers)(xClientId.value(), xClientSecret.value());
        await (0, dailyCheck_1.saveDailyStats)(results.studyCount, results.skipCount);
        return {
            success: true,
            totalUsers: results.totalUsers,
            studyCount: results.studyCount,
            skipCount: results.skipCount,
            errorCount: results.errors.length,
        };
    }
    catch (error) {
        console.error('Manual daily check failed:', error);
        throw new https_1.HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
    }
});
/**
 * 単一ユーザーの手動チェック（デバッグ用）
 */
exports.checkSingleUser = (0, https_1.onCall)({
    memory: '256MiB',
    timeoutSeconds: 60,
    secrets: [xClientId, xClientSecret],
}, async (request) => {
    var _a;
    // 認証チェック
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    }
    const targetUserId = ((_a = request.data) === null || _a === void 0 ? void 0 : _a.userId) || request.auth.uid;
    // 自分以外のユーザーをチェックする場合は管理者権限が必要
    if (targetUserId !== request.auth.uid) {
        const db = admin.firestore();
        const callerDoc = await db.collection('users').doc(request.auth.uid).get();
        const caller = callerDoc.data();
        if (!(caller === null || caller === void 0 ? void 0 : caller.isAdmin)) {
            throw new https_1.HttpsError('permission-denied', 'Admin access required');
        }
    }
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(targetUserId).get();
    if (!userDoc.exists) {
        throw new https_1.HttpsError('not-found', 'User not found');
    }
    const user = Object.assign(Object.assign({}, userDoc.data()), { uid: userDoc.id });
    try {
        const result = await (0, dailyCheck_1.performDailyCheckForUser)(user, xClientId.value(), xClientSecret.value());
        return Object.assign({ success: true }, result);
    }
    catch (error) {
        console.error('Single user check failed:', error);
        throw new https_1.HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
    }
});
/**
 * 日次統計取得
 */
exports.getDailyStats = (0, https_1.onCall)({
    memory: '128MiB',
    timeoutSeconds: 30,
}, async (request) => {
    var _a;
    const date = ((_a = request.data) === null || _a === void 0 ? void 0 : _a.date) || (0, dailyCheck_1.getTodayDateString)();
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
    return Object.assign(Object.assign({}, statsDoc.data()), { exists: true });
});
/**
 * 月間統計取得
 */
exports.getMonthlyStats = (0, https_1.onCall)({
    memory: '256MiB',
    timeoutSeconds: 60,
}, async (request) => {
    var _a, _b;
    const year = ((_a = request.data) === null || _a === void 0 ? void 0 : _a.year) || new Date().getFullYear();
    const month = ((_b = request.data) === null || _b === void 0 ? void 0 : _b.month) || new Date().getMonth() + 1;
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
    const totals = dailyData.reduce((acc, day) => ({
        totalStudyCount: acc.totalStudyCount + (day.studyCount || 0),
        totalSkipCount: acc.totalSkipCount + (day.skipCount || 0),
        daysWithData: acc.daysWithData + 1,
    }), { totalStudyCount: 0, totalSkipCount: 0, daysWithData: 0 });
    return Object.assign(Object.assign({ year,
        month }, totals), { dailyData });
});
// シークレット定義（レシート検証用）
const appleSharedSecret = (0, params_1.defineSecret)('APPLE_SHARED_SECRET');
const googleServiceAccountJson = (0, params_1.defineSecret)('GOOGLE_SERVICE_ACCOUNT_JSON');
/**
 * iOSレシート検証
 *
 * クライアントから送られたレシートをApple App Storeで検証し、
 * 有効な場合はFirestoreのユーザーデータを更新
 */
exports.verifyIosReceipt = (0, https_1.onCall)({
    memory: '256MiB',
    timeoutSeconds: 60,
    secrets: [appleSharedSecret],
}, async (request) => {
    var _a;
    // 認証チェック
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    }
    const { receipt } = request.data || {};
    if (!receipt) {
        throw new https_1.HttpsError('invalid-argument', 'Receipt is required');
    }
    try {
        const result = await (0, receiptValidation_1.verifyAppleReceipt)(receipt, appleSharedSecret.value());
        if (result.isValid) {
            await (0, receiptValidation_1.saveSubscriptionToFirestore)(request.auth.uid, result);
        }
        return {
            success: result.isValid,
            productId: result.productId,
            expirationDate: ((_a = result.expirationDate) === null || _a === void 0 ? void 0 : _a.toISOString()) || null,
            isExpired: result.isExpired,
            error: result.error,
        };
    }
    catch (error) {
        console.error('iOS receipt verification failed:', error);
        throw new https_1.HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
    }
});
/**
 * Androidレシート検証
 *
 * クライアントから送られた購入トークンをGoogle Play Developer APIで検証し、
 * 有効な場合はFirestoreのユーザーデータを更新
 */
exports.verifyAndroidReceipt = (0, https_1.onCall)({
    memory: '256MiB',
    timeoutSeconds: 60,
    secrets: [googleServiceAccountJson],
}, async (request) => {
    var _a;
    // 認証チェック
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    }
    const { purchaseToken, subscriptionId } = request.data || {};
    if (!purchaseToken || !subscriptionId) {
        throw new https_1.HttpsError('invalid-argument', 'purchaseToken and subscriptionId are required');
    }
    try {
        const serviceAccountCredentials = JSON.parse(googleServiceAccountJson.value());
        const result = await (0, receiptValidation_1.verifyGoogleReceipt)('com.batsugaku.app', // パッケージ名
        subscriptionId, purchaseToken, serviceAccountCredentials);
        if (result.isValid) {
            await (0, receiptValidation_1.saveSubscriptionToFirestore)(request.auth.uid, result);
        }
        return {
            success: result.isValid,
            productId: result.productId,
            expirationDate: ((_a = result.expirationDate) === null || _a === void 0 ? void 0 : _a.toISOString()) || null,
            isExpired: result.isExpired,
            error: result.error,
        };
    }
    catch (error) {
        console.error('Android receipt verification failed:', error);
        throw new https_1.HttpsError('internal', error instanceof Error ? error.message : 'Unknown error');
    }
});
/**
 * サブスクリプション状態確認
 *
 * ユーザーの現在のサブスクリプション状態を返す
 */
exports.getSubscriptionStatus = (0, https_1.onCall)({
    memory: '128MiB',
    timeoutSeconds: 30,
}, async (request) => {
    var _a, _b;
    // 認証チェック
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    }
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!userDoc.exists) {
        throw new https_1.HttpsError('not-found', 'User not found');
    }
    const userData = userDoc.data();
    const subscription = userData === null || userData === void 0 ? void 0 : userData.subscription;
    if (!subscription) {
        return {
            isActive: false,
            isPremium: (userData === null || userData === void 0 ? void 0 : userData.isAdmin) || false,
            productId: null,
            expirationDate: null,
        };
    }
    // 有効期限チェック
    const expiresAt = ((_b = (_a = subscription.expiresAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || null;
    const isExpired = expiresAt ? expiresAt < new Date() : false;
    return {
        isActive: subscription.isActive && !isExpired,
        isPremium: (userData === null || userData === void 0 ? void 0 : userData.isAdmin) || (subscription.isActive && !isExpired),
        productId: subscription.productId,
        expirationDate: (expiresAt === null || expiresAt === void 0 ? void 0 : expiresAt.toISOString()) || null,
        isExpired,
    };
});
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
exports.githubWebhook = (0, https_1.onRequest)({
    memory: '256MiB',
    timeoutSeconds: 60,
    secrets: [githubWebhookSecret],
    cors: false,
}, async (req, res) => {
    var _a, _b, _c;
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
    const signature = req.headers['x-hub-signature-256'];
    const rawBody = JSON.stringify(req.body);
    if (!(0, githubWebhook_1.verifyGitHubSignature)(rawBody, signature, githubWebhookSecret.value())) {
        console.error('Invalid GitHub webhook signature');
        res.status(401).send('Invalid signature');
        return;
    }
    try {
        const payload = req.body;
        const senderUsername = (_a = payload.sender) === null || _a === void 0 ? void 0 : _a.login;
        if (!senderUsername) {
            console.error('No sender username in payload');
            res.status(400).json({ error: 'No sender username' });
            return;
        }
        console.log('Received GitHub push from:', senderUsername);
        console.log('Repository:', (_b = payload.repository) === null || _b === void 0 ? void 0 : _b.full_name);
        console.log('Commits:', ((_c = payload.commits) === null || _c === void 0 ? void 0 : _c.length) || 0);
        // pushイベントを処理
        const result = await (0, githubWebhook_1.handleGitHubPush)(senderUsername);
        console.log('GitHub push handled:', result);
        res.status(200).json(result);
    }
    catch (error) {
        console.error('GitHub webhook error:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
//# sourceMappingURL=index.js.map