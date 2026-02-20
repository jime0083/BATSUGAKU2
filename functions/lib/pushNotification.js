"use strict";
/**
 * Expo Push Notification送信機能
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendExpoPushNotification = sendExpoPushNotification;
exports.sendGitHubPushNotification = sendGitHubPushNotification;
exports.sendReminderNotification = sendReminderNotification;
/**
 * Expo Push Notificationを送信
 */
async function sendExpoPushNotification(expoPushToken, title, body, data) {
    // Expo Push Tokenの形式チェック
    if (!expoPushToken.startsWith('ExponentPushToken[')) {
        console.error('Invalid Expo push token format:', expoPushToken);
        return { success: false, error: 'Invalid push token format' };
    }
    const message = {
        to: expoPushToken,
        title,
        body,
        data,
        sound: 'default',
    };
    try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate',
            },
            body: JSON.stringify(message),
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Expo push API error:', response.status, errorText);
            return { success: false, error: `HTTP ${response.status}: ${errorText}` };
        }
        const result = await response.json();
        const ticket = result.data;
        if (ticket.status === 'error') {
            console.error('Push notification error:', ticket.message, ticket.details);
            return { success: false, error: ticket.message || 'Unknown error' };
        }
        console.log('Push notification sent successfully:', ticket.id);
        return { success: true };
    }
    catch (error) {
        console.error('Failed to send push notification:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
/**
 * GitHub push検出時の通知を送信
 */
async function sendGitHubPushNotification(expoPushToken, streakDays) {
    const title = 'お疲れ様でした！';
    const body = streakDays > 1
        ? `これで${streakDays}日連続！えらい！！`
        : '今日もお疲れ様';
    return sendExpoPushNotification(expoPushToken, title, body, {
        type: 'github_push',
        streakDays,
    });
}
/**
 * 23:30リマインダー通知を送信
 * ユーザーがまだ今日pushしていない場合に送信される
 */
async function sendReminderNotification(expoPushToken, currentStreak) {
    const title = 'まだpushしてないよ！';
    const body = currentStreak > 0
        ? `今日pushしないと${currentStreak}日連続の記録が途切れちゃうよ！`
        : '今日もpushして記録を伸ばそう！';
    return sendExpoPushNotification(expoPushToken, title, body, {
        type: 'reminder',
        currentStreak,
    });
}
//# sourceMappingURL=pushNotification.js.map