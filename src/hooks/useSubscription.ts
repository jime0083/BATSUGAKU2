import { useState, useEffect, useCallback } from 'react';
import { PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import {
  initializeRevenueCat,
  setRevenueCatUserId,
  getCurrentPackage,
  purchasePackage,
  restorePurchases,
  getCustomerInfo,
  isPremiumActive,
  customerInfoToUserSubscription,
  openSubscriptionManagement,
  formatPrice,
  logOutRevenueCat,
} from '../lib/revenueCatService';
import { updateUser } from '../lib/firestoreService';
import { User, UserSubscription } from '../types';
import { hasPremiumAccess } from '../lib/subscription';

export interface SubscriptionState {
  isInitialized: boolean;
  isLoading: boolean;
  isPremium: boolean;
  currentPackage: PurchasesPackage | null;
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
    currentPackage: null,
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

      // 管理者チェック（RevenueCat初期化前にチェック）
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
        // RevenueCat初期化
        await initializeRevenueCat(user.uid);
        await setRevenueCatUserId(user.uid);

        // 現在のパッケージを取得
        const pkg = await getCurrentPackage();

        // プレミアム状態を確認
        const premium = await isPremiumActive();

        setState({
          isInitialized: true,
          isLoading: false,
          isPremium: premium || hasPremiumAccess(user),
          currentPackage: pkg,
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
  }, [user?.uid, user?.isAdmin]);

  // 状態を更新
  const refresh = useCallback(async () => {
    if (!user || user.isAdmin) {
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const customerInfo = await getCustomerInfo();
      const premium = await isPremiumActive();

      // Firestoreを更新
      if (customerInfo) {
        const subscription = customerInfoToUserSubscription(customerInfo);
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
    if (!state.currentPackage) {
      setState((prev) => ({
        ...prev,
        error: new Error('No package available'),
      }));
      return false;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const customerInfo = await purchasePackage(state.currentPackage);

      if (!customerInfo) {
        // ユーザーがキャンセル
        setState((prev) => ({ ...prev, isLoading: false }));
        return false;
      }

      // Firestoreを更新
      if (user) {
        const subscription = customerInfoToUserSubscription(customerInfo);
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
  }, [state.currentPackage, user]);

  // 復元
  const restore = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const customerInfo = await restorePurchases();

      if (!customerInfo) {
        setState((prev) => ({ ...prev, isLoading: false }));
        return false;
      }

      const premium = !!customerInfo.entitlements.active['premium'];

      // Firestoreを更新
      if (user && premium) {
        const subscription = customerInfoToUserSubscription(customerInfo);
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
    if (state.currentPackage) {
      return formatPrice(state.currentPackage);
    }
    return '¥300/月';
  }, [state.currentPackage]);

  return {
    ...state,
    purchase,
    restore,
    openManagement,
    refresh,
    getPrice,
  };
}
