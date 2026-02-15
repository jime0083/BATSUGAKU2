# Implementation Plan: 連続学習日数（ストリーク）計算バグ修正

## Overview

ユーザーが連続日（金曜13日と土曜14日）にGitHubにpushしているにも関わらず、「現在の連続学習日数」が「2日」ではなく「1日」と表示されるバグを修正します。

## 根本原因

**問題箇所**: `app/(main)/index.tsx` の日付計算関数

| 関数 | 問題点 |
|------|--------|
| `getTodayDateString()` | タイムゾーン未考慮 |
| `getYesterdayDateString()` | タイムゾーン未考慮 |
| `timestampToDateString()` | UTC→JST変換なし |

**結果**: Firestoreに保存された`lastStudyDate`（UTC）と「昨日」の比較が正しく行われず、ストリークが常に「1」にリセットされる。

---

## Implementation Steps

### Phase 1: 日付ユーティリティ関数の修正

#### 1.1 `timestampToDateString`関数をJST対応に修正

**File**: `app/(main)/index.tsx` (42-59行目)

```typescript
// 修正前
const timestampToDateString = (timestamp: Timestamp | Date | null | undefined): string | null => {
  // ... ローカルタイムゾーンで処理
  return `${date.getFullYear()}-${...}`;
};

// 修正後
const timestampToDateString = (timestamp: Timestamp | Date | null | undefined): string | null => {
  if (!timestamp) return null;

  let date: Date;
  if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else if (typeof timestamp === 'object' && 'seconds' in timestamp) {
    date = new Date((timestamp as { seconds: number }).seconds * 1000);
  } else {
    console.warn('Unknown timestamp format:', timestamp);
    return null;
  }

  // JSTに変換（+9時間）
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstDate = new Date(date.getTime() + jstOffset);

  return jstDate.toISOString().split('T')[0];
};
```

#### 1.2 `getTodayDateString`関数をJST対応に修正

**File**: `app/(main)/index.tsx` (29-32行目)

```typescript
// 修正前
const getTodayDateString = (): string => {
  const today = new Date();
  return `${today.getFullYear()}-${...}`;
};

// 修正後
const getTodayDateString = (): string => {
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffset);
  return jstNow.toISOString().split('T')[0];
};
```

#### 1.3 `getYesterdayDateString`関数をJST対応に修正

**File**: `app/(main)/index.tsx` (35-39行目)

```typescript
// 修正前
const getYesterdayDateString = (): string => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return `${yesterday.getFullYear()}-${...}`;
};

// 修正後
const getYesterdayDateString = (): string => {
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffset);
  jstNow.setDate(jstNow.getDate() - 1);
  return jstNow.toISOString().split('T')[0];
};
```

### Phase 2: デバッグログの強化

#### 2.1 ストリーク計算時のログ追加

**File**: `app/(main)/index.tsx` (306行目付近)

```typescript
console.log('checkAndUpdateGitHubPush: yesterdayString =', yesterdayString);
console.log('checkAndUpdateGitHubPush: lastStudyDateString =', lastStudyDateString);
console.log('checkAndUpdateGitHubPush: comparison result =', lastStudyDateString === yesterdayString);
```

---

## 修正対象ファイル

| ファイル | 修正内容 |
|---------|----------|
| `app/(main)/index.tsx` | 3つの日付関数をJST対応に修正 |

---

## Success Criteria

- [ ] 2日連続でGitHubにpushした場合、連続学習日数が「2日」と表示される
- [ ] `getTodayDateString()`がJSTで正しい日付を返す
- [ ] `getYesterdayDateString()`がJSTで正しい「昨日」を返す
- [ ] `timestampToDateString()`がFirestore TimestampをJST日付文字列に正しく変換する
- [ ] TypeScript型チェック（`npx tsc --noEmit`）がエラーなしで通る

---

## Risks & Mitigations

| リスク | 対策 |
|-------|------|
| タイムゾーン変換の二重適用 | 常にUTCとして扱い、JSTに変換する |
| Cloud Functionsとの不一致 | 同じ計算方法（`toISOString().split('T')[0]`）を使用 |

---

## 検証方法

1. アプリを開き、コンソールログで日付比較の値を確認
2. Firestoreの`lastStudyDate`の値とクライアント側の計算結果を比較
3. 連続日のpushでストリークが正しくインクリメントされることを確認
