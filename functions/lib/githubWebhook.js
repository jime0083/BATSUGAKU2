"use strict";
/**
 * GitHub Webhook処理
 *
 * GitHubからのpushイベントを受け取り、
 * 該当ユーザーにプッシュ通知を送信し、統計を更新する
 */
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
exports.verifyGitHubSignature = verifyGitHubSignature;
exports.handleGitHubPush = handleGitHubPush;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const crypto = __importStar(require("crypto"));
const pushNotification_1 = require("./pushNotification");
/**
 * GitHub Webhookペイロードの署名を検証
 */
function verifyGitHubSignature(payload, signature, secret) {
    if (!signature) {
        console.error('No signature provided');
        return false;
    }
    const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
    try {
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    }
    catch (_a) {
        return false;
    }
}
/**
 * 今日の日付文字列を取得（JST）
 */
function getTodayDateString() {
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstNow = new Date(now.getTime() + jstOffset);
    return jstNow.toISOString().split('T')[0];
}
/**
 * 昨日の日付文字列を取得（JST）
 */
function getYesterdayDateString() {
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstNow = new Date(now.getTime() + jstOffset);
    jstNow.setDate(jstNow.getDate() - 1);
    return jstNow.toISOString().split('T')[0];
}
/**
 * 統計を更新（学習日）
 */
function updateStatsForStudy(stats, today) {
    var _a, _b;
    const lastStudyDate = ((_b = (_a = stats.lastStudyDate) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || null;
    const todayDate = new Date(today + 'T00:00:00+09:00');
    const yesterdayString = getYesterdayDateString();
    // 最終学習日を文字列に変換
    let lastStudyDateString = null;
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
    }
    else if (lastStudyDateString === today) {
        // 今日既に更新済みの場合、現在のストリークを維持
        newStreak = stats.currentStreak || 1;
    }
    // 月初めの場合は月間統計をリセット
    const currentMonth = todayDate.getMonth();
    const lastStudyMonth = lastStudyDate === null || lastStudyDate === void 0 ? void 0 : lastStudyDate.getMonth();
    const isNewMonth = lastStudyMonth !== currentMonth;
    return Object.assign(Object.assign({}, stats), { currentMonthStudyDays: isNewMonth ? 1 : (stats.currentMonthStudyDays || 0) + 1, currentMonthSkipDays: isNewMonth ? 0 : stats.currentMonthSkipDays, totalStudyDays: (stats.totalStudyDays || 0) + 1, currentStreak: newStreak, longestStreak: Math.max(stats.longestStreak || 0, newStreak), lastStudyDate: firestore_1.Timestamp.fromDate(todayDate), lastCheckedDate: firestore_1.Timestamp.now() });
}
/**
 * GitHubユーザー名でFirestoreユーザーを検索
 */
async function findUserByGitHubUsername(username) {
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
    return Object.assign(Object.assign({}, doc.data()), { uid: doc.id });
}
/**
 * 今日既に通知済みかチェック
 */
async function hasNotifiedToday(userId) {
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
async function markAsNotified(userId) {
    const db = admin.firestore();
    const today = getTodayDateString();
    await db.collection('pushNotifications').doc(`${userId}_${today}`).set({
        userId,
        date: today,
        notifiedAt: firestore_1.Timestamp.now(),
    });
}
/**
 * GitHub pushイベントを処理
 */
async function handleGitHubPush(senderUsername) {
    var _a, _b;
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
    const lastStudyDate = ((_b = (_a = user.stats.lastStudyDate) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || null;
    let lastStudyDateString = null;
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
    }
    else {
        console.log('Stats already updated today, skipping');
        newStreak = user.stats.currentStreak || 1;
    }
    // 通知を送信（今日まだ通知していない場合のみ）
    let notificationSent = false;
    if (user.fcmToken && user.notificationsEnabled) {
        const alreadyNotified = await hasNotifiedToday(user.uid);
        if (!alreadyNotified) {
            console.log('Sending push notification to:', user.uid);
            const result = await (0, pushNotification_1.sendGitHubPushNotification)(user.fcmToken, newStreak);
            if (result.success) {
                await markAsNotified(user.uid);
                notificationSent = true;
                console.log('Push notification sent successfully');
            }
            else {
                console.error('Failed to send push notification:', result.error);
            }
        }
        else {
            console.log('Already notified today, skipping notification');
        }
    }
    else {
        console.log('User has no fcmToken or notifications disabled');
    }
    return {
        success: true,
        message: `Processed push for ${senderUsername}`,
        notificationSent,
        statsUpdated,
    };
}
//# sourceMappingURL=githubWebhook.js.map