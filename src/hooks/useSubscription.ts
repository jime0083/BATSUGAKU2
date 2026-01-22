import { useState, useEffect, useCallback } from 'react';
import {
  initializeIAP,
  setIAPUserId,
  getCurrentProduct,
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
  currentProduct: IAPProduct | null;
  error: Error | null;
}

export interface UseSubscriptionReturn extends SubscriptionState {
  purchase: () => Promise<boolean>;
  restore: () => Promise<boolean>;
  openManagement: () => Promise<void>;
  refresh: () => Promise<void>;
  getPrice: () => string;
}

export function useSubscription(user: User | null): UseSubscriptionReturn {
  const [state, setState] = useState<SubscriptionState>({
    isInitialized: false,
    isLoading: true,
    isPremium: false,
    currentProduct: null,
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

        // 現在の商品を取得
        const product = await getCurrentProduct();

        // プレミアム状態を確認
        const premium = await isPremiumActive();

        setState({
          isInitialized: true,
          isLoading: false,
          isPremium: premium || hasPremiumAccess(user),
          currentProduct: product,
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
  const purchase = useCallback(async (): Promise<boolean> => {
    const productId = state.currentProduct?.productId || PRODUCT_IDS.MONTHLY_300;

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
  }, [state.currentProduct, user]);

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
  const getPrice = useCallback((): string => {
    if (state.currentProduct) {
      return formatPrice(state.currentProduct);
    }
    return '¥300/月';
  }, [state.currentProduct]);

  return {
    ...state,
    purchase,
    restore,
    openManagement,
    refresh,
    getPrice,
  };
}
