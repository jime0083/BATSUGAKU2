import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { NOTIFICATION_MESSAGES } from '../constants';

// 通知のデフォルト動作設定
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// 通知チャンネルID（Android用）
export const NOTIFICATION_CHANNELS = {
  REMINDER: 'reminder',
  ACHIEVEMENT: 'achievement',
} as const;

// 通知識別子
export const NOTIFICATION_IDENTIFIERS = {
  REMINDER_23: 'reminder-23',
  REMINDER_2330: 'reminder-2330',
} as const;

/**
 * 通知権限をリクエスト
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  // 実機でない場合はスキップ
  if (!Device.isDevice) {
    console.log('Notifications are not available on simulator');
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Notification permissions not granted');
    return false;
  }

  return true;
}

/**
 * FCMプッシュトークンを取得
 */
export async function getPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  try {
    // Expoプッシュトークンを取得
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn('EAS project ID not configured');
      return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    return token;
  } catch (error) {
    console.error('Failed to get push token:', error);
    return null;
  }
}

/**
 * Androidの通知チャンネルを設定
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.REMINDER, {
      name: 'リマインダー',
      description: '学習リマインダー通知',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      enableLights: true,
      lightColor: '#e94560',
    });

    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.ACHIEVEMENT, {
      name: '達成通知',
      description: '学習達成・ストリーク通知',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  }
}

/**
 * 23:00リマインダー通知をスケジュール
 */
export async function scheduleReminderNotification23(): Promise<string | null> {
  try {
    // 既存の通知をキャンセル
    await cancelScheduledNotification(NOTIFICATION_IDENTIFIERS.REMINDER_23);

    // 今日の23:00を計算
    const now = new Date();
    const trigger = new Date();
    trigger.setHours(23, 0, 0, 0);

    // 既に23:00を過ぎている場合は明日
    if (trigger <= now) {
      trigger.setDate(trigger.getDate() + 1);
    }

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: NOTIFICATION_MESSAGES.reminder23.title,
        body: NOTIFICATION_MESSAGES.reminder23.body,
        data: { type: 'reminder', time: '23:00' },
        sound: 'default',
        ...(Platform.OS === 'android' && {
          channelId: NOTIFICATION_CHANNELS.REMINDER,
        }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 23,
        minute: 0,
      },
      identifier: NOTIFICATION_IDENTIFIERS.REMINDER_23,
    });

    return identifier;
  } catch (error) {
    console.error('Failed to schedule 23:00 reminder:', error);
    return null;
  }
}

/**
 * 23:30最終警告通知をスケジュール
 */
export async function scheduleReminderNotification2330(): Promise<string | null> {
  try {
    // 既存の通知をキャンセル
    await cancelScheduledNotification(NOTIFICATION_IDENTIFIERS.REMINDER_2330);

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: NOTIFICATION_MESSAGES.reminder2330.title,
        body: NOTIFICATION_MESSAGES.reminder2330.body,
        data: { type: 'reminder', time: '23:30' },
        sound: 'default',
        ...(Platform.OS === 'android' && {
          channelId: NOTIFICATION_CHANNELS.REMINDER,
        }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 23,
        minute: 30,
      },
      identifier: NOTIFICATION_IDENTIFIERS.REMINDER_2330,
    });

    return identifier;
  } catch (error) {
    console.error('Failed to schedule 23:30 reminder:', error);
    return null;
  }
}

/**
 * 全てのリマインダー通知をスケジュール
 */
export async function scheduleAllReminders(): Promise<void> {
  await scheduleReminderNotification23();
  await scheduleReminderNotification2330();
}

/**
 * 特定の通知をキャンセル
 */
export async function cancelScheduledNotification(identifier: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (error) {
    console.error('Failed to cancel notification:', error);
  }
}

/**
 * 全てのリマインダー通知をキャンセル
 */
export async function cancelAllReminders(): Promise<void> {
  await cancelScheduledNotification(NOTIFICATION_IDENTIFIERS.REMINDER_23);
  await cancelScheduledNotification(NOTIFICATION_IDENTIFIERS.REMINDER_2330);
}

/**
 * 全てのスケジュール済み通知をキャンセル
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * push検出時の達成通知を送信
 */
export async function sendPushDetectedNotification(streakDays: number): Promise<void> {
  try {
    const message = NOTIFICATION_MESSAGES.pushDetected(streakDays);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: message.title,
        body: message.body,
        data: { type: 'achievement', streakDays },
        sound: 'default',
        ...(Platform.OS === 'android' && {
          channelId: NOTIFICATION_CHANNELS.ACHIEVEMENT,
        }),
      },
      trigger: null, // 即時送信
    });
  } catch (error) {
    console.error('Failed to send push detected notification:', error);
  }
}

/**
 * ストリークマイルストーン達成通知を送信
 */
export async function sendStreakMilestoneNotification(days: number): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'ストリーク達成！',
        body: `${days}日連続学習達成おめでとうございます！`,
        data: { type: 'milestone', days },
        sound: 'default',
        ...(Platform.OS === 'android' && {
          channelId: NOTIFICATION_CHANNELS.ACHIEVEMENT,
        }),
      },
      trigger: null, // 即時送信
    });
  } catch (error) {
    console.error('Failed to send streak milestone notification:', error);
  }
}

/**
 * バッジ獲得通知を送信
 */
export async function sendBadgeEarnedNotification(badgeName: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'バッジ獲得！',
        body: `「${badgeName}」バッジを獲得しました！`,
        data: { type: 'badge', badgeName },
        sound: 'default',
        ...(Platform.OS === 'android' && {
          channelId: NOTIFICATION_CHANNELS.ACHIEVEMENT,
        }),
      },
      trigger: null, // 即時送信
    });
  } catch (error) {
    console.error('Failed to send badge earned notification:', error);
  }
}

/**
 * 今日のリマインダーをキャンセル（学習完了時に呼び出す）
 */
export async function cancelTodayReminders(): Promise<void> {
  // 今日のリマインダーのみキャンセル（毎日のスケジュールは維持）
  // 注: expo-notificationsでは日次トリガーは翌日以降も有効なため、
  // 今日の分だけキャンセルするには別途フラグ管理が必要
  // ここでは簡易的にスキップのみ
  console.log('Today\'s reminders would be skipped (handled by app state)');
}

/**
 * スケジュール済み通知一覧を取得
 */
export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  return await Notifications.getAllScheduledNotificationsAsync();
}

/**
 * 通知リスナーを追加
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * 通知レスポンスリスナーを追加（通知タップ時）
 */
export function addNotificationResponseReceivedListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * バッジカウントを設定
 */
export async function setBadgeCount(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error('Failed to set badge count:', error);
  }
}

/**
 * バッジカウントをクリア
 */
export async function clearBadgeCount(): Promise<void> {
  await setBadgeCount(0);
}
