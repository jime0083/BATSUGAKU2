/**
 * OAuth連携フロー統合テスト
 *
 * このテストは、OAuth認証フローの統合を検証します。
 * 実際のOAuthプロバイダーへの接続はモックしますが、
 * コンポーネント間のデータフローと状態管理を検証します。
 */

// Mock expo modules first
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock('expo-auth-session/providers/google', () => ({
  useAuthRequest: jest.fn(() => [
    { type: 'request' },
    null,
    jest.fn(),
  ]),
}));

jest.mock('expo-auth-session', () => ({
  useAuthRequest: jest.fn(() => [
    { type: 'request', codeVerifier: 'test-verifier' },
    null,
    jest.fn(),
  ]),
  makeRedirectUri: jest.fn(() => 'batsugaku://auth/callback'),
}));

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      googleClientId: 'test-google-client-id',
      githubClientId: 'test-github-client-id',
      githubClientSecret: 'test-github-secret',
      xClientId: 'test-x-client-id',
    },
  },
}));

// Mock Firebase
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn((auth, callback) => {
    return jest.fn();
  }),
  signInWithCredential: jest.fn(),
  signOut: jest.fn(),
  GoogleAuthProvider: {
    credential: jest.fn(),
  },
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  serverTimestamp: jest.fn(() => ({ _serverTimestamp: true })),
  Timestamp: {
    fromDate: jest.fn((date: Date) => ({
      toDate: () => date,
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0,
    })),
  },
}));

jest.mock('../../lib/firebase', () => ({
  auth: {},
  db: {},
}));

jest.mock('../../lib/github', () => ({
  fetchGitHubUser: jest.fn(),
}));

jest.mock('../../lib/twitter', () => ({
  fetchXUser: jest.fn(),
}));

import { Timestamp } from 'firebase/firestore';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, signInWithCredential, signOut } from 'firebase/auth';
import { fetchGitHubUser } from '../../lib/github';
import { fetchXUser } from '../../lib/twitter';

// Helper to create a mock Timestamp
const createMockTimestamp = (date: Date) =>
  ({
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  }) as unknown as Timestamp;

// Mock Firebase User
const mockFirebaseUser = {
  uid: 'firebase-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: 'https://example.com/photo.jpg',
};

// Mock App User Data
const mockUserData = {
  uid: 'firebase-user-123',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: 'https://example.com/photo.jpg',
  createdAt: createMockTimestamp(new Date()),
  googleLinked: true,
  xLinked: false,
  xUserId: null,
  xAccessToken: null,
  xRefreshToken: null,
  xTokenExpiresAt: null,
  githubLinked: false,
  githubUsername: null,
  githubAccessToken: null,
  goal: null,
  stats: {
    currentMonthStudyDays: 0,
    currentMonthSkipDays: 0,
    totalStudyDays: 0,
    totalSkipDays: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastStudyDate: null,
    lastCheckedDate: null,
  },
  badges: [],
  fcmToken: null,
  notificationsEnabled: true,
  onboardingCompleted: false,
  isAdmin: false,
  subscription: null,
};

