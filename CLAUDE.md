# Batsugaku (罰学) - プロジェクトガイド

## 重要: cogsec設定使用ルール

**開発を始める前に必ず「cogsecの設定使用」と宣言すること**

このルールは、Everything Claude Code (cogsec) の設定を確実に使用して開発を進めるために義務付けられています。
設定を使用せずに開発を進めることは禁止されています。

## 重要: 実装前の確認ルール

**機能実装前に必ず仕様を確認し、不明点があれば質問すること**

手戻りを防ぐため、以下の場合は必ずユーザーに確認すること：
1. ユーザーフロー（画面遷移の順序）が不明確な場合
2. ビジネスロジック（課金タイミング、制限条件など）が不明確な場合
3. UI/UXの詳細（ボタンの配置、テキスト内容など）が不明確な場合
4. エラーハンドリングの仕様が不明確な場合
5. 既存機能との連携方法が不明確な場合

**質問の例:**
- 「この画面の後はどの画面に遷移しますか？」
- 「この機能は有料ユーザーのみですか？」
- 「エラー時はどのようなメッセージを表示しますか？」

## 重要: 進捗更新ルール

**実装完了時は必ず progress.txt を更新すること**

実装が完了したら以下の手順を踏むこと：
1. コードを実装する
2. テストを作成・実行し、全て成功することを確認する
3. TypeScript型チェック (`npx tsc --noEmit`) を実行し、エラーがないことを確認する
4. `progress.txt` を更新し、完了したタスクに `[x]` を付ける
5. 完了日時を記録する

## 重要: 手動作業（manual-work）更新ルール

**外部サービス設定作業の完了時は必ず manual-work.txt を更新すること**

手動作業（App Store Connect、Firebase Console、OAuth設定など）が完了したら：
1. `/update-manual-work` コマンドを実行する
2. 完了した項目に `[x]` を付ける
3. 完了日時を記録する
4. 必要に応じて progress.txt の関連タスクも更新する

**利用可能なスラッシュコマンド:**
| コマンド | 用途 |
|---------|------|
| /update-manual-work | 手動作業の完了報告・更新 |
| /update-progress | progress.txtの更新 |
| /plan | 機能実装の計画立案 |
| /tdd | テスト駆動開発 |
| /code-review | コードレビュー |
| /build-fix | ビルドエラー修正 |

## プロジェクト概要

Batsugaku（罰学）は、プログラマー向けの「罰ゲーム学習」アプリです。

### コンセプト
- 毎日GitHubにpushしないと「サボりツイート」をする罰ゲーム
- ストリーク（連続学習日数）の追跡
- バッジシステムによるモチベーション維持

### アプリフロー（必須）
```
1. Googleアカウントでログイン
   ↓
2. X (Twitter) 連携
   ↓
3. GitHub 連携
   ↓
4. サブスクリプション購入（月額300円）
   ※課金しないとメイン機能にアクセス不可
   ↓
5. オンボーディング（目標設定）
   ↓
6. メイン画面（ダッシュボード）
```

**重要な制約:**
- X/GitHub連携が完了するまでサブスク画面に進めない
- サブスクを購入するまでメイン機能にアクセスできない
- 全てのUI表示は日本語

## 技術スタック

- **フレームワーク**: React Native (Expo SDK 54)
- **ルーティング**: Expo Router v6
- **バックエンド**: Firebase (Auth, Firestore)
- **認証**: Google OAuth, X OAuth 2.0 PKCE, GitHub OAuth
- **テスト**: Jest, React Native Testing Library

## ディレクトリ構造

```
├── app/                    # Expo Router ページ
│   ├── (auth)/            # 認証画面
│   ├── (main)/            # メイン画面（タブ）
│   └── onboarding/        # オンボーディング
├── src/
│   ├── contexts/          # React Context
│   ├── lib/               # ユーティリティ
│   ├── types/             # TypeScript型定義
│   ├── constants/         # 定数
│   └── __tests__/         # テスト
```

## 主要機能

### 実装済み
- [x] 基本的なアプリ構造
- [x] Firebase認証（Google OAuth）
- [x] ユーザーデータモデル
- [x] ダッシュボード画面（UI）
- [x] オンボーディング画面
- [x] バッジ画面
- [x] 設定画面
- [x] GitHub OAuth連携（ライブラリ + AuthContext）
- [x] X (Twitter) OAuth 2.0 PKCE連携（ライブラリ + AuthContext）
- [x] GitHub push検出（src/lib/github.ts）
- [x] ツイート投稿機能（src/lib/twitter.ts）
- [x] 日次チェック機能（src/lib/dailyCheck.ts）
- [x] 統計管理機能（src/lib/utils/stats.ts）
- [x] バッジ判定ロジック

### 未実装
- [ ] ダッシュボードの実データ連携
- [ ] Firestore連携（DailyLog保存）
- [ ] プッシュ通知
- [ ] Cloud Functions（自動実行）

詳細な進捗は `progress.txt` を参照

## 開発ガイドライン

### cogsec設定の使用

以下のエージェントとコマンドを活用:

| コマンド | 用途 |
|---------|------|
| /update-manual-work | 手動作業の完了報告・更新 |
| /update-progress | progress.txtの更新 |
| /plan | 機能実装の計画立案 |
| /tdd | テスト駆動開発 |
| /code-review | コードレビュー |
| /build-fix | ビルドエラー修正 |

### コーディングスタイル

- イミュータブルなデータ操作
- 小さいファイル（200-400行目安）
- 入力値の検証必須
- エラーハンドリング必須

### テスト要件

- 80%以上のカバレッジ
- TDD（テスト駆動開発）推奨
- Unit / Integration / E2E テスト

## 環境変数

```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_GOOGLE_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_X_CLIENT_ID=
EXPO_PUBLIC_X_CLIENT_SECRET=
EXPO_PUBLIC_GITHUB_CLIENT_ID=
EXPO_PUBLIC_GITHUB_CLIENT_SECRET=
```
