# Batsugaku 再設計提案書

作成日: 2026-02-26
作成者: Claude

---

## 目次

1. [概要](#1-概要)
2. [現状の課題分析](#2-現状の課題分析)
3. [設計思想](#3-設計思想)
4. [技術スタック](#4-技術スタック)
5. [データベース設計](#5-データベース設計)
6. [ディレクトリ構成](#6-ディレクトリ構成)
7. [認証フロー](#7-認証フロー)
8. [データフロー](#8-データフロー)
9. [状態管理](#9-状態管理)
10. [サブスクリプション](#10-サブスクリプション)
11. [テスト戦略](#11-テスト戦略)
12. [移行計画](#12-移行計画)
13. [まとめ](#13-まとめ)

---

## 1. 概要

### アプリの目的
Batsugaku（罰学）は、プログラマー向けの「罰ゲーム学習」アプリです。
- 毎日GitHubにpushしないとX（Twitter）に「サボりツイート」を自動投稿
- ストリーク追跡とバッジシステムでモチベーション維持
- 月額300円のサブスクリプションモデル

### この文書の目的
現状の実装を振り返り、ゼロから再設計するならどのような設計にするかを提案します。
各項目について「現状」「新設計」「なぜその設計か」を明記します。

---

## 2. 現状の課題分析

### 2.1 技術的負債

| 課題 | 詳細 | 影響 |
|------|------|------|
| Firebase依存 | Auth, Firestore, Cloud Functionsすべてに依存 | ベンダーロックイン、移行困難 |
| OAuth複雑性 | 4つの認証プロバイダーを個別実装 | コード量増大、バグリスク |
| 型安全性不足 | Firestoreの型定義が手動 | ランタイムエラーのリスク |
| IAP複雑性 | react-native-iapのレシート検証を自前実装 | 保守コスト高、テスト困難 |
| テスト不足 | E2Eテストなし | リグレッションリスク |

### 2.2 運用上の課題

| 課題 | 詳細 |
|------|------|
| Cloud Functionsのコールドスタート | 初回リクエストが遅い（数秒） |
| ポーリングベースの設計 | GitHub pushの検知にタイムラグ |
| デバッグの困難さ | Cloud Functionsのログが見にくい |
| 開発環境の複雑さ | Firebase Emulatorの設定が複雑 |

### 2.3 ビジネス上の課題

| 課題 | 詳細 |
|------|------|
| App Store審査 | IAP関連で複数回リジェクト |
| 分析機能不足 | サブスク解約率などの分析が困難 |
| 拡張性 | 新機能追加時の影響範囲が広い |

---

## 3. 設計思想

### 3.1 基本原則

```
┌─────────────────────────────────────────────────────────────┐
│  1. シンプルさ優先                                          │
│     - 機能を必要最小限に絞る                                │
│     - 複雑な実装より、マネージドサービスを活用              │
│                                                             │
│  2. 型安全性                                                │
│     - DBスキーマからフロントエンドまで型を一貫させる        │
│     - ランタイムエラーをコンパイル時に検出                  │
│                                                             │
│  3. オフラインファースト                                    │
│     - ネットワーク不安定でも基本機能が動作                  │
│     - 楽観的更新でUX向上                                    │
│                                                             │
│  4. イベント駆動                                            │
│     - ポーリングではなくWebhookで即時反映                   │
│     - リアルタイム同期で最新状態を維持                      │
│                                                             │
│  5. テスタビリティ                                          │
│     - E2Eテストを標準装備                                   │
│     - モック可能な設計                                      │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 トレードオフの判断基準

| 判断軸 | 優先 | 妥協 |
|--------|------|------|
| 開発速度 vs 柔軟性 | 開発速度 | マネージドサービス依存を許容 |
| 機能数 vs 品質 | 品質 | 機能は最小限に |
| コスト vs 運用負荷 | 運用負荷削減 | 多少のコスト増を許容 |

---

## 4. 技術スタック

### 4.1 フロントエンド

#### 現状
```
React Native (Expo SDK 54)
├── Expo Router v3
├── Context API + useState（状態管理）
├── StyleSheet（スタイリング）
└── 手動の型定義
```

#### 新設計
```
React Native (Expo SDK 54)
├── Expo Router v3（継続使用）
├── Tanstack Query v5（サーバー状態）
├── Zustand（クライアント状態）
├── Tamagui（UIコンポーネント + スタイリング）
├── React Hook Form + Zod（フォーム + バリデーション）
└── 自動生成の型定義
```

#### なぜこの設計か

**Tanstack Query**
- 現状: useEffectでデータフェッチ、ローディング状態を手動管理
- 新設計: Tanstack Queryでキャッシュ、再試行、楽観的更新を自動化
- 理由: データフェッチのボイラープレートが大幅削減。キャッシュ戦略も宣言的に記述可能

**Zustand**
- 現状: Context APIで認証状態を管理、propsドリリング発生
- 新設計: Zustandで軽量なグローバル状態管理
- 理由: Context APIより軽量、ボイラープレート少、DevTools対応

**Tamagui**
- 現状: StyleSheetで個別スタイリング、一貫性が取りにくい
- 新設計: Tamaguiでデザインシステムを構築
- 理由: コンパイル時最適化でパフォーマンス向上、テーマ切替も容易

### 4.2 バックエンド

#### 現状
```
Firebase
├── Authentication（認証）
├── Firestore（データベース）
├── Cloud Functions（サーバーレス処理）
└── Cloud Messaging（プッシュ通知）
```

#### 新設計
```
Supabase
├── Auth（認証 - Apple, Google, GitHub統合）
├── PostgreSQL（データベース）
├── Edge Functions（Deno、サーバーレス処理）
├── Realtime（リアルタイム同期）
└── Storage（ファイルストレージ）
```

#### なぜこの設計か

**Supabase を選ぶ理由**

| 比較項目 | Firebase | Supabase | 判定 |
|----------|----------|----------|------|
| データベース | Firestore (NoSQL) | PostgreSQL (RDB) | Supabase: 複雑なクエリが容易 |
| 型安全性 | 手動 | 自動生成 | Supabase: `supabase gen types` |
| 認証 | 個別設定 | OAuth統合済み | Supabase: Apple/Google/GitHub標準対応 |
| リアルタイム | 高価 | 安価 | Supabase: Realtimeが標準機能 |
| Edge Functions | Node.js (コールドスタート) | Deno (高速起動) | Supabase: 起動が速い |
| 価格 | 従量課金 | 固定 + 従量 | 同程度 |
| ベンダーロックイン | 高 | 低（PostgreSQL標準） | Supabase |

**PostgreSQLのメリット**
- Firestoreでは困難だった「連続ストリーク計算」がSQLで簡潔に記述可能
- マテリアライズドビューで集計をキャッシュ
- 外部キー制約でデータ整合性を保証

### 4.3 課金システム

#### 現状
```
react-native-iap
├── 購入処理（フロント）
├── レシート検証（Cloud Functions）
└── サブスク状態管理（Firestore）
```

#### 新設計
```
RevenueCat
├── 購入処理（SDK）
├── レシート検証（RevenueCat側）
├── Webhook（状態同期）
└── ダッシュボード（分析）
```

#### なぜこの設計か

**RevenueCatを選ぶ理由**

| 比較項目 | react-native-iap | RevenueCat |
|----------|------------------|------------|
| レシート検証 | 自前実装必須 | 自動 |
| サブスク状態管理 | 自前実装必須 | 自動 |
| テスト | 困難 | サンドボックス簡単 |
| 分析 | なし | ダッシュボード標準 |
| クロスプラットフォーム | 個別対応 | 統一API |
| コスト | 無料 | 月$0〜（売上の1-2.5%） |

**現状の問題点**
- App Store審査で「Invalid product ID」エラーが発生
- レシート検証ロジックの保守が大変
- サブスク解約率などの分析ができない

**RevenueCatで解決**
- レシート検証をRevenueCatに委譲
- Webhookでサブスク状態を自動同期
- ダッシュボードで解約率、LTV等を分析

---

## 5. データベース設計

### 5.1 現状（Firestore）

```
users/{userId}
├── displayName: string
├── email: string
├── github: { username, accessToken, ... }
├── twitter: { username, accessToken, ... }
├── subscription: { status, expiresAt, ... }
├── streak: { current, longest, ... }
└── badges: string[]

dailyChecks/{date}_{userId}
├── userId: string
├── date: string
├── hasPushed: boolean
└── saboried: boolean
```

**問題点**
- ネストしたデータ構造で更新が複雑
- 関連データの取得に複数クエリが必要
- 集計クエリが困難（ストリーク計算など）

### 5.2 新設計（PostgreSQL）

```sql
-- ============================================================
-- ユーザー基本情報
-- ============================================================
-- Supabase Authのusersテーブルと連携
-- auth.usersに認証情報、publicテーブルにアプリ固有データ

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  github_username TEXT UNIQUE,  -- GitHub連携後に設定
  twitter_username TEXT,         -- X連携後に設定
  timezone TEXT DEFAULT 'Asia/Tokyo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS（Row Level Security）: ユーザーは自分のデータのみアクセス可
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own data" ON public.users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE USING (auth.uid() = id);


-- ============================================================
-- GitHub連携
-- ============================================================
-- 認証とは別にGitHub連携情報を保存
-- accessTokenは暗号化して保存（pgcryptoを使用）

CREATE TABLE public.github_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  github_user_id BIGINT UNIQUE NOT NULL,
  github_username TEXT NOT NULL,
  access_token TEXT NOT NULL,  -- 暗号化推奨
  scope TEXT,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- インデックス: Webhook受信時にgithub_user_idで検索
CREATE INDEX idx_github_connections_github_user_id
  ON public.github_connections(github_user_id);


-- ============================================================
-- X (Twitter) 連携
-- ============================================================
CREATE TABLE public.twitter_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  twitter_user_id TEXT UNIQUE NOT NULL,
  twitter_username TEXT NOT NULL,
  access_token TEXT NOT NULL,   -- 暗号化推奨
  refresh_token TEXT NOT NULL,  -- OAuth 2.0 PKCE
  token_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);


-- ============================================================
-- サブスクリプション
-- ============================================================
-- RevenueCatのWebhookで更新
-- 履歴も保持するため、statusが変わるたびにINSERT

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- RevenueCatから取得
  revenuecat_customer_id TEXT,
  product_id TEXT NOT NULL,  -- 'batsugaku_monthly_300'

  -- ステータス
  status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'cancelled', 'grace_period')),

  -- 期間
  started_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  -- メタデータ
  platform TEXT,  -- 'ios', 'android'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 最新のサブスクリプションを取得するビュー
CREATE VIEW public.current_subscriptions AS
SELECT DISTINCT ON (user_id) *
FROM public.subscriptions
ORDER BY user_id, created_at DESC;


-- ============================================================
-- デイリーチェック
-- ============================================================
-- 1ユーザー1日1レコード
-- GitHub Webhookまたは日次バッチで更新

CREATE TABLE public.daily_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  check_date DATE NOT NULL,

  -- Push状態
  has_pushed BOOLEAN DEFAULT FALSE,
  push_count INTEGER DEFAULT 0,
  first_push_at TIMESTAMPTZ,
  last_push_at TIMESTAMPTZ,

  -- サボりツイート
  sabori_tweeted BOOLEAN DEFAULT FALSE,
  sabori_tweet_id TEXT,
  sabori_tweeted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, check_date)
);

-- インデックス: 日次処理で日付検索
CREATE INDEX idx_daily_checks_date ON public.daily_checks(check_date);
CREATE INDEX idx_daily_checks_user_date ON public.daily_checks(user_id, check_date DESC);


-- ============================================================
-- ストリーク計算（マテリアライズドビュー）
-- ============================================================
-- 複雑なストリーク計算をDBレイヤーで実行
-- 定期的にREFRESHすることでキャッシュ

CREATE MATERIALIZED VIEW public.user_streaks AS
WITH
-- 連続日数を計算するためのギャップ検出
push_days AS (
  SELECT
    user_id,
    check_date,
    check_date - (ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY check_date
    ))::int AS streak_group
  FROM public.daily_checks
  WHERE has_pushed = TRUE
),
-- 各ストリークグループの長さを計算
streak_lengths AS (
  SELECT
    user_id,
    streak_group,
    MIN(check_date) AS streak_start,
    MAX(check_date) AS streak_end,
    COUNT(*) AS streak_length
  FROM push_days
  GROUP BY user_id, streak_group
),
-- 現在のストリーク（今日または昨日が含まれるもの）
current_streaks AS (
  SELECT
    user_id,
    streak_length AS current_streak
  FROM streak_lengths
  WHERE streak_end >= CURRENT_DATE - INTERVAL '1 day'
)
SELECT
  u.id AS user_id,
  COALESCE(cs.current_streak, 0) AS current_streak,
  COALESCE((
    SELECT MAX(streak_length)
    FROM streak_lengths sl
    WHERE sl.user_id = u.id
  ), 0) AS longest_streak,
  COALESCE((
    SELECT COUNT(*)
    FROM public.daily_checks dc
    WHERE dc.user_id = u.id AND dc.has_pushed = TRUE
  ), 0) AS total_push_days
FROM public.users u
LEFT JOIN current_streaks cs ON cs.user_id = u.id;

-- インデックス
CREATE UNIQUE INDEX idx_user_streaks_user_id ON public.user_streaks(user_id);

-- 定期リフレッシュ（Cronで実行）
-- REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_streaks;


-- ============================================================
-- バッジ
-- ============================================================
CREATE TABLE public.badges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_name TEXT,  -- アプリ内アイコン名
  condition_type TEXT NOT NULL,  -- 'streak', 'total_days', 'special'
  condition_value INTEGER,  -- 条件値（streak=7なら7日連続）
  sort_order INTEGER DEFAULT 0
);

-- 初期データ
INSERT INTO public.badges (id, name, description, condition_type, condition_value, sort_order) VALUES
  ('first_push', '初めてのPush', '初めてGitHubにpushしました', 'total_days', 1, 1),
  ('streak_3', '3日連続', '3日連続でpushしました', 'streak', 3, 2),
  ('streak_7', '1週間継続', '7日連続でpushしました', 'streak', 7, 3),
  ('streak_14', '2週間継続', '14日連続でpushしました', 'streak', 14, 4),
  ('streak_30', '1ヶ月継続', '30日連続でpushしました', 'streak', 30, 5),
  ('streak_100', '100日継続', '100日連続でpushしました', 'streak', 100, 6),
  ('streak_365', '1年継続', '365日連続でpushしました', 'streak', 365, 7);

CREATE TABLE public.user_badges (
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  badge_id TEXT REFERENCES public.badges(id),
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);


-- ============================================================
-- 目標ツイート
-- ============================================================
CREATE TABLE public.goal_tweets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (LENGTH(content) <= 280),

  -- 投稿状態
  is_posted BOOLEAN DEFAULT FALSE,
  tweet_id TEXT,
  posted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- プッシュ通知トークン
-- ============================================================
CREATE TABLE public.push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL,  -- 'ios', 'android'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);
```

### 5.3 設計の違いと理由

| 項目 | Firestore | PostgreSQL | 理由 |
|------|-----------|------------|------|
| スキーマ | スキーマレス | スキーマあり | 型安全性、データ整合性 |
| 関連データ | ネスト or サブコレクション | 外部キー + JOIN | 正規化でデータ重複を排除 |
| 集計 | クライアント側で計算 | SQL/マテリアライズドビュー | サーバー側で効率的に計算 |
| トランザクション | 制限あり | 完全対応 | 複数テーブル更新の整合性 |

---

## 6. ディレクトリ構成

### 6.1 現状

```
Batugaku2/
├── app/                    # Expo Router
│   ├── (auth)/
│   ├── (main)/
│   ├── onboarding/
│   ├── linking/
│   └── subscription/
├── src/
│   ├── components/         # UIコンポーネント（混在）
│   ├── contexts/           # Context API
│   ├── hooks/              # カスタムフック
│   ├── lib/                # ユーティリティ（巨大）
│   ├── constants/
│   └── types/
├── functions/              # Cloud Functions（別プロジェクト）
└── docs/
```

**問題点**
- `src/lib/`が肥大化（github.ts, twitter.ts, iapService.ts等）
- Cloud Functionsが別ディレクトリで型共有が困難
- コンポーネントの分類が曖昧

### 6.2 新設計（モノレポ）

```
batsugaku/
├── apps/
│   └── mobile/                      # Expoアプリ
│       ├── app/                     # Expo Router（現状維持）
│       │   ├── (auth)/
│       │   │   └── index.tsx       # ログイン画面
│       │   ├── (main)/
│       │   │   ├── index.tsx       # ダッシュボード
│       │   │   ├── settings.tsx    # 設定
│       │   │   └── badges.tsx      # バッジ一覧
│       │   ├── (onboarding)/
│       │   │   └── index.tsx       # オンボーディング
│       │   └── _layout.tsx
│       │
│       ├── src/
│       │   ├── components/
│       │   │   ├── ui/              # 汎用UIコンポーネント
│       │   │   │   ├── Button.tsx
│       │   │   │   ├── Card.tsx
│       │   │   │   └── Modal.tsx
│       │   │   └── features/        # 機能別コンポーネント
│       │   │       ├── daily-check/
│       │   │       │   ├── DailyCheckCard.tsx
│       │   │       │   └── PushStatusBadge.tsx
│       │   │       ├── streak/
│       │   │       │   ├── StreakCounter.tsx
│       │   │       │   └── StreakCalendar.tsx
│       │   │       └── badges/
│       │   │           ├── BadgeGrid.tsx
│       │   │           └── BadgeItem.tsx
│       │   │
│       │   ├── hooks/
│       │   │   ├── queries/         # Tanstack Query
│       │   │   │   ├── useDailyCheck.ts
│       │   │   │   ├── useStreak.ts
│       │   │   │   ├── useBadges.ts
│       │   │   │   └── useSubscription.ts
│       │   │   ├── mutations/       # データ更新
│       │   │   │   ├── useConnectGithub.ts
│       │   │   │   └── usePurchase.ts
│       │   │   └── useAuth.ts
│       │   │
│       │   ├── lib/
│       │   │   ├── supabase.ts      # Supabaseクライアント
│       │   │   ├── revenuecat.ts    # RevenueCat
│       │   │   └── notifications.ts # プッシュ通知
│       │   │
│       │   ├── stores/              # Zustand
│       │   │   ├── authStore.ts
│       │   │   └── appStore.ts
│       │   │
│       │   └── types/
│       │       └── index.ts         # アプリ固有の型
│       │
│       ├── app.json
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── database/                    # DB型定義（自動生成）
│   │   ├── types.ts                 # supabase gen types
│   │   └── package.json
│   │
│   └── shared/                      # 共有ロジック
│       ├── validators/              # Zodスキーマ
│       │   ├── user.ts
│       │   └── dailyCheck.ts
│       ├── constants/
│       │   ├── badges.ts
│       │   └── subscription.ts
│       └── package.json
│
├── supabase/
│   ├── migrations/                  # DBマイグレーション
│   │   ├── 00001_initial.sql
│   │   └── 00002_add_badges.sql
│   │
│   ├── functions/                   # Edge Functions
│   │   ├── github-webhook/
│   │   │   └── index.ts            # GitHub Webhook処理
│   │   ├── daily-check/
│   │   │   └── index.ts            # 日次Cron処理
│   │   ├── sabori-tweet/
│   │   │   └── index.ts            # サボりツイート投稿
│   │   └── revenuecat-webhook/
│   │       └── index.ts            # RevenueCat Webhook
│   │
│   ├── seed.sql                     # 初期データ
│   └── config.toml                  # Supabase設定
│
├── .github/
│   └── workflows/
│       ├── test.yml                 # テスト実行
│       ├── preview.yml              # PRプレビュービルド
│       └── deploy.yml               # 本番デプロイ
│
├── turbo.json                       # Turborepo設定
├── package.json                     # ルートpackage.json
└── pnpm-workspace.yaml              # pnpmワークスペース
```

### 6.3 構成の違いと理由

| 項目 | 現状 | 新設計 | 理由 |
|------|------|--------|------|
| 構成 | 単一パッケージ | モノレポ | 型共有、バージョン管理統一 |
| コンポーネント | フラット | ui/ + features/ | 再利用性と機能の分離 |
| hooks | 混在 | queries/ + mutations/ | 責務の明確化 |
| バックエンド | 別ディレクトリ | supabase/ | 型共有が容易 |
| 型定義 | 手動 | packages/database | 自動生成で常に最新 |

---

## 7. 認証フロー

### 7.1 現状の問題

```
現状のフロー:
┌─────────────────────────────────────────────────────────────┐
│  1. ログイン（Google or Apple）                             │
│     └─ Firebase Auth                                        │
│                                                             │
│  2. X連携（OAuth 2.0 PKCE）                                 │
│     └─ 手動実装、トークン管理が複雑                          │
│                                                             │
│  3. GitHub連携（OAuth）                                     │
│     └─ 手動実装、トークン管理が複雑                          │
│                                                             │
│  4. サブスク購入                                            │
│                                                             │
│  5. オンボーディング完了                                    │
└─────────────────────────────────────────────────────────────┘

問題点:
- 4つのOAuthプロバイダーを個別実装
- トークンリフレッシュロジックが各所に散在
- 認証エラーハンドリングが複雑
- App Store審査でSign in with Apple追加が必要になった
```

### 7.2 新設計

```
新設計のフロー:
┌─────────────────────────────────────────────────────────────┐
│  1. ログイン（Apple / Google / GitHub）                     │
│     └─ Supabase Auth（統一処理）                            │
│        - Apple: App Store要件を満たす                       │
│        - Google: 既存ユーザー向け                           │
│        - GitHub: 開発者なら馴染みがある + 連携も完了         │
│                                                             │
│  2. GitHub連携（ログインがGitHub以外の場合のみ）            │
│     └─ Supabase Auth の追加プロバイダーリンク               │
│     └─ または OAuth で別途連携                              │
│                                                             │
│  3. サブスク購入                                            │
│     └─ RevenueCat（シンプルなAPI）                          │
│                                                             │
│  4. X連携（オプション、サボりツイート用）                   │
│     └─ サボりツイート機能を使う場合のみ                     │
│                                                             │
│  5. オンボーディング完了                                    │
└─────────────────────────────────────────────────────────────┘

改善点:
- Supabase Authで認証を統一
- GitHubログインなら連携も同時完了
- X連携はオプション化（必須ではない）
- トークン管理をSupabaseに委譲
```

### 7.3 実装の違い

#### 現状（個別実装）
```typescript
// 現状: 各プロバイダーを個別実装
// AuthContext.tsx - 約400行

// Googleログイン
const signInWithGoogle = async () => {
  await GoogleSignin.hasPlayServices();
  const { idToken } = await GoogleSignin.signIn();
  const credential = GoogleAuthProvider.credential(idToken);
  await signInWithCredential(auth, credential);
  // Firestoreにユーザー作成...
};

// Appleログイン
const signInWithApple = async () => {
  const nonce = Math.random().toString(36);
  const hashedNonce = await Crypto.digestStringAsync(...);
  const credential = await AppleAuthentication.signInAsync({...});
  const oauthCredential = provider.credential({...});
  await signInWithCredential(auth, oauthCredential);
  // Firestoreにユーザー作成...
};

// GitHub連携（別途OAuth実装）
const linkGitHubAccount = async () => {
  const authUrl = `https://github.com/login/oauth/authorize?...`;
  const result = await WebBrowser.openAuthSessionAsync(authUrl);
  // コールバック処理...
  // トークン交換...
  // Firestoreに保存...
};

// X連携（別途OAuth 2.0 PKCE実装）
const linkXAccount = async () => {
  // PKCE用のcode_verifier生成
  // 認証URL構築
  // コールバック処理
  // トークン交換
  // リフレッシュトークン管理...
};
```

#### 新設計（Supabase Auth統一）
```typescript
// 新設計: Supabase Authで統一
// lib/supabase.ts + hooks/useAuth.ts - 約100行

import { supabase } from '@/lib/supabase';

// Apple/Google/GitHubログイン（統一API）
export async function signIn(provider: 'apple' | 'google' | 'github') {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: 'batsugaku://auth/callback',
      scopes: provider === 'github' ? 'read:user,repo' : undefined,
    },
  });
  return { data, error };
}

// ログアウト
export async function signOut() {
  return supabase.auth.signOut();
}

// セッション監視
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => setUser(session?.user ?? null)
    );

    return () => subscription.unsubscribe();
  }, []);

  return { user, signIn, signOut };
}
```

---

## 8. データフロー

### 8.1 GitHub Push検知

#### 現状（ポーリング + Webhook）
```
現状のフロー:
┌──────────────────────────────────────────────────────────┐
│ 方式1: Cloud Functions Cron (毎日0時)                    │
│   └─ GitHub API で各ユーザーのpush履歴を取得             │
│   └─ 問題: APIレート制限、タイムラグ                     │
│                                                          │
│ 方式2: GitHub Webhook (リアルタイム)                     │
│   └─ ユーザーが手動でWebhook設定が必要                   │
│   └─ 問題: 設定が面倒、設定忘れ                          │
└──────────────────────────────────────────────────────────┘
```

#### 新設計（Webhook優先 + フォールバック）
```
新設計のフロー:
┌──────────────────────────────────────────────────────────┐
│ 優先: GitHub Webhook                                     │
│                                                          │
│   GitHub Repository                                      │
│         │ push event                                     │
│         ▼                                                │
│   Supabase Edge Function (github-webhook)                │
│         │                                                │
│         ├─ 署名検証 (HMAC-SHA256)                        │
│         ├─ github_user_id からユーザー特定               │
│         ├─ daily_checks テーブル更新                     │
│         ├─ バッジ判定・付与                              │
│         └─ Supabase Realtime で即時通知                  │
│                │                                         │
│                ▼                                         │
│         アプリに即時反映（リアルタイム同期）              │
│                                                          │
│ フォールバック: 日次バッチ                               │
│   └─ Webhook未設定ユーザー向け                           │
│   └─ GitHub API でpush履歴を確認                         │
└──────────────────────────────────────────────────────────┘
```

#### Edge Function実装例
```typescript
// supabase/functions/github-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  // 署名検証
  const signature = req.headers.get('x-hub-signature-256');
  const body = await req.text();
  if (!verifySignature(body, signature, Deno.env.get('GITHUB_WEBHOOK_SECRET'))) {
    return new Response('Invalid signature', { status: 401 });
  }

  const payload = JSON.parse(body);

  // pushイベントのみ処理
  if (req.headers.get('x-github-event') !== 'push') {
    return new Response('OK');
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // GitHubユーザーIDからアプリユーザーを特定
  const { data: connection } = await supabase
    .from('github_connections')
    .select('user_id')
    .eq('github_user_id', payload.sender.id)
    .single();

  if (!connection) {
    return new Response('User not found');
  }

  const today = new Date().toISOString().split('T')[0];

  // daily_checksを更新（UPSERT）
  await supabase.from('daily_checks').upsert({
    user_id: connection.user_id,
    check_date: today,
    has_pushed: true,
    push_count: 1,  // 実際はインクリメント
    first_push_at: new Date().toISOString(),
    last_push_at: new Date().toISOString(),
  }, {
    onConflict: 'user_id,check_date',
  });

  // バッジ判定（ストリーク更新後）
  await checkAndAwardBadges(supabase, connection.user_id);

  return new Response('OK');
});
```

### 8.2 サボりツイート投稿

#### 現状
```
Cloud Functions Cron (毎日0時)
└─ 前日のdaily_checksを確認
└─ has_pushed = false のユーザーを抽出
└─ X APIでツイート投稿
└─ トークンリフレッシュ処理
└─ エラーハンドリング...
```

#### 新設計
```typescript
// supabase/functions/sabori-tweet/index.ts
// Cron: 毎日 00:05 JST