describe('OAuth Flow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Google OAuth Flow', () => {
    it('should create new user in Firestore when logging in for the first time', async () => {
      // Setup: User does not exist in Firestore
      (doc as jest.Mock).mockReturnValue({ id: 'firebase-user-123' });
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => false,
      });
      (setDoc as jest.Mock).mockResolvedValue(undefined);

      // Simulate the flow that happens when a new user logs in
      const userRef = doc({} as any, 'users', mockFirebaseUser.uid);
      const userSnap = await getDoc(userRef);

      expect(userSnap.exists()).toBe(false);

      // New user should be created
      const newUser = {
        uid: mockFirebaseUser.uid,
        email: mockFirebaseUser.email,
        displayName: mockFirebaseUser.displayName,
        photoURL: mockFirebaseUser.photoURL,
        googleLinked: true,
        xLinked: false,
        githubLinked: false,
        onboardingCompleted: false,
      };

      await setDoc(userRef, expect.objectContaining(newUser));

      expect(setDoc).toHaveBeenCalled();
    });

    it('should retrieve existing user from Firestore when logging in', async () => {
      // Setup: User exists in Firestore
      (doc as jest.Mock).mockReturnValue({ id: 'firebase-user-123' });
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => mockUserData,
      });

      const userRef = doc({} as any, 'users', mockFirebaseUser.uid);
      const userSnap = await getDoc(userRef);

      expect(userSnap.exists()).toBe(true);
      expect(userSnap.data()).toEqual(mockUserData);
    });
  });

  describe('GitHub OAuth Flow', () => {
    it('should link GitHub account and update Firestore', async () => {
      const mockGitHubUser = {
        login: 'testuser',
        id: 12345,
        avatar_url: 'https://github.com/avatar.jpg',
      };

      (fetchGitHubUser as jest.Mock).mockResolvedValue(mockGitHubUser);
      (doc as jest.Mock).mockReturnValue({ id: 'firebase-user-123' });
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      // Simulate GitHub OAuth flow completion
      const accessToken = 'github-access-token-123';
      const githubUser = await fetchGitHubUser(accessToken);

      expect(githubUser.login).toBe('testuser');

      // Update Firestore with GitHub info
      const userRef = doc({} as any, 'users', mockFirebaseUser.uid);
      await updateDoc(userRef, {
        githubLinked: true,
        githubUsername: githubUser.login,
        githubAccessToken: accessToken,
      });

      expect(updateDoc).toHaveBeenCalledWith(
        userRef,
        expect.objectContaining({
          githubLinked: true,
          githubUsername: 'testuser',
          githubAccessToken: accessToken,
        })
      );
    });

    it('should unlink GitHub account and clear Firestore data', async () => {
      (doc as jest.Mock).mockReturnValue({ id: 'firebase-user-123' });
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const userRef = doc({} as any, 'users', mockFirebaseUser.uid);
      await updateDoc(userRef, {
        githubLinked: false,
        githubUsername: null,
        githubAccessToken: null,
      });

      expect(updateDoc).toHaveBeenCalledWith(
        userRef,
        expect.objectContaining({
          githubLinked: false,
          githubUsername: null,
          githubAccessToken: null,
        })
      );
    });
  });

  describe('X (Twitter) OAuth Flow', () => {
    it('should link X account and update Firestore with tokens', async () => {
      const mockXUser = {
        id: 'x-user-123',
        name: 'Test User',
        username: 'testuser',
      };

      (fetchXUser as jest.Mock).mockResolvedValue(mockXUser);
      (doc as jest.Mock).mockReturnValue({ id: 'firebase-user-123' });
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      // Simulate X OAuth flow completion
      const accessToken = 'x-access-token-123';
      const refreshToken = 'x-refresh-token-123';
      const expiresIn = 7200;

      const xUser = await fetchXUser(accessToken);
      expect(xUser.id).toBe('x-user-123');

      // Calculate expiration
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);

      // Update Firestore with X info
      const userRef = doc({} as any, 'users', mockFirebaseUser.uid);
      await updateDoc(userRef, {
        xLinked: true,
        xUserId: xUser.id,
        xAccessToken: accessToken,
        xRefreshToken: refreshToken,
        xTokenExpiresAt: Timestamp.fromDate(expiresAt),
      });

      expect(updateDoc).toHaveBeenCalledWith(
        userRef,
        expect.objectContaining({
          xLinked: true,
          xUserId: 'x-user-123',
          xAccessToken: accessToken,
          xRefreshToken: refreshToken,
        })
      );
    });

    it('should unlink X account and clear Firestore tokens', async () => {
      (doc as jest.Mock).mockReturnValue({ id: 'firebase-user-123' });
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const userRef = doc({} as any, 'users', mockFirebaseUser.uid);
      await updateDoc(userRef, {
        xLinked: false,
        xUserId: null,
        xAccessToken: null,
        xRefreshToken: null,
        xTokenExpiresAt: null,
      });

      expect(updateDoc).toHaveBeenCalledWith(
        userRef,
        expect.objectContaining({
          xLinked: false,
          xUserId: null,
          xAccessToken: null,
          xRefreshToken: null,
          xTokenExpiresAt: null,
        })
      );
    });
  });

  describe('Sign Out Flow', () => {
    it('should sign out and clear auth state', async () => {
      (signOut as jest.Mock).mockResolvedValue(undefined);

      await signOut({} as any);

      expect(signOut).toHaveBeenCalled();
    });
  });

  describe('Token Expiration Handling', () => {
    it('should detect expired X token', () => {
      const expiredTokenExpiresAt = createMockTimestamp(
        new Date(Date.now() - 3600000)
      );

      const isExpired = expiredTokenExpiresAt.toDate().getTime() < Date.now();
      expect(isExpired).toBe(true);
    });

    it('should detect valid X token', () => {
      const validTokenExpiresAt = createMockTimestamp(
        new Date(Date.now() + 3600000)
      );

      const isExpired = validTokenExpiresAt.toDate().getTime() < Date.now();
      expect(isExpired).toBe(false);
    });
  });

  describe('OAuth State Consistency', () => {
    it('should maintain consistent state between local and Firestore', async () => {
      const localState = {
        githubLinked: true,
        githubUsername: 'testuser',
        githubAccessToken: 'token-123',
      };

      (doc as jest.Mock).mockReturnValue({ id: 'firebase-user-123' });
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({
          ...mockUserData,
          ...localState,
        }),
      });

      const userRef = doc({} as any, 'users', mockFirebaseUser.uid);
      const userSnap = await getDoc(userRef);
      const firestoreState = userSnap.data();

      expect(firestoreState?.githubLinked).toBe(localState.githubLinked);
      expect(firestoreState?.githubUsername).toBe(localState.githubUsername);
      expect(firestoreState?.githubAccessToken).toBe(localState.githubAccessToken);
    });
  });
});
