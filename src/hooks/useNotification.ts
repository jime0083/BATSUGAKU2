import { useState, useEffect, useCallback, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { User } from '../types';
import {
  requestNotificationPermissions,
  getPushToken,
  setupNotificationChannels,
  scheduleAllReminders,
  cancelAllReminders,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  clearBadgeCount,
} from '../lib/notificationService';
import { updateUser } from '../lib/firestoreService';

export interface NotificationState {
  isInitialized: boolean;
  hasPermission: boolean;
  pushToken: string | null;
  isLoading: boolean;
  error: Error | null;
}

export interface UseNotificationReturn extends NotificationState {
  requestPermission: () => Promise<boolean>;
  enableReminders: () => Promise<void>;
  disableReminders: () => Promise<void>;
  clearBadge: () => Promise<void>;
}

export function useNotification(user: User | null): UseNotificationReturn {
  const [state, setState] = useState<NotificationState>({
    isInitialized: false,
    hasPermission: false,
    pushToken: null,
    isLoading: false,
    error: null,
  });

  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  // 初期化処理
  useEffect(() => {
    const initialize = async () => {
      if (!user) {
        setState((prev) => ({
          ...prev,
          isInitialized: false,
          hasPermission: false,
          pushToken: null,
        }));
        return;
      }

      setState((prev) => ({ ...prev, isLoading: true }));

      try {
        // Androidの通知チャンネル設定
        await setupNotificationChannels();

        // 権限確認
        const { status } = await Notifications.getPermissionsAsync();
        const hasPermission = status === 'granted';

        // プッシュトークン取得（権限がある場合）
        let pushToken: string | null = null;
        if (hasPermission) {
          pushToken = await getPushToken();

          // Firestoreに保存（トークンが変わった場合）
          if (pushToken && pushToken !== user.fcmToken) {
            await updateUser(user.uid, { fcmToken: pushToken });
          }

          // 通知が有効な場合、リマインダーをスケジュール
          if (user.notificationsEnabled) {
            await scheduleAllReminders();
          }
        }

        setState({
          isInitialized: true,
          hasPermission,
          pushToken,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isInitialized: true,
          isLoading: false,
          error: error instanceof Error ? error : new Error('通知の初期化に失敗しました'),
        }));
      }
    };

    initialize();
  }, [user?.uid, user?.fcmToken, user?.notificationsEnabled]);

  // 通知リスナー設定
  useEffect(() => {
    if (!user) return;

    // フォアグラウンドで通知を受信した時
    notificationListener.current = addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
    });

    // 通知をタップした時
    responseListener.current = addNotificationResponseReceivedListener((response) => {
      console.log('Notification response:', response);
      const data = response.notification.request.content.data;

      // 通知タイプに応じた処理
      if (data?.type === 'reminder') {
        // リマインダー通知 → ダッシュボードへ
        console.log('Reminder notification tapped');
      } else if (data?.type === 'achievement') {
        // 達成通知 → バッジ画面へ
        console.log('Achievement notification tapped');
      }
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [user?.uid]);

  // 権限リクエスト
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const granted = await requestNotificationPermissions();

      if (granted) {
        const pushToken = await getPushToken();

        if (pushToken) {
          await updateUser(user.uid, { fcmToken: pushToken });
        }

        setState((prev) => ({
          ...prev,
          hasPermission: true,
          pushToken,
          isLoading: false,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          hasPermission: false,
          isLoading: false,
        }));
      }

      return granted;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error('権限リクエストに失敗しました'),
      }));
      return false;
    }
  }, [user]);

  // リマインダー有効化
  const enableReminders = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      await scheduleAllReminders();
      await updateUser(user.uid, { notificationsEnabled: true });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error : new Error('リマインダーの設定に失敗しました'),
      }));
    }
  }, [user]);

  // リマインダー無効化
  const disableReminders = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      await cancelAllReminders();
      await updateUser(user.uid, { notificationsEnabled: false });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error : new Error('リマインダーの解除に失敗しました'),
      }));
    }
  }, [user]);

  // バッジクリア
  const clearBadge = useCallback(async (): Promise<void> => {
    try {
      await clearBadgeCount();
    } catch (error) {
      console.error('Failed to clear badge:', error);
    }
  }, []);

  return {
    ...state,
    requestPermission,
    enableReminders,
    disableReminders,
    clearBadge,
  };
}
