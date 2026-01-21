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
exports.getTodayDateString = getTodayDateString;
exports.hasCheckedToday = hasCheckedToday;
exports.performDailyCheckForUser = performDailyCheckForUser;
exports.performDailyCheckForAllUsers = performDailyCheckForAllUsers;
exports.saveDailyStats = saveDailyStats;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const github_1 = require("./github");
const twitter_1 = require("./twitter");
// ストリークマイルストーン
const STREAK_MILESTONES = [5, 10, 15, 20, 25, 30, 50, 100, 200, 365];
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
 * ユーザーが今日既にチェック済みかどうか
 */
async function hasCheckedToday(userId) {
    const db = admin.firestore();
    const today = getTodayDateString();
    const snapshot = await db
        .collection('dailyLogs')
        .where('userId', '==', userId)
        .where('date', '==', today)
        .limit(1)
        .get();
    return !snapshot.empty;
}
/**
 * 統計を更新（学習日）
 */
function updateStatsForStudy(stats, today) {
    var _a;
    const lastStudyDate = (_a = stats.lastStudyDate) === null || _a === void 0 ? void 0 : _a.toDate();
    const todayDate = new Date(today + 'T00:00:00+09:00');
    // 連続日数の計算
    let newStreak = 1;
    if (lastStudyDate) {
        const diffDays = Math.floor((todayDate.getTime() - lastStudyDate.getTime()) / (24 * 60 * 60 * 1000));
        if (diffDays === 1) {
            newStreak = stats.currentStreak + 1;
        }
        else if (diffDays === 0) {
            newStreak = stats.currentStreak;
        }
    }
    // 月初めの場合は月間統計をリセット
    const isFirstOfMonth = todayDate.getDate() === 1;
    return Object.assign(Object.assign({}, stats), { currentMonthStudyDays: isFirstOfMonth ? 1 : stats.currentMonthStudyDays + 1, currentMonthSkipDays: isFirstOfMonth ? 0 : stats.currentMonthSkipDays, totalStudyDays: stats.totalStudyDays + 1, currentStreak: newStreak, longestStreak: Math.max(stats.longestStreak, newStreak), lastStudyDate: firestore_1.Timestamp.fromDate(todayDate), lastCheckedDate: firestore_1.Timestamp.now() });
}
/**
 * 統計を更新（サボり）
 */
function updateStatsForSkip(stats, today) {
    const todayDate = new Date(today + 'T00:00:00+09:00');
    // 月初めの場合は月間統計をリセット
    const isFirstOfMonth = todayDate.getDate() === 1;
    return Object.assign(Object.assign({}, stats), { currentMonthStudyDays: isFirstOfMonth ? 0 : stats.currentMonthStudyDays, currentMonthSkipDays: isFirstOfMonth ? 1 : stats.currentMonthSkipDays + 1, totalSkipDays: stats.totalSkipDays + 1, currentStreak: 0, lastCheckedDate: firestore_1.Timestamp.now() });
}
/**
 * ストリークがマイルストーンに達したかチェック
 */
function checkStreakMilestone(streak) {
    return STREAK_MILESTONES.includes(streak) ? streak : null;
}
/**
 * 単一ユーザーの日次チェックを実行
 */
