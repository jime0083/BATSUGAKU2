# Batsugaku (罰学) - プロジェクトガイド

## コンセプト
プログラマー向け「罰ゲーム学習」アプリ
- 毎日GitHubにpushしないと「サボりツイート」を投稿
- ストリーク追跡とバッジシステム

## アプリフロー
```
Googleログイン → X/GitHub連携 → サブスク購入(月額300円) → オンボーディング → メイン画面
```
- X/GitHub連携完了までサブスク画面に進めない
- サブスク購入までメイン機能にアクセス不可
- 全UI日本語

## 技術スタック
- React Native (Expo SDK 54) + Expo Router v6
- Firebase (Auth, Firestore)
- 認証: Google OAuth, X OAuth 2.0 PKCE, GitHub OAuth

## ディレクトリ
```
app/           # Expo Router (auth, main, onboarding)
src/lib/       # ユーティリティ (github.ts, twitter.ts, dailyCheck.ts等)
src/hooks/     # カスタムフック
src/contexts/  # AuthContext
functions/     # Cloud Functions
```

## iOS実機ビルド
```bash
npx expo prebuild --platform ios --clean
open ios/batsugaku.xcworkspace
```
Xcodeで: Product → Scheme → Edit Scheme → **Release**設定必須

## 進捗管理
- 現在の進捗: `progress.txt`
- 完了済み詳細: `progress-archive.txt`
