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
exports.getMonthlyStats = exports.getDailyStats = exports.checkSingleUser = exports.manualDailyCheck = exports.dailyAutoCheck = void 0;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const dailyCheck_1 = require("./dailyCheck");
const twitter_1 = require("./twitter");
// Firebase Admin初期化
admin.initializeApp();
// 環境変数（Firebase Functions secrets）
const xClientId = (0, params_1.defineString)('X_CLIENT_ID');
const xClientSecret = (0, params_1.defineString)('X_CLIENT_SECRET');
const adminXAccessToken = (0, params_1.defineString)('ADMIN_X_ACCESS_TOKEN', { default: '' });
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
}, async (event) => {
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
//# sourceMappingURL=index.js.map