async function performDailyCheckForUser(user, xClientId, xClientSecret) {
    const db = admin.firestore();
    const today = getTodayDateString();
    // 既にチェック済みの場合はスキップ
    const alreadyChecked = await hasCheckedToday(user.uid);
    if (alreadyChecked) {
        return {
            userId: user.uid,
            hasPushed: false,
            newStreak: user.stats.currentStreak,
            tweetedSkip: false,
            tweetedStreak: false,
            error: 'Already checked today',
        };
    }
    // GitHub pushチェック
    const { hasPushed, error: githubError } = await (0, github_1.checkUserPush)(user);
    if (githubError && githubError !== 'GitHub not linked') {
        console.error(`GitHub check failed for ${user.uid}:`, githubError);
    }
    // 統計更新
    const newStats = hasPushed
        ? updateStatsForStudy(user.stats, today)
        : updateStatsForSkip(user.stats, today);
    let tweetedSkip = false;
    let tweetedStreak = false;
    // X連携がある場合のみツイート
    if (user.xLinked && user.xAccessToken) {
        // トークンの有効期限チェック＆リフレッシュ
        let currentUser = user;
        if ((0, twitter_1.isTokenExpired)(user) && user.xRefreshToken && xClientId && xClientSecret) {
            const refreshed = await (0, twitter_1.refreshXToken)(user.xRefreshToken, xClientId, xClientSecret);
            if (refreshed) {
                await db.collection('users').doc(user.uid).update({
                    xAccessToken: refreshed.accessToken,
                    xRefreshToken: refreshed.refreshToken,
                    xTokenExpiresAt: refreshed.expiresAt,
                });
                currentUser = Object.assign(Object.assign({}, user), { xAccessToken: refreshed.accessToken, xRefreshToken: refreshed.refreshToken, xTokenExpiresAt: refreshed.expiresAt });
            }
        }
        if (!hasPushed) {
            // サボりツイート
            const skipResult = await (0, twitter_1.postSkipTweet)(currentUser);
            tweetedSkip = skipResult.success;
            if (!skipResult.success) {
                console.error(`Skip tweet failed for ${user.uid}:`, skipResult.error);
            }
        }
        else {
            // ストリークマイルストーンチェック
            const milestone = checkStreakMilestone(newStats.currentStreak);
            if (milestone) {
                const streakResult = await (0, twitter_1.postStreakTweet)(currentUser, milestone);
                tweetedStreak = streakResult.success;
                if (!streakResult.success) {
                    console.error(`Streak tweet failed for ${user.uid}:`, streakResult.error);
                }
            }
        }
    }
    // DailyLog保存
    const dailyLog = {
        userId: user.uid,
        date: today,
        hasPushed,
        checkedAt: firestore_1.Timestamp.now(),
        tweetedSkip,
        tweetedStreak,
        streakAtCheck: newStats.currentStreak,
        earnedBadges: [], // バッジは別途処理
    };
    await db.collection('dailyLogs').add(dailyLog);
    // ユーザー統計更新
    await db.collection('users').doc(user.uid).update({
        stats: newStats,
    });
    return {
        userId: user.uid,
        hasPushed,
        newStreak: newStats.currentStreak,
        tweetedSkip,
        tweetedStreak,
    };
}
/**
 * 全ユーザーの日次チェックを実行
 */
async function performDailyCheckForAllUsers(xClientId, xClientSecret) {
    var _a;
    const db = admin.firestore();
    // アクティブなユーザーを取得
    // - オンボーディング完了済み
    // - GitHub連携済み
    // - サブスク有効 or 管理者
    const usersSnapshot = await db
        .collection('users')
        .where('onboardingCompleted', '==', true)
        .where('githubLinked', '==', true)
        .get();
    const results = {
        totalUsers: 0,
        studyCount: 0,
        skipCount: 0,
        errors: [],
    };
    for (const doc of usersSnapshot.docs) {
        const user = Object.assign(Object.assign({}, doc.data()), { uid: doc.id });
        // サブスクチェック（管理者はバイパス）
        const hasAccess = user.isAdmin ||
            (((_a = user.subscription) === null || _a === void 0 ? void 0 : _a.isActive) &&
                user.subscription.expiresAt.toDate() > new Date());
        if (!hasAccess) {
            continue;
        }
        results.totalUsers++;
        try {
            const result = await performDailyCheckForUser(user, xClientId, xClientSecret);
            if (result.error && result.error !== 'Already checked today') {
                results.errors.push(`${user.uid}: ${result.error}`);
            }
            else if (!result.error) {
                if (result.hasPushed) {
                    results.studyCount++;
                }
                else {
                    results.skipCount++;
                }
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            results.errors.push(`${user.uid}: ${errorMessage}`);
            console.error(`Error checking user ${user.uid}:`, error);
        }
    }
    return results;
}
/**
 * 日次統計を保存
 */
async function saveDailyStats(studyCount, skipCount) {
    const db = admin.firestore();
    const today = getTodayDateString();
    await db.collection('dailyStats').doc(today).set({
        date: today,
        totalUsers: studyCount + skipCount,
        studyCount,
        skipCount,
        createdAt: firestore_1.Timestamp.now(),
    });
}
//# sourceMappingURL=dailyCheck.js.map