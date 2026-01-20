import { User, UserSubscription } from '../types';

/**
 * ユーザーがプレミアム機能にアクセスできるかどうかを判定
 * - 管理者（isAdmin: true）は常にアクセス可能
 * - サブスクリプションがアクティブな場合はアクセス可能
 */
export function hasPremiumAccess(user: User): boolean {
  // 管理者は常にアクセス可能
  if (user.isAdmin) {
    return true;
  }

  // サブスクリプションがアクティブかどうか
  return isSubscriptionActive(user.subscription);
}

/**
 * サブスクリプションがアクティブかどうかを判定
 */
export function isSubscriptionActive(
  subscription: UserSubscription | null
): boolean {
  if (!subscription) {
    return false;
  }

  if (!subscription.isActive) {
    return false;
  }

  // 有効期限をチェック
  const now = new Date();
  const expiresAt = subscription.expiresAt.toDate();

  return expiresAt > now;
}

/**
 * サブスクリプションの残り日数を計算
 */
export function getSubscriptionDaysRemaining(
  subscription: UserSubscription | null
): number {
  if (!subscription || !subscription.isActive) {
    return 0;
  }

  const now = new Date();
  const expiresAt = subscription.expiresAt.toDate();
  const diffTime = expiresAt.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

/**
 * サブスクリプションステータスの表示用テキストを取得
 */
export function getSubscriptionStatusText(user: User): string {
  if (user.isAdmin) {
    return '管理者（無料）';
  }

  if (!user.subscription) {
    return '未登録';
  }

  if (!isSubscriptionActive(user.subscription)) {
    return '期限切れ';
  }

  const daysRemaining = getSubscriptionDaysRemaining(user.subscription);
  return `アクティブ（残り${daysRemaining}日）`;
}

/**
 * プレミアム機能へのアクセスが必要な理由を取得
 */
export function getPremiumRequiredReason(user: User): string | null {
  if (hasPremiumAccess(user)) {
    return null;
  }

  if (!user.subscription) {
    return 'この機能を使用するにはサブスクリプションへの登録が必要です。';
  }

  if (!user.subscription.isActive) {
    return 'サブスクリプションが期限切れです。更新してください。';
  }

  return 'サブスクリプションの有効期限が切れています。';
}
