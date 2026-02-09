/**
 * Expo Push Notification送信機能
 */

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
}

interface ExpoPushTicket {
  id?: string;
  status: 'ok' | 'error';
  message?: string;
  details?: {
    error?: string;
  };
}

/**
 * Expo Push Notificationを送信
 */
export async function sendExpoPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  // Expo Push Tokenの形式チェック
  if (!expoPushToken.startsWith('ExponentPushToken[')) {
    console.error('Invalid Expo push token format:', expoPushToken);
    return { success: false, error: 'Invalid push token format' };
  }

  const message: ExpoPushMessage = {
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

    const result = await response.json() as { data: ExpoPushTicket };
    const ticket = result.data;

    if (ticket.status === 'error') {
      console.error('Push notification error:', ticket.message, ticket.details);
      return { success: false, error: ticket.message || 'Unknown error' };
    }

    console.log('Push notification sent successfully:', ticket.id);
    return { success: true };
  } catch (error) {
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
export async function sendGitHubPushNotification(
  expoPushToken: string,
  streakDays: number
): Promise<{ success: boolean; error?: string }> {
  const title = 'お疲れ様でした！';
  const body = streakDays > 1
    ? `これで${streakDays}日連続！えらい！！`
    : '今日も学習ご苦労様';

  return sendExpoPushNotification(expoPushToken, title, body, {
    type: 'github_push',
    streakDays,
  });
}
