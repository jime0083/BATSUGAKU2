import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithCredential,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import {
  GoogleSignin,
  statusCodes,
  isErrorWithCode,
} from '@react-native-google-signin/google-signin';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { auth, db } from '../lib/firebase';
import { User, AuthContextType } from '../types';
import { fetchGitHubUser } from '../lib/github';
import { fetchXUser } from '../lib/twitter';
import { Timestamp } from 'firebase/firestore';

// WebBrowserの結果を完了させる
WebBrowser.maybeCompleteAuthSession();

// Google Sign-Inの設定
GoogleSignin.configure({
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // GitHub OAuth設定
  const githubClientId = process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID || '';
  const githubClientSecret = process.env.EXPO_PUBLIC_GITHUB_CLIENT_SECRET || '';

  const githubDiscovery = {
    authorizationEndpoint: 'https://github.com/login/oauth/authorize',
    tokenEndpoint: 'https://github.com/login/oauth/access_token',
    revocationEndpoint: `https://github.com/settings/connections/applications/${githubClientId}`,
  };

  // GitHub用リダイレクトURI
  const githubRedirectUri = AuthSession.makeRedirectUri({
    scheme: 'batsugaku',
    path: 'auth/github',
  });
  console.log('=== GitHub Redirect URI ===', githubRedirectUri);

  const [githubRequest, githubResponse, githubPromptAsync] = AuthSession.useAuthRequest(
    {
      clientId: githubClientId,
      scopes: ['read:user', 'repo'],
      redirectUri: githubRedirectUri,
    },
    githubDiscovery
  );

  // X (Twitter) OAuth 2.0 PKCE設定
  const xClientId = process.env.EXPO_PUBLIC_X_CLIENT_ID || '';

  const xDiscovery = {
    authorizationEndpoint: 'https://twitter.com/i/oauth2/authorize',
    tokenEndpoint: 'https://api.twitter.com/2/oauth2/token',
    revocationEndpoint: 'https://api.twitter.com/2/oauth2/revoke',
  };

  // X用リダイレクトURI
  const xRedirectUri = AuthSession.makeRedirectUri({
    scheme: 'batsugaku',
    path: 'auth/twitter',
  });
  console.log('=== X Redirect URI ===', xRedirectUri);

  const [xRequest, xResponse, xPromptAsync] = AuthSession.useAuthRequest(
    {
      clientId: xClientId,
      scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
      redirectUri: xRedirectUri,
      usePKCE: true,
    },
    xDiscovery
  );

  // Firebase Auth状態の監視
  useEffect(() => {
    console.log('=== Setting up onAuthStateChanged listener ===');
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('=== onAuthStateChanged triggered ===');
      console.log('Firebase user:', firebaseUser ? firebaseUser.uid : 'null');

      if (firebaseUser) {
        try {
          // Firestoreからユーザーデータを取得
          console.log('Fetching user data from Firestore...');
          const userData = await fetchUserData(firebaseUser);
          console.log('User data fetched:', JSON.stringify(userData, null, 2));
          console.log('Setting user state...');
          setUser(userData);
          console.log('User state set successfully');
        } catch (error) {
          console.error('Error fetching user data:', error);
          setUser(null);
        }
      } else {
        console.log('No Firebase user, setting user to null');
        setUser(null);
      }
      console.log('Setting loading to false');
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // GitHub認証レスポンスの処理
  useEffect(() => {
    const handleGitHubResponse = async () => {
      if (githubResponse?.type === 'success' && user) {
        const { code } = githubResponse.params;

        try {
          // アクセストークンを取得
          const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              client_id: githubClientId,
              client_secret: githubClientSecret,
              code,
            }),
          });

          const tokenData = await tokenResponse.json();

          if (tokenData.access_token) {
            // GitHubユーザー情報を取得
            const githubUser = await fetchGitHubUser(tokenData.access_token);

            // Firestoreを更新
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
              githubLinked: true,
              githubUsername: githubUser.login,
              githubAccessToken: tokenData.access_token,
            });

            // ローカル状態を更新
            setUser({
              ...user,
              githubLinked: true,
              githubUsername: githubUser.login,
              githubAccessToken: tokenData.access_token,
            });
          }
        } catch (error) {
          console.error('GitHub token exchange error:', error);
          throw error;
        }
      }
    };

    handleGitHubResponse();
  }, [githubResponse, user, githubClientId, githubClientSecret]);

  // X認証レスポンスの処理
  useEffect(() => {
    const handleXResponse = async () => {
      if (xResponse?.type === 'success' && user && xRequest?.codeVerifier) {
        const { code } = xResponse.params;

        try {
          // PKCEを使用してアクセストークンを取得
          const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: AuthSession.makeRedirectUri({
              scheme: 'batsugaku',
              path: 'auth/twitter',
            }),
            client_id: xClientId,
            code_verifier: xRequest.codeVerifier,
          });

          const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
          });

          const tokenData = await tokenResponse.json();

          if (tokenData.access_token) {
            // Xユーザー情報を取得
            const xUser = await fetchXUser(tokenData.access_token);

            // 有効期限を計算
            const expiresAt = new Date();
            expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

            // Firestoreを更新
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
              xLinked: true,
              xUserId: xUser.id,
              xAccessToken: tokenData.access_token,
              xRefreshToken: tokenData.refresh_token,
              xTokenExpiresAt: Timestamp.fromDate(expiresAt),
            });

            // ローカル状態を更新
            setUser({
              ...user,
              xLinked: true,
              xUserId: xUser.id,
              xAccessToken: tokenData.access_token,
              xRefreshToken: tokenData.refresh_token,
              xTokenExpiresAt: Timestamp.fromDate(expiresAt) as any,
            });
          }
        } catch (error) {
          console.error('X token exchange error:', error);
          throw error;
        }
      }
    };

    handleXResponse();
  }, [xResponse, user, xClientId, xRequest?.codeVerifier]);

  // Firestoreからユーザーデータを取得または作成
  const fetchUserData = async (firebaseUser: FirebaseUser): Promise<User> => {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      return userSnap.data() as User;
    }

    // 新規ユーザーの場合、初期データを作成
    const newUser: User = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || '',
      photoURL: firebaseUser.photoURL,
      createdAt: serverTimestamp() as any,
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
      goalTweetPosted: false,
      postedTotalDaysMilestones: [],
      postedStreakMilestones: [],
      isAdmin: false,
      subscription: null,
    };

    await setDoc(userRef, newUser);
    return newUser;
  };

  // Googleログイン
  const signInWithGoogle = async () => {
    try {
      console.log('=== Google Sign-In Start ===');
      console.log('iOS Client ID:', process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);
      console.log('Web Client ID:', process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);

      // Googleサインイン
      console.log('Calling GoogleSignin.signIn()...');
      const signInResult = await GoogleSignin.signIn();
      console.log('Google Sign-In result:', JSON.stringify(signInResult, null, 2));

      // IDトークンを取得
      const idToken = signInResult.data?.idToken;
      if (!idToken) {
        console.error('No ID token in result:', signInResult);
        throw new Error('IDトークンが取得できませんでした');
      }

      console.log('Got ID token (first 50 chars):', idToken.substring(0, 50) + '...');

      // Firebase認証情報を作成
      console.log('Creating Firebase credential...');
      const credential = GoogleAuthProvider.credential(idToken);

      // Firebaseでサインイン
      console.log('Signing in to Firebase...');
      const firebaseResult = await signInWithCredential(auth, credential);
      console.log('=== Firebase sign-in successful ===');
      console.log('User UID:', firebaseResult.user.uid);
      console.log('User Email:', firebaseResult.user.email);
    } catch (error: any) {
      console.error('=== Google Sign-In Error ===');
      console.error('Error type:', typeof error);
      console.error('Error name:', error?.name);
      console.error('Error code:', error?.code);
      console.error('Error message:', error?.message);
      console.error('Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));

      if (isErrorWithCode(error)) {
        console.error('Error has code:', error.code);
        switch (error.code) {
          case statusCodes.SIGN_IN_CANCELLED:
            throw new Error('ログインがキャンセルされました');
          case statusCodes.IN_PROGRESS:
            throw new Error('ログイン処理中です');
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            throw new Error('Google Play Servicesが利用できません');
          default:
            throw new Error(`ログインエラー: ${error.message || error.code}`);
        }
      }

      // Firebaseエラーの場合
      const errorMessage = error instanceof Error ? error.message : 'ログインに失敗しました';
      console.error('Throwing error with message:', errorMessage);
      throw new Error(errorMessage);
    }
  };

  // ログアウト
  const signOut = async () => {
    try {
      // Googleからもサインアウト
      await GoogleSignin.signOut();
      await firebaseSignOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  // X (Twitter) アカウント連携
  const linkXAccount = useCallback(async () => {
    if (!xRequest) {
      throw new Error('X OAuth request not ready');
    }
    try {
      await xPromptAsync();
    } catch (error) {
      console.error('X OAuth error:', error);
      throw error;
    }
  }, [xRequest, xPromptAsync]);

  // GitHub アカウント連携
  const linkGitHubAccount = useCallback(async () => {
    if (!githubRequest) {
      throw new Error('GitHub OAuth request not ready');
    }
    try {
      await githubPromptAsync();
    } catch (error) {
      console.error('GitHub OAuth error:', error);
      throw error;
    }
  }, [githubRequest, githubPromptAsync]);

  // X (Twitter) アカウント連携解除
  const unlinkXAccount = useCallback(async () => {
    if (!user) {
      throw new Error('User not logged in');
    }

    try {
      // Firestoreを更新
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        xLinked: false,
        xUserId: null,
        xAccessToken: null,
        xRefreshToken: null,
        xTokenExpiresAt: null,
      });

      // ローカル状態を更新
      setUser({
        ...user,
        xLinked: false,
        xUserId: null,
        xAccessToken: null,
        xRefreshToken: null,
        xTokenExpiresAt: null,
      });
    } catch (error) {
      console.error('X unlink error:', error);
      throw error;
    }
  }, [user]);

  // GitHub アカウント連携解除
  const unlinkGitHubAccount = useCallback(async () => {
    if (!user) {
      throw new Error('User not logged in');
    }

    try {
      // Firestoreを更新
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        githubLinked: false,
        githubUsername: null,
        githubAccessToken: null,
      });

      // ローカル状態を更新
      setUser({
        ...user,
        githubLinked: false,
        githubUsername: null,
        githubAccessToken: null,
      });
    } catch (error) {
      console.error('GitHub unlink error:', error);
      throw error;
    }
  }, [user]);

  // ローカルユーザー状態を更新
  const updateUser = useCallback((updates: Partial<User>) => {
    if (!user) return;
    setUser({
      ...user,
      ...updates,
    });
  }, [user]);

  const value: AuthContextType = {
    user,
    loading,
    signInWithGoogle,
    signOut,
    linkXAccount,
    linkGitHubAccount,
    unlinkXAccount,
    unlinkGitHubAccount,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
