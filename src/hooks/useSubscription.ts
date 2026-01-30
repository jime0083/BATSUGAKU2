import { useState, useEffect, useCallback } from 'react';
import {
  initializeIAP,
  setIAPUserId,
  getSubscriptionProducts,
  purchaseSubscription,
  restoreIAPPurchases,
  getCurrentSubscriptionInfo,
  isPremiumActive,
  iapInfoToUserSubscription,
  openSubscriptionManagement,
  formatPrice,
  endIAPConnection,
  IAPProduct,
  PRODUCT_IDS,
} from '../lib/iapService';
import { updateUser } from '../lib/firestoreService';
import { User } from '../types';
import { hasPremiumAccess } from '../lib/subscription';

export interface SubscriptionState {
  isInitialized: boolean;
  isLoading: boolean;
  isPremium: boolean;
  products: IAPProduct[];
  error: Error | null;
}

export interface UseSubscriptionReturn extends SubscriptionState {
  purchase: (productId: string) => Promise<boolean>;
  restore: () => Promise<boolean>;
  openManagement: () => Promise<void>;
  refresh: () => Promise<void>;
  getPrice: (productId?: string) => string;
  PRODUCT_IDS: typeof PRODUCT_IDS;
}

export function useSubscription(user: User | null): UseSubscriptionReturn {
  const [state, setState] = useState<SubscriptionState>({
    isInitialized: false,
    isLoading: true,
    isPremium: false,
    products: [],
    error: null,
  });

  // 初期化
  useEffect(() => {
    const initialize = async () => {
      if (!user) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isPremium: false,
        }));
        return;
      }

      // 管理者チェック（IAP初期化前にチェック）
      if (user.isAdmin) {
        setState((prev) => ({
          ...prev,
          isInitialized: true,
          isLoading: false,
          isPremium: true,
        }));
        return;
      }

      try {
        // IAP初期化
        await initializeIAP(user.uid);
        setIAPUserId(user.uid);

        // 全ての商品を取得
        const products = await getSubscriptionProducts();

        // プレミアム状態を確認
        const premium = await isPremiumActive();

        setState({
          isInitialized: true,
          isLoading: false,
          isPremium: premium || hasPremiumAccess(user),
          products,
          error: null,
        });
      } catch (error) {
        console.error('Failed to initialize subscription:', error);
        setState((prev) => ({
          ...prev,
          isInitialized: false,
          isLoading: false,
          isPremium: hasPremiumAccess(user),
          error: error instanceof Error ? error : new Error('Initialization failed'),
        }));
      }
    };

    initialize();

    // クリーンアップ
    return () => {
      endIAPConnection();
    };
  }, [user?.uid, user?.isAdmin]);

  // 状態を更新
  const refresh = useCallback(async () => {
    if (!user || user.isAdmin) {
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const subscriptionInfo = await getCurrentSubscriptionInfo();
      const premium = await isPremiumActive();

      // Firestoreを更新
      if (subscriptionInfo) {
        const subscription = iapInfoToUserSubscription(subscriptionInfo);
        if (subscription) {
          await updateUser(user.uid, { subscription });
        }
      }

      setState((prev) => ({
        ...prev,
        isLoading: false,
        isPremium: premium || hasPremiumAccess(user),
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Refresh failed'),
      }));
    }
  }, [user]);

  // 購入
  const purchase = useCallback(async (productId: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const subscriptionInfo = await purchaseSubscription(productId);

      if (!subscriptionInfo) {
        // ユーザーがキャンセル
        setState((prev) => ({ ...prev, isLoading: false }));
        return false;
      }

      // Firestoreを更新
      if (user) {
        const subscription = iapInfoToUserSubscription(subscriptionInfo);
        if (subscription) {
          await updateUser(user.uid, { subscription });
        }
      }

      setState((prev) => ({
        ...prev,
        isLoading: false,
        isPremium: true,
      }));

      return true;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Purchase failed'),
      }));
      return false;
    }
  }, [user]);

  // 復元
  const restore = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const subscriptionInfo = await restoreIAPPurchases();

      if (!subscriptionInfo) {
        setState((prev) => ({ ...prev, isLoading: false }));
        return false;
      }

      const premium = subscriptionInfo.isActive;

      // Firestoreを更新
      if (user && premium) {
        const subscription = iapInfoToUserSubscription(subscriptionInfo);
        if (subscription) {
          await updateUser(user.uid, { subscription });
        }
      }

      setState((prev) => ({
        ...prev,
        isLoading: false,
        isPremium: premium,
      }));

      return premium;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Restore failed'),
      }));
      return false;
    }
  }, [user]);

  // 管理ページを開く
  const openManagement = useCallback(async () => {
    try {
      await openSubscriptionManagement();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error : new Error('Failed to open management'),
      }));
    }
  }, []);

  // 価格を取得
  const getPrice = useCallback((productId?: string): string => {
    if (productId) {
      const product = state.products.find(p => p.productId === productId);
      if (product) {
        return formatPrice(product);
      }
    }
    // デフォルト価格
    if (productId === PRODUCT_IDS.YEARLY_3000) {
      return '¥3,000';
    }
    return '¥300';
  }, [state.products]);

  return {
    ...state,
    purchase,
    restore,
    openManagement,
    refresh,
    getPrice,
    PRODUCT_IDS,
  };
}
