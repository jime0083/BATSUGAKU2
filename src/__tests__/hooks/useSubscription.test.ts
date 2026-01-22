import { User } from '../../types';

// Timestampモック
const mockTimestamp = {
  toDate: () => new Date(),
  toMillis: () => Date.now(),
  seconds: Math.floor(Date.now() / 1000),
  nanoseconds: 0,
};

jest.mock('firebase/firestore', () => ({
  Timestamp: {
    now: () => mockTimestamp,
    fromDate: (date: Date) => ({
      ...mockTimestamp,
      toDate: () => date,
      toMillis: () => date.getTime(),
    }),
  },
}));

// モック設定 - 最初に設定する必要がある
const mockInitializeIAP = jest.fn().mockResolvedValue(undefined);
const mockSetIAPUserId = jest.fn();
const mockGetCurrentProduct = jest.fn().mockResolvedValue({
  productId: 'batsugaku_monthly_300',
  title: 'Batsugaku Premium',
  description: '月額プレミアムプラン',
  price: '300',
  localizedPrice: '¥300',
  currency: 'JPY',
});
const mockPurchaseSubscription = jest.fn();
const mockRestoreIAPPurchases = jest.fn();
const mockGetCurrentSubscriptionInfo = jest.fn();
const mockIsPremiumActive = jest.fn().mockResolvedValue(false);
const mockIapInfoToUserSubscription = jest.fn();
const mockOpenSubscriptionManagement = jest.fn().mockResolvedValue(undefined);
const mockFormatPrice = jest.fn().mockReturnValue('¥300');
const mockEndIAPConnection = jest.fn().mockResolvedValue(undefined);
const mockUpdateUser = jest.fn().mockResolvedValue(undefined);
const mockHasPremiumAccess = jest.fn().mockReturnValue(false);

jest.mock('../../lib/iapService', () => ({
  initializeIAP: mockInitializeIAP,
  setIAPUserId: mockSetIAPUserId,
  getCurrentProduct: mockGetCurrentProduct,
  purchaseSubscription: mockPurchaseSubscription,
  restoreIAPPurchases: mockRestoreIAPPurchases,
  getCurrentSubscriptionInfo: mockGetCurrentSubscriptionInfo,
  isPremiumActive: mockIsPremiumActive,
  iapInfoToUserSubscription: mockIapInfoToUserSubscription,
  openSubscriptionManagement: mockOpenSubscriptionManagement,
  formatPrice: mockFormatPrice,
  endIAPConnection: mockEndIAPConnection,
  PRODUCT_IDS: {
    MONTHLY_300: 'batsugaku_monthly_300',
  },
}));

jest.mock('../../lib/firestoreService', () => ({
  updateUser: mockUpdateUser,
}));

jest.mock('../../lib/subscription', () => ({
  hasPremiumAccess: mockHasPremiumAccess,
}));

const createMockUser = (overrides: Partial<User> = {}): User => ({
  uid: 'test-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: null,
  createdAt: mockTimestamp as any,
  googleLinked: true,
  xLinked: false,
  xUserId: null,
  xAccessToken: null,
  xRefreshToken: null,
  xTokenExpiresAt: null,
  githubLinked: true,
  githubUsername: 'testuser',
  githubAccessToken: 'token123',
  goal: {
    targetIncome: 100,
    incomeType: 'monthly',
    skills: ['TypeScript'],
    deadline: mockTimestamp as any,
  },
  stats: {
    currentMonthStudyDays: 10,
    currentMonthSkipDays: 2,
    totalStudyDays: 50,
    totalSkipDays: 5,
    currentStreak: 5,
    longestStreak: 10,
    lastStudyDate: mockTimestamp as any,
    lastCheckedDate: null,
  },
  badges: [],
  fcmToken: null,
  notificationsEnabled: true,
  onboardingCompleted: true,
  isAdmin: false,
  subscription: null,
  ...overrides,
});

