import {
  initConnection,
  endConnection,
  getProducts,
  getSubscriptions,
  requestSubscription,
  getAvailablePurchases,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  Product,
  Subscription,
  Purchase,
  PurchaseError,
  SubscriptionPurchase,
} from 'react-native-iap';
import { Platform, Linking } from 'react-native';
import { Timestamp } from 'firebase/firestore';
import { UserSubscription } from '../types';

// プロダクトID
export const PRODUCT_IDS = {
  MONTHLY_300: 'batsugaku_monthly_300',
  YEARLY_3000: 'batsugaku_yearly_3000',
} as const;

// サブスクリプションSKU（iOS/Android共通）
const SUBSCRIPTION_SKUS: readonly string[] = [
  PRODUCT_IDS.MONTHLY_300,
  PRODUCT_IDS.YEARLY_3000,
];

// IAP接続状態
let isConnected = false;
let purchaseUpdateSubscription: ReturnType<typeof purchaseUpdatedListener> | null = null;
let purchaseErrorSubscription: ReturnType<typeof purchaseErrorListener> | null = null;

// 現在のユーザーID
let currentUserId: string | null = null;

export interface IAPProduct {
  productId: string;
  title: string;
  description: string;
  price: string;
  localizedPrice: string;
  currency: string;
}

export interface IAPSubscriptionInfo {
  isActive: boolean;
  productId: string;
  purchaseDate: Date;
  expirationDate: Date | null;
  transactionId: string;
  receipt: string;
}

/**
 * IAP接続を初期化
 */
export async function initializeIAP(userId?: string): Promise<void> {
  if (isConnected) {
    return;
  }

  try {
    await initConnection();
    isConnected = true;

    if (userId) {
      currentUserId = userId;
    }

    // 購入更新リスナーを設定
    purchaseUpdateSubscription = purchaseUpdatedListener(async (purchase) => {
      const receipt = purchase.transactionReceipt;
      if (receipt) {
        try {
          // トランザクションを完了
          await finishTransaction({ purchase, isConsumable: false });
        } catch (error) {
          console.error('Failed to finish transaction:', error);
        }
      }
    });

    // 購入エラーリスナーを設定
    purchaseErrorSubscription = purchaseErrorListener((error: PurchaseError) => {
      console.error('Purchase error:', error);
    });

    if (__DEV__) {
      console.log('IAP initialized successfully');
    }
  } catch (error) {
    console.error('Failed to initialize IAP:', error);
    throw error;
  }
}

/**
 * IAP接続を終了
 */
export async function endIAPConnection(): Promise<void> {
  if (purchaseUpdateSubscription) {
    purchaseUpdateSubscription.remove();
    purchaseUpdateSubscription = null;
  }
  if (purchaseErrorSubscription) {
    purchaseErrorSubscription.remove();
    purchaseErrorSubscription = null;
  }

  if (isConnected) {
    await endConnection();
    isConnected = false;
  }
}

/**
 * ユーザーIDを設定
 */
export function setIAPUserId(userId: string): void {
  currentUserId = userId;
}

/**
 * サブスクリプション商品を取得
 */
export async function getSubscriptionProducts(): Promise<IAPProduct[]> {
  try {
    const subscriptions = await getSubscriptions({ skus: [...SUBSCRIPTION_SKUS] });
    return subscriptions.map(subscriptionToIAPProduct);
  } catch (error) {
    console.error('Failed to get subscriptions:', error);
    return [];
  }
}

/**
 * 現在のサブスクリプション商品を取得（最初の1つ）
 */
export async function getCurrentProduct(): Promise<IAPProduct | null> {
  const products = await getSubscriptionProducts();
  return products[0] || null;
}

/**
 * Subscriptionオブジェクトを変換
 */
function subscriptionToIAPProduct(subscription: Subscription): IAPProduct {
  // iOS/Android共通のプロパティを使用
  // priceAmountMicros から価格を算出
  const priceAmountMicros = (subscription as { priceAmountMicros?: number }).priceAmountMicros || 300000000;
  const price = String(priceAmountMicros / 1000000);
  const currency = (subscription as { priceCurrencyCode?: string }).priceCurrencyCode || 'JPY';

  return {
    productId: subscription.productId,
    title: subscription.title || 'Batsugaku Premium',
    description: subscription.description || '月額プレミアムプラン',
    price,
    localizedPrice: (subscription as { localizedPrice?: string }).localizedPrice || `¥${price}`,
    currency,
  };
}

/**
 * サブスクリプションを購入
 */
export async function purchaseSubscription(
  productId: string
): Promise<IAPSubscriptionInfo | null> {
  try {
    if (Platform.OS === 'ios') {
      const purchase = await requestSubscription({
        sku: productId,
      });

      if (!purchase) {
        return null;
      }

      // 配列の場合は最初の要素を取得
      const purchaseData = Array.isArray(purchase) ? purchase[0] : purchase;

      if (!purchaseData) {
        return null;
      }

      return purchaseToSubscriptionInfo(purchaseData);
    } else {
      // Android
      const purchase = await requestSubscription({
        sku: productId,
        subscriptionOffers: [
          {
            sku: productId,
            offerToken: '',
          },
        ],
      });

      if (!purchase) {
        return null;
      }

      const purchaseData = Array.isArray(purchase) ? purchase[0] : purchase;

      if (!purchaseData) {
        return null;
      }

      return purchaseToSubscriptionInfo(purchaseData);
    }
  } catch (error: unknown) {
    const purchaseError = error as PurchaseError;
    // ユーザーがキャンセルした場合
    if (purchaseError.code === 'E_USER_CANCELLED') {
      console.log('User cancelled purchase');
      return null;
    }
    console.error('Purchase failed:', error);
    throw error;
  }
}

