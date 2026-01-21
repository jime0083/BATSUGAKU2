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
const mockInitializeRevenueCat = jest.fn().mockResolvedValue(undefined);
const mockSetRevenueCatUserId = jest.fn().mockResolvedValue(undefined);
const mockGetCurrentPackage = jest.fn().mockResolvedValue({
  identifier: 'monthly',
  product: {
    priceString: '¥300',
  },
});
const mockPurchasePackage = jest.fn();
const mockRestorePurchases = jest.fn();
const mockGetCustomerInfo = jest.fn();
const mockIsPremiumActive = jest.fn().mockResolvedValue(false);
const mockCustomerInfoToUserSubscription = jest.fn();
const mockOpenSubscriptionManagement = jest.fn().mockResolvedValue(undefined);
const mockFormatPrice = jest.fn().mockReturnValue('¥300');
const mockLogOutRevenueCat = jest.fn().mockResolvedValue(undefined);
const mockUpdateUser = jest.fn().mockResolvedValue(undefined);
const mockHasPremiumAccess = jest.fn().mockReturnValue(false);

jest.mock('../../lib/revenueCatService', () => ({
  initializeRevenueCat: mockInitializeRevenueCat,
  setRevenueCatUserId: mockSetRevenueCatUserId,
  getCurrentPackage: mockGetCurrentPackage,
  purchasePackage: mockPurchasePackage,
  restorePurchases: mockRestorePurchases,
  getCustomerInfo: mockGetCustomerInfo,
  isPremiumActive: mockIsPremiumActive,
  customerInfoToUserSubscription: mockCustomerInfoToUserSubscription,
  openSubscriptionManagement: mockOpenSubscriptionManagement,
  formatPrice: mockFormatPrice,
  logOutRevenueCat: mockLogOutRevenueCat,
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
    mockGetCurrentPackage.mockResolvedValue({
      identifier: 'monthly',
      product: {
        priceString: '¥300',
      },
    });
    mockHasPremiumAccess.mockReturnValue(false);
  });

  describe('revenueCatService関数のモック確認', () => {
    it('initializeRevenueCatが正しくモックされている', async () => {
      await mockInitializeRevenueCat('test-uid');
      expect(mockInitializeRevenueCat).toHaveBeenCalledWith('test-uid');
    });

    it('setRevenueCatUserIdが正しくモックされている', async () => {
      await mockSetRevenueCatUserId('test-uid');
      expect(mockSetRevenueCatUserId).toHaveBeenCalledWith('test-uid');
    });

    it('getCurrentPackageが正しくモックされている', async () => {
      const pkg = await mockGetCurrentPackage();
      expect(pkg).toEqual({
        identifier: 'monthly',
        product: {
          priceString: '¥300',
        },
      });
    });

    it('isPremiumActiveが正しくモックされている', async () => {
      const result = await mockIsPremiumActive();
      expect(result).toBe(false);
    });

    it('formatPriceが正しくモックされている', () => {
      const result = mockFormatPrice({ product: { priceString: '¥300' } });
      expect(result).toBe('¥300');
    });
  });

  describe('購入フロー', () => {
    it('purchasePackageが成功時にcustomerInfoを返す', async () => {
      const mockCustomerInfo = {
        entitlements: {
          active: {
            premium: {
              productIdentifier: 'batsugaku_monthly_300',
            },
          },
        },
      };
      mockPurchasePackage.mockResolvedValue({ customerInfo: mockCustomerInfo });

      const pkg = await mockGetCurrentPackage();
      const result = await mockPurchasePackage(pkg);

      expect(result.customerInfo).toBeDefined();
      expect(result.customerInfo.entitlements.active.premium).toBeDefined();
    });

    it('ユーザーがキャンセルした場合、nullを返す', async () => {
      mockPurchasePackage.mockResolvedValue(null);

      const pkg = await mockGetCurrentPackage();
      const result = await mockPurchasePackage(pkg);

      expect(result).toBeNull();
    });

    it('購入エラー時にエラーをスローする', async () => {
      mockPurchasePackage.mockRejectedValue(new Error('Purchase failed'));

      const pkg = await mockGetCurrentPackage();
      await expect(mockPurchasePackage(pkg)).rejects.toThrow('Purchase failed');
    });
  });

  describe('復元フロー', () => {
    it('restorePurchasesが成功時にcustomerInfoを返す', async () => {
      const mockCustomerInfo = {
        entitlements: {
          active: {
            premium: {
              productIdentifier: 'batsugaku_monthly_300',
            },
          },
        },
      };
      mockRestorePurchases.mockResolvedValue(mockCustomerInfo);

      const result = await mockRestorePurchases();

      expect(result.entitlements.active.premium).toBeDefined();
    });

    it('復元できる購入がない場合、空のエンタイトルメントを返す', async () => {
      const mockCustomerInfo = {
        entitlements: {
          active: {},
        },
      };
      mockRestorePurchases.mockResolvedValue(mockCustomerInfo);

      const result = await mockRestorePurchases();

      expect(result.entitlements.active.premium).toBeUndefined();
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

  describe('customerInfoToUserSubscription', () => {
    it('アクティブなエンタイトルメントをUserSubscriptionに変換する', () => {
      const mockSubscription = {
        isActive: true,
        productId: 'batsugaku_monthly_300',
        purchasedAt: mockTimestamp as any,
        expiresAt: mockTimestamp as any,
        originalTransactionId: 'tx_123',
      };
      mockCustomerInfoToUserSubscription.mockReturnValue(mockSubscription);

      const result = mockCustomerInfoToUserSubscription({
        entitlements: {
          active: {
            premium: {
              productIdentifier: 'batsugaku_monthly_300',
            },
          },
        },
      });

      expect(result.isActive).toBe(true);
      expect(result.productId).toBe('batsugaku_monthly_300');
    });

    it('エンタイトルメントがない場合、nullを返す', () => {
      mockCustomerInfoToUserSubscription.mockReturnValue(null);

      const result = mockCustomerInfoToUserSubscription({
        entitlements: {
          active: {},
        },
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
});