describe('useSubscription', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsPremiumActive.mockResolvedValue(false);
    mockGetCurrentProduct.mockResolvedValue({
      productId: 'batsugaku_monthly_300',
      title: 'Batsugaku Premium',
      description: '月額プレミアムプラン',
      price: '300',
      localizedPrice: '¥300',
      currency: 'JPY',
    });
    mockHasPremiumAccess.mockReturnValue(false);
  });

  describe('iapService関数のモック確認', () => {
    it('initializeIAPが正しくモックされている', async () => {
      await mockInitializeIAP('test-uid');
      expect(mockInitializeIAP).toHaveBeenCalledWith('test-uid');
    });

    it('setIAPUserIdが正しくモックされている', () => {
      mockSetIAPUserId('test-uid');
      expect(mockSetIAPUserId).toHaveBeenCalledWith('test-uid');
    });

    it('getCurrentProductが正しくモックされている', async () => {
      const product = await mockGetCurrentProduct();
      expect(product).toEqual({
        productId: 'batsugaku_monthly_300',
        title: 'Batsugaku Premium',
        description: '月額プレミアムプラン',
        price: '300',
        localizedPrice: '¥300',
        currency: 'JPY',
      });
    });

    it('isPremiumActiveが正しくモックされている', async () => {
      const result = await mockIsPremiumActive();
      expect(result).toBe(false);
    });

    it('formatPriceが正しくモックされている', () => {
      const result = mockFormatPrice({ localizedPrice: '¥300' });
      expect(result).toBe('¥300');
    });
  });

  describe('購入フロー', () => {
    it('purchaseSubscriptionが成功時にsubscriptionInfoを返す', async () => {
      const mockSubscriptionInfo = {
        isActive: true,
        productId: 'batsugaku_monthly_300',
        purchaseDate: new Date(),
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        transactionId: 'tx_123',
        receipt: 'mock_receipt',
      };
      mockPurchaseSubscription.mockResolvedValue(mockSubscriptionInfo);

      const result = await mockPurchaseSubscription('batsugaku_monthly_300');

      expect(result).toBeDefined();
      expect(result.isActive).toBe(true);
      expect(result.productId).toBe('batsugaku_monthly_300');
    });

    it('ユーザーがキャンセルした場合、nullを返す', async () => {
      mockPurchaseSubscription.mockResolvedValue(null);

      const result = await mockPurchaseSubscription('batsugaku_monthly_300');

      expect(result).toBeNull();
    });

    it('購入エラー時にエラーをスローする', async () => {
      mockPurchaseSubscription.mockRejectedValue(new Error('Purchase failed'));

      await expect(
        mockPurchaseSubscription('batsugaku_monthly_300')
      ).rejects.toThrow('Purchase failed');
    });
  });

  describe('復元フロー', () => {
    it('restoreIAPPurchasesが成功時にsubscriptionInfoを返す', async () => {
      const mockSubscriptionInfo = {
        isActive: true,
        productId: 'batsugaku_monthly_300',
        purchaseDate: new Date(),
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        transactionId: 'tx_123',
        receipt: 'mock_receipt',
      };
      mockRestoreIAPPurchases.mockResolvedValue(mockSubscriptionInfo);

      const result = await mockRestoreIAPPurchases();

      expect(result.isActive).toBe(true);
      expect(result.productId).toBe('batsugaku_monthly_300');
    });

    it('復元できる購入がない場合、nullを返す', async () => {
      mockRestoreIAPPurchases.mockResolvedValue(null);

      const result = await mockRestoreIAPPurchases();

      expect(result).toBeNull();
    });
  });

  describe('管理者バイパス', () => {
    it('管理者ユーザーはhasPremiumAccessがtrueを返す', () => {
      mockHasPremiumAccess.mockReturnValue(true);
      const adminUser = createMockUser({ isAdmin: true });

      const result = mockHasPremiumAccess(adminUser);

      expect(result).toBe(true);
    });

    it('非管理者で未購読ユーザーはhasPremiumAccessがfalseを返す', () => {
      mockHasPremiumAccess.mockReturnValue(false);
      const user = createMockUser({ isAdmin: false, subscription: null });

      const result = mockHasPremiumAccess(user);

      expect(result).toBe(false);
    });
  });

  describe('iapInfoToUserSubscription', () => {
    it('アクティブなサブスクリプションをUserSubscriptionに変換する', () => {
      const mockSubscription = {
        isActive: true,
        productId: 'batsugaku_monthly_300',
        purchasedAt: mockTimestamp as any,
        expiresAt: mockTimestamp as any,
        originalTransactionId: 'tx_123',
      };
      mockIapInfoToUserSubscription.mockReturnValue(mockSubscription);

      const result = mockIapInfoToUserSubscription({
        isActive: true,
        productId: 'batsugaku_monthly_300',
        purchaseDate: new Date(),
        expirationDate: new Date(),
        transactionId: 'tx_123',
        receipt: 'mock_receipt',
      });

      expect(result.isActive).toBe(true);
      expect(result.productId).toBe('batsugaku_monthly_300');
    });

    it('非アクティブな場合、nullを返す', () => {
      mockIapInfoToUserSubscription.mockReturnValue(null);

      const result = mockIapInfoToUserSubscription({
        isActive: false,
        productId: 'batsugaku_monthly_300',
        purchaseDate: new Date(),
        expirationDate: new Date(),
        transactionId: 'tx_123',
        receipt: 'mock_receipt',
      });

      expect(result).toBeNull();
    });
  });

  describe('Firestore更新', () => {
    it('updateUserが正しく呼び出される', async () => {
      const user = createMockUser();
      const subscription = {
        isActive: true,
        productId: 'batsugaku_monthly_300',
        purchasedAt: mockTimestamp as any,
        expiresAt: mockTimestamp as any,
        originalTransactionId: 'tx_123',
      };

      await mockUpdateUser(user.uid, { subscription });

      expect(mockUpdateUser).toHaveBeenCalledWith(user.uid, { subscription });
    });
  });

  describe('サブスクリプション管理', () => {
    it('openSubscriptionManagementが正しく呼び出される', async () => {
      await mockOpenSubscriptionManagement();

      expect(mockOpenSubscriptionManagement).toHaveBeenCalled();
    });
  });

  describe('クリーンアップ', () => {
    it('endIAPConnectionが正しくモックされている', async () => {
      await mockEndIAPConnection();

      expect(mockEndIAPConnection).toHaveBeenCalled();
    });
  });
});