serve(async () => {
  const supabase = createClient(...);
  const yesterday = getYesterdayDate();

  // サボったユーザーを取得（X連携済み、サブスク有効）
  const { data: targets } = await supabase
    .from('daily_checks')
    .select(`
      user_id,
      users!inner(id),
      twitter_connections!inner(access_token, refresh_token),
      subscriptions!inner(status)
    `)
    .eq('check_date', yesterday)
    .eq('has_pushed', false)
    .eq('sabori_tweeted', false)
    .eq('subscriptions.status', 'active');

  for (const target of targets) {
    try {
      // トークンリフレッシュ（必要なら）
      const accessToken = await refreshTokenIfNeeded(target.twitter_connections);

      // ツイート投稿
      const tweet = await postTweet(accessToken, generateSaboriMessage());

      // 結果を記録
      await supabase
        .from('daily_checks')
        .update({
          sabori_tweeted: true,
          sabori_tweet_id: tweet.id,
          sabori_tweeted_at: new Date().toISOString(),
        })
        .eq('user_id', target.user_id)
        .eq('check_date', yesterday);

    } catch (error) {
      console.error(`Failed for user ${target.user_id}:`, error);
      // エラーログをテーブルに記録
    }
  }

  return new Response('OK');
});
```

---

## 9. 状態管理

### 9.1 現状の問題

```typescript
// 現状: Context API + useState
// - 再レンダリングが多い
// - キャッシュ戦略がない
// - ローディング状態の管理が煩雑

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // データフェッチのたびに手動でローディング管理
  const fetchUser = async () => {
    setLoading(true);
    try {
      const data = await getUser();
      setUser(data);
    } finally {
      setLoading(false);
    }
  };

  // Context を使う全コンポーネントが再レンダリング
  return (
    <AuthContext.Provider value={{ user, loading, ... }}>
      {children}
    </AuthContext.Provider>
  );
}
```

### 9.2 新設計

#### サーバー状態（Tanstack Query）
```typescript
// hooks/queries/useDailyCheck.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// 今日のチェック状態を取得
export function useTodayCheck() {
  const { user } = useAuth();
  const today = new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: ['daily-check', user?.id, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_checks')
        .select('*')
        .eq('user_id', user!.id)
        .eq('check_date', today)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60,  // 1分間はキャッシュを使用
  });
}