/**
 * 購入を復元
 */
export async function restoreIAPPurchases(): Promise<IAPSubscriptionInfo | null> {
  try {
    const purchases = await getAvailablePurchases();

    if (!purchases || purchases.length === 0) {
      return null;
    }

    // 最新の購入を取得
    const latestPurchase = purchases
      .filter((p) => SUBSCRIPTION_SKUS.includes(p.productId))
      .sort((a, b) => {
        const dateA = a.transactionDate || 0;
        const dateB = b.transactionDate || 0;
        return dateB - dateA;
      })[0];

    if (!latestPurchase) {
      return null;
    }

    return purchaseToSubscriptionInfo(latestPurchase);
  } catch (error) {
    console.error('Failed to restore purchases:', error);
    throw error;
  }
}

/**
 * PurchaseオブジェクトをIAPSubscriptionInfoに変換
 */
function purchaseToSubscriptionInfo(
  purchase: Purchase | SubscriptionPurchase
): IAPSubscriptionInfo {
  const purchaseDate = purchase.transactionDate
    ? new Date(purchase.transactionDate)
    : new Date();

  // 年額プランは365日、月額プランは30日（サーバー側で正確な検証が必要）
  const isYearly = purchase.productId === PRODUCT_IDS.YEARLY_3000;
  const daysToAdd = isYearly ? 365 : 30;
  const expirationDate = new Date(purchaseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

  return {
    isActive: true,
    productId: purchase.productId,
    purchaseDate,
    expirationDate,
    transactionId: purchase.transactionId || '',
    receipt: purchase.transactionReceipt || '',
  };
}

/**
 * 現在の購入情報を取得
 */
export async function getCurrentSubscriptionInfo(): Promise<IAPSubscriptionInfo | null> {
  try {
    const purchases = await getAvailablePurchases();

    if (!purchases || purchases.length === 0) {
      return null;
    }

    // サブスクリプション購入をフィルタ
    const subscriptionPurchase = purchases
      .filter((p) => SUBSCRIPTION_SKUS.includes(p.productId))
      .sort((a, b) => {
        const dateA = a.transactionDate || 0;
        const dateB = b.transactionDate || 0;
        return dateB - dateA;
      })[0];

    if (!subscriptionPurchase) {
      return null;
    }

    return purchaseToSubscriptionInfo(subscriptionPurchase);
  } catch (error) {
    console.error('Failed to get subscription info:', error);
    return null;
  }
}

/**
 * プレミアムがアクティブかどうか
 */
export async function isPremiumActive(): Promise<boolean> {
  try {
    const subscriptionInfo = await getCurrentSubscriptionInfo();
    if (!subscriptionInfo) {
      return false;
    }

    // 有効期限をチェック
    if (subscriptionInfo.expirationDate) {
      return subscriptionInfo.expirationDate > new Date();
    }

    return subscriptionInfo.isActive;
  } catch (error) {
    console.error('Failed to check premium status:', error);
    return false;
  }
}

/**
 * IAPSubscriptionInfoからUserSubscriptionに変換
 */
export function iapInfoToUserSubscription(
  info: IAPSubscriptionInfo
): UserSubscription | null {
  if (!info.isActive) {
    return null;
  }

  return {
    isActive: info.isActive,
    productId: info.productId,
    purchasedAt: Timestamp.fromDate(info.purchaseDate),
    expiresAt: info.expirationDate
      ? Timestamp.fromDate(info.expirationDate)
      : Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
    originalTransactionId: info.transactionId,
  };
}

/**
 * サブスクリプション管理ページを開く
 */
export async function openSubscriptionManagement(): Promise<void> {
  try {
    if (Platform.OS === 'ios') {
      await Linking.openURL('itms-apps://apps.apple.com/account/subscriptions');
    } else {
      await Linking.openURL(
        'https://play.google.com/store/account/subscriptions'
      );
    }
  } catch (error) {
    console.error('Failed to open subscription management:', error);
    throw error;
  }
}

/**
 * 価格をフォーマット
 */
export function formatPrice(product: IAPProduct): string {
  return product.localizedPrice;
}

/**
 * IAP接続をログアウト
 */
export async function logOutIAP(): Promise<void> {
  currentUserId = null;
  // IAP自体にはログアウト概念がないため、ユーザーIDをクリアするのみ
}

/**
 * レシートを取得（サーバー側検証用）
 */
export async function getReceipt(): Promise<string | null> {
  try {
    const purchases = await getAvailablePurchases();

    if (!purchases || purchases.length === 0) {
      return null;
    }

    const subscriptionPurchase = purchases.find((p) =>
      SUBSCRIPTION_SKUS.includes(p.productId)
    );

    return subscriptionPurchase?.transactionReceipt || null;
  } catch (error) {
    console.error('Failed to get receipt:', error);
    return null;
  }
}
