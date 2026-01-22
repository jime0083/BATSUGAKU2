import {
  PRODUCT_IDS,
  iapInfoToUserSubscription,
  formatPrice,
  IAPProduct,
  IAPSubscriptionInfo,
} from '../../lib/iapService';

// モック設定
jest.mock('react-native-iap', () => ({
  initConnection: jest.fn().mockResolvedValue(true),
  endConnection: jest.fn().mockResolvedValue(undefined),
  getProducts: jest.fn().mockResolvedValue([]),
  getSubscriptions: jest.fn().mockResolvedValue([]),
  requestSubscription: jest.fn(),
  getAvailablePurchases: jest.fn().mockResolvedValue([]),
  finishTransaction: jest.fn().mockResolvedValue(undefined),
  purchaseUpdatedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  purchaseErrorListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
  Linking: {
    openURL: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('firebase/firestore', () => ({
  Timestamp: {
    now: () => ({
      toDate: () => new Date(),
      toMillis: () => Date.now(),
      seconds: Math.floor(Date.now() / 1000),
      nanoseconds: 0,
    }),
    fromDate: (date: Date) => ({
      toDate: () => date,
      toMillis: () => date.getTime(),
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0,
    }),
  },
}));

describe('iapService', () => {
  describe('定数', () => {
    it('PRODUCT_IDSが正しく定義されている', () => {
      expect(PRODUCT_IDS.MONTHLY_300).toBe('batsugaku_monthly_300');
    });
  });

  describe('iapInfoToUserSubscription', () => {
    it('アクティブなサブスクリプション情報をUserSubscriptionに変換する', () => {
      const mockInfo: IAPSubscriptionInfo = {
        isActive: true,
        productId: 'batsugaku_monthly_300',
        purchaseDate: new Date('2026-01-20T00:00:00Z'),
        expirationDate: new Date('2026-02-20T00:00:00Z'),
        transactionId: 'tx_123',
        receipt: 'mock_receipt',
      };

      const result = iapInfoToUserSubscription(mockInfo);

      expect(result).not.toBeNull();
      expect(result!.isActive).toBe(true);
      expect(result!.productId).toBe('batsugaku_monthly_300');
      expect(result!.originalTransactionId).toBe('tx_123');
    });

    it('isActiveがfalseの場合、nullを返す', () => {
      const mockInfo: IAPSubscriptionInfo = {
        isActive: false,
        productId: 'batsugaku_monthly_300',
        purchaseDate: new Date(),
        expirationDate: new Date(),
        transactionId: 'tx_123',
        receipt: 'mock_receipt',
      };

      const result = iapInfoToUserSubscription(mockInfo);

      expect(result).toBeNull();
    });

    it('有効期限がない場合、デフォルトで30日後を設定する', () => {
      const mockInfo: IAPSubscriptionInfo = {
        isActive: true,
        productId: 'batsugaku_monthly_300',
        purchaseDate: new Date(),
        expirationDate: null,
        transactionId: 'tx_123',
        receipt: 'mock_receipt',
      };

      const result = iapInfoToUserSubscription(mockInfo);

      expect(result).not.toBeNull();
      expect(result!.expiresAt).toBeDefined();
      expect(typeof result!.expiresAt.toDate).toBe('function');

      // 30日後（±1日の誤差を許容）
      const expectedDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const actualDate = result!.expiresAt.toDate();
      const diffDays = Math.abs(
        (actualDate.getTime() - expectedDate.getTime()) / (24 * 60 * 60 * 1000)
      );
      expect(diffDays).toBeLessThan(1);
    });
  });

  describe('formatPrice', () => {
    it('商品のローカライズ価格文字列を返す', () => {
      const mockProduct: IAPProduct = {
        productId: 'batsugaku_monthly_300',
        title: 'Batsugaku Premium',
        description: '月額プレミアムプラン',
        price: '300',
        localizedPrice: '¥300',
        currency: 'JPY',
      };

      const result = formatPrice(mockProduct);

      expect(result).toBe('¥300');
    });
  });

  describe('IAPProduct型', () => {
    it('IAPProductが正しい構造を持つ', () => {
      const product: IAPProduct = {
        productId: 'test_product',
        title: 'Test Product',
        description: 'Test Description',
        price: '100',
        localizedPrice: '$1.00',
        currency: 'USD',
      };

      expect(product.productId).toBeDefined();
      expect(product.title).toBeDefined();
      expect(product.description).toBeDefined();
      expect(product.price).toBeDefined();
      expect(product.localizedPrice).toBeDefined();
      expect(product.currency).toBeDefined();
    });
  });

  describe('IAPSubscriptionInfo型', () => {
    it('IAPSubscriptionInfoが正しい構造を持つ', () => {
      const info: IAPSubscriptionInfo = {
        isActive: true,
        productId: 'test_product',
        purchaseDate: new Date(),
        expirationDate: new Date(),
        transactionId: 'tx_123',
        receipt: 'receipt_data',
      };

      expect(info.isActive).toBeDefined();
      expect(info.productId).toBeDefined();
      expect(info.purchaseDate).toBeDefined();
      expect(info.expirationDate).toBeDefined();
      expect(info.transactionId).toBeDefined();
      expect(info.receipt).toBeDefined();
    });
  });
});
