import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithCredential,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { auth, db } from '../lib/firebase';
import { User, AuthContextType } from '../types';
import { fetchGitHubUser } from '../lib/github';
import { fetchXUser } from '../lib/twitter';
import { Timestamp } from 'firebase/firestore';
import Constants from 'expo-constants';

// WebBrowserの結果を完了させる
WebBrowser.maybeCompleteAuthSession();

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Google OAuth設定
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: Constants.expoConfig?.extra?.googleClientId || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    iosClientId: Constants.expoConfig?.extra?.googleIosClientId || process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: Constants.expoConfig?.extra?.googleAndroidClientId || process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: Constants.expoConfig?.extra?.googleWebClientId || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  // GitHub OAuth設定
  const githubClientId = Constants.expoConfig?.extra?.githubClientId || process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID || '';
  const githubClientSecret = Constants.expoConfig?.extra?.githubClientSecret || process.env.EXPO_PUBLIC_GITHUB_CLIENT_SECRET || '';

  const githubDiscovery = {
    authorizationEndpoint: 'https://github.com/login/oauth/authorize',
    tokenEndpoint: 'https://github.com/login/oauth/access_token',
    revocationEndpoint: `https://github.com/settings/connections/applications/${githubClientId}`,
  };

  const [githubRequest, githubResponse, githubPromptAsync] = AuthSession.useAuthRequest(
    {
      clientId: githubClientId,
      scopes: ['read:user', 'repo'],
      redirectUri: AuthSession.makeRedirectUri({
        scheme: 'batsugaku',
        path: 'auth/github',
      }),
    },
    githubDiscovery
  );

  // X (Twitter) OAuth 2.0 PKCE設定
  const xClientId = Constants.expoConfig?.extra?.xClientId || process.env.EXPO_PUBLIC_X_CLIENT_ID || '';

  const xDiscovery = {
    authorizationEndpoint: 'https://twitter.com/i/oauth2/authorize',
    tokenEndpoint: 'https://api.twitter.com/2/oauth2/token',
    revocationEndpoint: 'https://api.twitter.com/2/oauth2/revoke',
  };

  const [xRequest, xResponse, xPromptAsync] = AuthSession.useAuthRequest(
    {
      clientId: xClientId,
      scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
      redirectUri: AuthSession.makeRedirectUri({
        scheme: 'batsugaku',
        path: 'auth/twitter',
      }),
      usePKCE: true,
    },
    xDiscovery
  );

  // Firebase Auth状態の監視
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Firestoreからユーザーデータを取得
        const userData = await fetchUserData(firebaseUser);
        setUser(userData);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Google認証レスポンスの処理
  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential).catch((error) => {
        console.error('Google sign in error:', error);
      });
    }
  }, [response]);

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
    };

    await setDoc(userRef, newUser);
    return newUser;
  };

  // Googleログイン
  const signInWithGoogle = async () => {
    try {
      await promptAsync();
    } catch (error) {
      console.error('Google sign in error:', error);
      throw error;
    }
  };

  // ログアウト
  const signOut = async () => {
    try {
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

  const value: AuthContextType = {
    user,
    loading,
    signInWithGoogle,
    signOut,
    linkXAccount,
    linkGitHubAccount,
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