// ストリーク情報を取得
export function useStreak() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['streak', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', user!.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,  // 5分間キャッシュ
  });
}

// Realtimeで自動更新
export function useDailyCheckRealtime() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('daily-check-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_checks',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // 変更があったらキャッシュを無効化
          queryClient.invalidateQueries({ queryKey: ['daily-check'] });
          queryClient.invalidateQueries({ queryKey: ['streak'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
}
```

#### クライアント状態（Zustand）
```typescript
// stores/appStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppState {
  // オンボーディング
  hasCompletedOnboarding: boolean;
  completeOnboarding: () => void;

  // 通知設定
  notificationsEnabled: boolean;
  toggleNotifications: () => void;

  // テーマ（将来用）
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      hasCompletedOnboarding: false,
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),

      notificationsEnabled: true,
      toggleNotifications: () =>
        set((state) => ({ notificationsEnabled: !state.notificationsEnabled })),

      theme: 'system',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

### 9.3 状態管理の違いと理由

| 項目 | 現状 | 新設計 | 理由 |
|------|------|--------|------|
| サーバー状態 | Context + useEffect | Tanstack Query | キャッシュ、再試行、楽観的更新が自動 |
| クライアント状態 | Context + useState | Zustand | 軽量、永続化簡単、DevTools対応 |
| リアルタイム | Firestore onSnapshot | Supabase Realtime + invalidate | より明示的な制御 |
| 再レンダリング | Context全体 | セレクタで最小限 | パフォーマンス向上 |

---

## 10. サブスクリプション

### 10.1 現状の問題

```
現状のアーキテクチャ:
┌─────────────────────────────────────────────────────────────┐
│  アプリ (react-native-iap)                                  │
│    └─ 購入リクエスト                                        │
│    └─ レシート取得                                          │
│         │                                                   │
│         ▼                                                   │
│  Cloud Functions (receiptValidation)                        │
│    └─ Apple Server API でレシート検証                       │
│    └─ 有効期限計算                                          │
│    └─ Firestore に保存                                      │
│         │                                                   │
│         ▼                                                   │
│  問題点:                                                    │
│  - レシート検証ロジックが複雑                               │
│  - サブスク更新・キャンセルの検知が困難                     │
│  - テストがしにくい                                         │
│  - App Store審査で「Invalid product ID」エラー              │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 新設計（RevenueCat）

```
新設計のアーキテクチャ:
┌─────────────────────────────────────────────────────────────┐
│  アプリ (RevenueCat SDK)                                    │
│    └─ 購入リクエスト                                        │
│         │                                                   │
│         ▼                                                   │
│  RevenueCat                                                 │
│    └─ レシート検証（自動）                                  │
│    └─ サブスク状態管理                                      │
│    └─ Webhook で変更通知                                    │
│         │                                                   │
│         ▼                                                   │
│  Supabase Edge Function (revenuecat-webhook)                │
│    └─ サブスク状態を DB に同期                              │
│         │                                                   │
│         ▼                                                   │
│  メリット:                                                  │
│  - レシート検証不要                                         │
│  - 更新・キャンセル自動検知                                 │
│  - サンドボックステスト簡単                                 │
│  - ダッシュボードで分析                                     │
└─────────────────────────────────────────────────────────────┘
```

### 10.3 実装例

#### アプリ側
```typescript
// lib/revenuecat.ts
import Purchases, {
  PurchasesPackage,
  CustomerInfo
} from 'react-native-purchases';

const REVENUECAT_API_KEY = Platform.select({
  ios: 'appl_xxxxx',
  android: 'goog_xxxxx',
});

export async function initializePurchases(userId: string) {
  Purchases.configure({
    apiKey: REVENUECAT_API_KEY!,
    appUserID: userId,
  });
}

export async function getOfferings() {
  const offerings = await Purchases.getOfferings();
  return offerings.current;
}

export async function purchasePackage(pkg: PurchasesPackage) {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function restorePurchases() {
  const customerInfo = await Purchases.restorePurchases();
  return customerInfo;
}

export function isPremium(customerInfo: CustomerInfo): boolean {
  return customerInfo.entitlements.active['premium'] !== undefined;
}

// hooks/useSubscription.ts
export function useSubscription() {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 初期状態を取得
    Purchases.getCustomerInfo().then(setCustomerInfo);

    // 変更を監視
    const listener = Purchases.addCustomerInfoUpdateListener(setCustomerInfo);
    setIsLoading(false);

    return () => listener.remove();
  }, []);

  const purchase = async () => {
    const offerings = await getOfferings();
    if (offerings?.monthly) {
      return purchasePackage(offerings.monthly);
    }
  };

  return {
    isPremium: customerInfo ? isPremium(customerInfo) : false,
    isLoading,
    purchase,
    restore: restorePurchases,
  };
}
```

#### Webhook処理
```typescript
// supabase/functions/revenuecat-webhook/index.ts
serve(async (req) => {
  // 署名検証
  const signature = req.headers.get('Authorization');
  if (signature !== `Bearer ${Deno.env.get('REVENUECAT_WEBHOOK_SECRET')}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const event = await req.json();
  const supabase = createClient(...);

  // イベントタイプに応じて処理
  switch (event.type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
      await supabase.from('subscriptions').insert({
        user_id: event.app_user_id,
        revenuecat_customer_id: event.original_app_user_id,
        product_id: event.product_id,
        status: 'active',
        started_at: event.purchased_at,
        expires_at: event.expiration_at,
        platform: event.store,
      });
      break;

    case 'CANCELLATION':
      await supabase.from('subscriptions').insert({
        user_id: event.app_user_id,
        product_id: event.product_id,
        status: 'cancelled',
        cancelled_at: event.event_timestamp,
      });
      break;

    case 'EXPIRATION':
      await supabase.from('subscriptions').insert({
        user_id: event.app_user_id,
        product_id: event.product_id,
        status: 'expired',
        expires_at: event.expiration_at,
      });
      break;
  }

  return new Response('OK');
});
```

---

## 11. テスト戦略

### 11.1 現状

```
現状:
├── ユニットテスト: 216テスト（Jest）
│   └─ lib/, hooks/ のロジックテスト
│   └─ カバレッジ: 不明
│
├── 統合テスト: 2ファイル
│   └─ 認証フローの統合テスト
│
└── E2Eテスト: なし
    └─ 手動テストに依存
    └─ リグレッションリスク高
```

### 11.2 新設計

```
新設計:
├── ユニットテスト (Vitest)
│   └─ ビジネスロジックのテスト
│   └─ カバレッジ目標: 80%
│
├── コンポーネントテスト (Testing Library)
│   └─ UIコンポーネントの振る舞いテスト
│   └─ スナップショットテスト
│
├── 統合テスト (MSW + Testing Library)
│   └─ API連携のテスト
│   └─ モックサーバーで再現性確保
│
└── E2Eテスト (Maestro)
    └─ 重要なユーザーフローを自動化
    └─ CI/CDで毎PRテスト
    └─ スクリーンショット比較
```

### 11.3 E2Eテスト例（Maestro）

```yaml
# .maestro/flows/complete_onboarding.yaml
appId: com.batsugaku.app
---
- launchApp:
    clearState: true

# ログイン
- tapOn: "Appleでサインイン"
- waitForAnimationEnd

# GitHub連携
- assertVisible: "GitHubと連携"
- tapOn: "GitHubと連携"
- waitForAnimationEnd

# サブスク購入
- assertVisible: "バツガクプレミアム"
- assertVisible: "¥300/月"
- tapOn: "登録して学習開始"
- waitForAnimationEnd

# ダッシュボード
- assertVisible: "今日のpush状況"
- assertVisible: "現在のストリーク"

# スクリーンショット
- takeScreenshot: "dashboard"
```

```yaml
# .maestro/flows/daily_check_flow.yaml
appId: com.batsugaku.app
---
- launchApp

# ダッシュボード確認
- assertVisible: "今日のpush状況"

# 設定画面へ
- tapOn: "設定"
- assertVisible: "アカウント設定"
- assertVisible: "GitHub連携"
- assertVisible: "X連携"

# 戻る
- tapOn: "戻る"
- assertVisible: "今日のpush状況"
```

### 11.4 CI/CD設定

```yaml
# .github/workflows/test.yml
name: Test

on:
  pull_request:
    branches: [main]

jobs:
  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: pnpm test:unit
      - run: pnpm test:coverage

  e2e-test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: mobile-dev-inc/action-maestro-cloud@v1
        with:
          api-key: ${{ secrets.MAESTRO_CLOUD_API_KEY }}
          app-file: app-debug.apk
```

---

## 12. 移行計画

### 12.1 フェーズ分け

```
Phase 1: 基盤構築（2週間）
├── Supabaseプロジェクト作成
├── DBスキーマ作成・マイグレーション
├── 型定義自動生成の設定
└── Edge Functions基盤

Phase 2: 認証移行（1週間）
├── Supabase Auth設定
├── 既存ユーザーの移行スクリプト
└── アプリの認証フロー書き換え

Phase 3: データ移行（1週間）
├── Firestore → PostgreSQL移行スクリプト
├── データ整合性チェック
└── 並行運用期間

Phase 4: 課金移行（1週間）
├── RevenueCat設定
├── Webhook設定
├── 既存サブスクの移行

Phase 5: 新機能・テスト（2週間）
├── Tanstack Query導入
├── Zustand導入
├── E2Eテスト整備
└── パフォーマンス最適化

Phase 6: 本番切り替え（1週間）
├── 段階的ロールアウト
├── モニタリング
└── 旧システム停止
```

### 12.2 リスクと対策

| リスク | 対策 |
|--------|------|
| データ移行の失敗 | 並行運用期間を設け、ロールバック可能に |
| 認証の中断 | 移行中は両システムで認証可能にする |
| サブスクの二重課金 | RevenueCatの既存購入インポート機能を使用 |
| ユーザー混乱 | 移行前に告知、移行後にヘルプを充実 |

---

## 13. まとめ

### 13.1 変更点一覧

| 項目 | 現状 | 新設計 | 改善効果 |
|------|------|--------|----------|
| バックエンド | Firebase | Supabase | ベンダーロックイン軽減、型安全性 |
| データベース | Firestore | PostgreSQL | 複雑なクエリ、集計が容易 |
| 認証 | 4プロバイダー個別 | Supabase Auth統一 | コード量削減、保守性向上 |
| 課金 | react-native-iap | RevenueCat | レシート検証不要、分析可能 |
| 状態管理 | Context API | Tanstack Query + Zustand | キャッシュ、パフォーマンス |
| E2Eテスト | なし | Maestro | リグレッション防止 |

### 13.2 期待される効果

**開発効率**
- コード量: 約30%削減（認証、課金周り）
- 新機能開発: 約2倍の速度
- バグ修正: 型安全性で事前検出

**運用効率**
- 障害対応: Supabaseダッシュボードで可視化
- サブスク分析: RevenueCatで自動化
- デプロイ: CI/CDで自動化

**ユーザー体験**
- パフォーマンス: キャッシュ戦略で高速化
- リアルタイム: GitHub push即時反映
- 信頼性: E2Eテストでリグレッション防止

### 13.3 注意点

- 移行にはまとまった開発期間が必要（約8週間）
- 学習コスト（Supabase、RevenueCat、Tanstack Query）
- RevenueCatの従量課金（売上の1-2.5%）
- 既存ユーザーの移行作業

### 13.4 結論

現状のアーキテクチャでも動作はするが、保守性・拡張性に課題がある。
特に課金周りの複雑さはApp Store審査でも問題になった。

新規プロジェクトとして始めるなら、本提案のアーキテクチャを推奨する。
既存プロジェクトへの適用は、フェーズを分けて段階的に移行することで
リスクを最小化できる。

---

## 付録

### A. 参考リンク

- [Supabase Documentation](https://supabase.com/docs)
- [RevenueCat Documentation](https://www.revenuecat.com/docs)
- [Tanstack Query](https://tanstack.com/query)
- [Zustand](https://github.com/pmndrs/zustand)
- [Maestro](https://maestro.mobile.dev/)
- [Tamagui](https://tamagui.dev/)

### B. 用語集

| 用語 | 説明 |
|------|------|
| Edge Functions | サーバーレス関数（Supabase版、Denoで動作） |
| RLS | Row Level Security、行レベルのアクセス制御 |
| Webhook | イベント発生時に外部URLへHTTPリクエストを送信 |
| マテリアライズドビュー | 計算結果をキャッシュするDB機能 |
| PKCE | OAuth 2.0の拡張、モバイルアプリ向け認証フロー |
