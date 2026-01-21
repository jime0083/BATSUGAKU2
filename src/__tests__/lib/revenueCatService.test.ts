import {
  PRODUCT_IDS,
  ENTITLEMENT_IDS,
  customerInfoToUserSubscription,
  formatPrice,
} from '../../lib/revenueCatService';

// モック設定
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    logIn: jest.fn(),
    logOut: jest.fn(),
    getOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    getCustomerInfo: jest.fn(),
    setLogLevel: jest.fn(),
  },
  LOG_LEVEL: {
    DEBUG: 1,
    INFO: 2,
    WARN: 3,
    ERROR: 4,
  },
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        revenueCatApiKey: 'test_api_key',
      },
    },
  },
}));

describe('revenueCatService', () => {
  describe('定数', () => {
    it('PRODUCT_IDSが正しく定義されている', () => {
      expect(PRODUCT_IDS.MONTHLY_300).toBe('batsugaku_monthly_300');
    });

    it('ENTITLEMENT_IDSが正しく定義されている', () => {
      expect(ENTITLEMENT_IDS.PREMIUM).toBe('premium');
    });
  });

  describe('customerInfoToUserSubscription', () => {
    it('アクティブなエンタイトルメントがある場合、UserSubscriptionを返す', () => {
      const mockCustomerInfo = {
        entitlements: {
          active: {
            premium: {
              productIdentifier: 'batsugaku_monthly_300',
              expirationDate: '2026-02-20T00:00:00Z',
              latestPurchaseDate: '2026-01-20T00:00:00Z',
              originalPurchaseDate: 'original_tx_123',
            },
          },
        },
      };

      const result = customerInfoToUserSubscription(mockCustomerInfo as any);

      expect(result).not.toBeNull();
      expect(result!.isActive).toBe(true);
      expect(result!.productId).toBe('batsugaku_monthly_300');
      expect(result!.originalTransactionId).toBe('original_tx_123');
    });

    it('エンタイトルメントがない場合、nullを返す', () => {
      const mockCustomerInfo = {
        entitlements: {
          active: {},
        },
      };

      const result = customerInfoToUserSubscription(mockCustomerInfo as any);

      expect(result).toBeNull();
    });

    it('有効期限がない場合、デフォルトで30日後を設定する', () => {
      const mockCustomerInfo = {
        entitlements: {
          active: {
            premium: {
              productIdentifier: 'batsugaku_monthly_300',
              expirationDate: null,
              latestPurchaseDate: null,
              originalPurchaseDate: '',
            },
          },
        },
      };

      const result = customerInfoToUserSubscription(mockCustomerInfo as any);

      expect(result).not.toBeNull();
      expect(result!.expiresAt).toBeDefined();
      expect(typeof result!.expiresAt.toDate).toBe('function');

      // 30日後（±1日の誤差を許容）
      const expectedDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const actualDate = result!.expiresAt.toDate();
      const diffDays = Math.abs((actualDate.getTime() - expectedDate.getTime()) / (24 * 60 * 60 * 1000));
      expect(diffDays).toBeLessThan(1);
    });
  });

  describe('formatPrice', () => {
    it('パッケージの価格文字列を返す', () => {
      const mockPackage = {
        product: {
          priceString: '¥300',
        },
      };

      const result = formatPrice(mockPackage as any);

      expect(result).toBe('¥300');
    });
  });
});
