"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTodayPushEvents = getTodayPushEvents;
exports.checkUserPush = checkUserPush;
const GITHUB_API_BASE_URL = 'https://api.github.com';
/**
 * ユーザーの昨日のpushイベントを取得
 * 日次チェックは0:00 JSTに実行されるため、前日（終了した日）のpushをチェックする
 */
async function getTodayPushEvents(accessToken, username) {
    try {
        // 日付範囲を計算（JST基準）
        // 日次チェックは0:00 JSTに実行されるため、前日のpushをチェックする
        const now = new Date();
        const jstOffset = 9 * 60 * 60 * 1000; // JST = UTC + 9時間
        const jstNow = new Date(now.getTime() + jstOffset);
        // JSTでの昨日の0:00を計算（前日の開始時刻）
        const yesterdayStart = new Date(jstNow);
        yesterdayStart.setUTCHours(0, 0, 0, 0);
        yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1); // 1日前
        yesterdayStart.setTime(yesterdayStart.getTime() - jstOffset); // UTCに戻す
        // JSTでの今日の0:00を計算（前日の終了時刻）
        const todayStart = new Date(jstNow);
        todayStart.setUTCHours(0, 0, 0, 0);
        todayStart.setTime(todayStart.getTime() - jstOffset); // UTCに戻す
        const response = await fetch(`${GITHUB_API_BASE_URL}/users/${username}/events?per_page=100`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Batsugaku-App',
            },
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('GitHub API error:', errorText);
            return {
                hasPushed: false,
                error: `GitHub API error: ${response.status}`,
            };
        }
        const events = await response.json();
        // PushEventをフィルタリング（昨日のpushをチェック）
        const pushEvents = events.filter((event) => {
            if (event.type !== 'PushEvent')
                return false;
            const eventDate = new Date(event.created_at);
            // 昨日0:00 JST <= イベント日時 < 今日0:00 JST
            return eventDate >= yesterdayStart && eventDate < todayStart;
        });
        return {
            hasPushed: pushEvents.length > 0,
        };
    }
    catch (error) {
        console.error('GitHub API error:', error);
        return {
            hasPushed: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
/**
 * ユーザーがGitHub連携済みかつ今日pushしたかをチェック
 */
async function checkUserPush(user) {
    // GitHub連携チェック
    if (!user.githubLinked || !user.githubAccessToken || !user.githubUsername) {
        return {
            hasPushed: false,
            error: 'GitHub not linked',
        };
    }
    return getTodayPushEvents(user.githubAccessToken, user.githubUsername);
}
//# sourceMappingURL=github.js.map