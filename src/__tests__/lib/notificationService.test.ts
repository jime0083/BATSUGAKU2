// expo-notificationsのモック
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  setBadgeCountAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  AndroidImportance: {
    HIGH: 4,
    DEFAULT: 3,
  },
  SchedulableTriggerInputTypes: {
    DAILY: 'daily',
  },
}));

// expo-deviceのモック
jest.mock('expo-device', () => ({
  isDevice: true,
}));

// expo-constantsのモック
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        eas: {
          projectId: 'test-project-id',
        },
      },
    },
  },
}));

// react-nativeのモック
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

import * as Notifications from 'expo-notifications';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_IDENTIFIERS,
  requestNotificationPermissions,
  getPushToken,
  scheduleReminderNotification23,
  scheduleReminderNotification2330,
  cancelScheduledNotification,
  cancelAllScheduledNotifications,
  sendPushDetectedNotification,
  sendStreakMilestoneNotification,
  sendBadgeEarnedNotification,
  setBadgeCount,
  clearBadgeCount,
  getScheduledNotifications,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
} from '../../lib/notificationService';

const mockNotifications = Notifications as jest.Mocked<typeof Notifications>;

describe('notificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('定数', () => {
    it('NOTIFICATION_CHANNELSが正しく定義されている', () => {
      expect(NOTIFICATION_CHANNELS.REMINDER).toBe('reminder');
      expect(NOTIFICATION_CHANNELS.ACHIEVEMENT).toBe('achievement');
    });

    it('NOTIFICATION_IDENTIFIERSが正しく定義されている', () => {
      expect(NOTIFICATION_IDENTIFIERS.REMINDER_23).toBe('reminder-23');
      expect(NOTIFICATION_IDENTIFIERS.REMINDER_2330).toBe('reminder-2330');
    });
  });

  describe('requestNotificationPermissions', () => {
    it('既に権限がある場合、trueを返す', async () => {
      mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' } as any);

      const result = await requestNotificationPermissions();

      expect(result).toBe(true);
      expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    });

    it('権限がない場合、リクエストしてtrueを返す', async () => {
      mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'denied' } as any);
      mockNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted' } as any);

      const result = await requestNotificationPermissions();

      expect(result).toBe(true);
      expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalled();
    });

    it('権限が拒否された場合、falseを返す', async () => {
      mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'denied' } as any);
      mockNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' } as any);

      const result = await requestNotificationPermissions();

      expect(result).toBe(false);
    });
  });

  describe('getPushToken', () => {
    it('Expoプッシュトークンを返す', async () => {
      mockNotifications.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[xxx]' } as any);

      const result = await getPushToken();

      expect(result).toBe('ExponentPushToken[xxx]');
      expect(mockNotifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
        projectId: 'test-project-id',
      });
    });

    it('エラー時はnullを返す', async () => {
      mockNotifications.getExpoPushTokenAsync.mockRejectedValue(new Error('Token error'));

      const result = await getPushToken();

      expect(result).toBeNull();
    });
  });

  describe('scheduleReminderNotification23', () => {
    it('23:00リマインダーをスケジュールする', async () => {
      mockNotifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
      mockNotifications.scheduleNotificationAsync.mockResolvedValue('reminder-23');

      const result = await scheduleReminderNotification23();

      expect(result).toBe('reminder-23');
      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'reminder-23',
          content: expect.objectContaining({
            title: '学習リマインダー',
          }),
        })
      );
    });
  });

  describe('scheduleReminderNotification2330', () => {
    it('23:30リマインダーをスケジュールする', async () => {
      mockNotifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
      mockNotifications.scheduleNotificationAsync.mockResolvedValue('reminder-2330');

      const result = await scheduleReminderNotification2330();

      expect(result).toBe('reminder-2330');
      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'reminder-2330',
          content: expect.objectContaining({
            title: '最終警告',
          }),
        })
      );
    });
  });

  describe('cancelScheduledNotification', () => {
    it('指定した通知をキャンセルする', async () => {
      mockNotifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);

      await cancelScheduledNotification('test-id');

      expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('test-id');
    });
  });

  describe('cancelAllScheduledNotifications', () => {
    it('全ての通知をキャンセルする', async () => {
      mockNotifications.cancelAllScheduledNotificationsAsync.mockResolvedValue(undefined);

      await cancelAllScheduledNotifications();

      expect(mockNotifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    });
  });

  describe('sendPushDetectedNotification', () => {
    it('push検出通知を送信する', async () => {
      mockNotifications.scheduleNotificationAsync.mockResolvedValue('achievement-1');

      await sendPushDetectedNotification(5);

      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: 'お疲れ様でした！',
            body: 'これで5日連続！えらい！！',
            data: { type: 'achievement', streakDays: 5 },
          }),
          trigger: null,
        })
      );
    });

    it('1日目の場合、別のメッセージを表示する', async () => {
      mockNotifications.scheduleNotificationAsync.mockResolvedValue('achievement-1');

      await sendPushDetectedNotification(1);

      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            body: '今日も学習ご苦労様',
          }),
        })
      );
    });
  });

  describe('sendStreakMilestoneNotification', () => {
    it('ストリークマイルストーン通知を送信する', async () => {
      mockNotifications.scheduleNotificationAsync.mockResolvedValue('milestone-1');

      await sendStreakMilestoneNotification(10);

      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: 'ストリーク達成！',
            body: '10日連続学習達成おめでとうございます！',
            data: { type: 'milestone', days: 10 },
          }),
          trigger: null,
        })
      );
    });
  });

  describe('sendBadgeEarnedNotification', () => {
    it('バッジ獲得通知を送信する', async () => {
      mockNotifications.scheduleNotificationAsync.mockResolvedValue('badge-1');

      await sendBadgeEarnedNotification('5日連続');

      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: 'バッジ獲得！',
            body: '「5日連続」バッジを獲得しました！',
            data: { type: 'badge', badgeName: '5日連続' },
          }),
          trigger: null,
        })
      );
    });
  });

  describe('setBadgeCount', () => {
    it('バッジカウントを設定する', async () => {
      mockNotifications.setBadgeCountAsync.mockResolvedValue(true);

      await setBadgeCount(5);

      expect(mockNotifications.setBadgeCountAsync).toHaveBeenCalledWith(5);
    });
  });

  describe('clearBadgeCount', () => {
    it('バッジカウントをクリアする', async () => {
      mockNotifications.setBadgeCountAsync.mockResolvedValue(true);

      await clearBadgeCount();

      expect(mockNotifications.setBadgeCountAsync).toHaveBeenCalledWith(0);
    });
  });

  describe('getScheduledNotifications', () => {
    it('スケジュール済み通知一覧を返す', async () => {
      const mockNotificationsList = [
        { identifier: 'reminder-23', content: {} },
        { identifier: 'reminder-2330', content: {} },
      ];
      mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue(mockNotificationsList as any);

      const result = await getScheduledNotifications();

      expect(result).toEqual(mockNotificationsList);
    });
  });

  describe('addNotificationReceivedListener', () => {
    it('通知受信リスナーを追加する', () => {
      const callback = jest.fn();
      const mockSubscription = { remove: jest.fn() };
      mockNotifications.addNotificationReceivedListener.mockReturnValue(mockSubscription as any);

      const result = addNotificationReceivedListener(callback);

      expect(mockNotifications.addNotificationReceivedListener).toHaveBeenCalledWith(callback);
      expect(result).toBe(mockSubscription);
    });
  });

  describe('addNotificationResponseReceivedListener', () => {
    it('通知レスポンスリスナーを追加する', () => {
      const callback = jest.fn();
      const mockSubscription = { remove: jest.fn() };
      mockNotifications.addNotificationResponseReceivedListener.mockReturnValue(mockSubscription as any);

      const result = addNotificationResponseReceivedListener(callback);

      expect(mockNotifications.addNotificationResponseReceivedListener).toHaveBeenCalledWith(callback);
      expect(result).toBe(mockSubscription);
    });
  });
});
