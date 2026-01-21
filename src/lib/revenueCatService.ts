import Purchases, {
  PurchasesPackage,
  CustomerInfo,
  PurchasesOfferings,
  LOG_LEVEL,
} from 'react-native-purchases';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { Timestamp } from 'firebase/firestore';
import { UserSubscription } from '../types';

// RevenueCat API Key (環境変数から取得)
const REVENUECAT_API_KEY =
  Constants.expoConfig?.extra?.revenueCatApiKey ||
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ||
  '';

// プロダクトID
export const PRODUCT_IDS = {
  MONTHLY_300: 'batsugaku_monthly_300',
} as const;

// エンタイトルメントID
export const ENTITLEMENT_IDS = {
  PREMIUM: 'premium',
} as const;

/**
 * RevenueCatを初期化
 */
export async function initializeRevenueCat(userId?: string): Promise<void> {
  if (!REVENUECAT_API_KEY) {
    console.warn('RevenueCat API key not configured');
    return;
  }

  try {
    // デバッグログを有効化（開発中のみ）
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    // 初期化
    await Purchases.configure({
      apiKey: REVENUECAT_API_KEY,
      appUserID: userId,
    });

    console.log('RevenueCat initialized successfully');
  } catch (error) {
    console.error('Failed to initialize RevenueCat:', error);
    throw error;
  }
}

/**
 * RevenueCatのユーザーIDを設定（Firebase UIDと紐付け）
 */
export async function setRevenueCatUserId(userId: string): Promise<void> {
  try {
    await Purchases.logIn(userId);
  } catch (error) {
    console.error('Failed to set RevenueCat user ID:', error);
    throw error;
  }
}

/**
 * 利用可能なオファリング（商品）を取得
 */
export async function getOfferings(): Promise<PurchasesOfferings | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings;
  } catch (error) {
    console.error('Failed to get offerings:', error);
    return null;
  }
}

/**
 * 現在のオファリングのパッケージを取得
 */
export async function getCurrentPackage(): Promise<PurchasesPackage | null> {
  try {
    const offerings = await getOfferings();
    if (offerings?.current?.availablePackages) {
      return offerings.current.availablePackages[0] || null;
    }
    return null;
  } catch (error) {
    console.error('Failed to get current package:', error);
    return null;
  }
}

/**
 * パッケージを購入
 */
export async function purchasePackage(
  pkg: PurchasesPackage
): Promise<CustomerInfo | null> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  } catch (error: any) {
    // ユーザーがキャンセルした場合
    if (error.userCancelled) {
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
export async function restorePurchases(): Promise<CustomerInfo | null> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo;
  } catch (error) {
    console.error('Failed to restore purchases:', error);
    throw error;
  }
}

/**
 * 現在の顧客情報を取得
 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (error) {
    console.error('Failed to get customer info:', error);
    return null;
  }
}

/**
 * プレミアムエンタイトルメントがアクティブかどうか
 */
export async function isPremiumActive(): Promise<boolean> {
  try {
    const customerInfo = await getCustomerInfo();
    if (!customerInfo) {
      return false;
    }

    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_IDS.PREMIUM];
    return !!entitlement;
  } catch (error) {
    console.error('Failed to check premium status:', error);
    return false;
  }
}

/**
 * CustomerInfoからUserSubscriptionに変換
 */
export function customerInfoToUserSubscription(
  customerInfo: CustomerInfo
): UserSubscription | null {
  const entitlement = customerInfo.entitlements.active[ENTITLEMENT_IDS.PREMIUM];

  if (!entitlement) {
    return null;
  }

  // 有効期限を取得
  const expirationDate = entitlement.expirationDate
    ? new Date(entitlement.expirationDate)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // デフォルト30日

  // 購入日を取得
  const purchaseDate = entitlement.latestPurchaseDate
    ? new Date(entitlement.latestPurchaseDate)
    : new Date();

  return {
    isActive: true,
    productId: entitlement.productIdentifier,
    purchasedAt: Timestamp.fromDate(purchaseDate),
    expiresAt: Timestamp.fromDate(expirationDate),
    originalTransactionId: entitlement.originalPurchaseDate || '',
  };
}

/**
 * サブスクリプションの管理ページを開く
 */
export async function openSubscriptionManagement(): Promise<void> {
  try {
    const customerInfo = await getCustomerInfo();
    if (!customerInfo) {
      throw new Error('Customer info not available');
    }

    // App Storeの管理ページURLを取得
    const managementURL = customerInfo.managementURL;
    if (managementURL) {
      // URLを開く（Linkingを使用）
      const { Linking } = await import('react-native');
      await Linking.openURL(managementURL);
    } else {
      // iOSの場合はApp Store設定へ
      if (Platform.OS === 'ios') {
        const { Linking } = await import('react-native');
        await Linking.openURL('itms-apps://apps.apple.com/account/subscriptions');
      }
    }
  } catch (error) {
    console.error('Failed to open subscription management:', error);
    throw error;
  }
}

/**
 * 価格をフォーマット
 */
export function formatPrice(pkg: PurchasesPackage): string {
  return pkg.product.priceString;
}

/**
 * RevenueCatのログアウト
 */
export async function logOutRevenueCat(): Promise<void> {
  try {
    await Purchases.logOut();
  } catch (error) {
    console.error('Failed to log out from RevenueCat:', error);
  }
}
