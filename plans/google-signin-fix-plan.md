# Google Sign-In 修正計画

## エラー概要
- エラー: `401: invalid_client`
- 詳細: `flowName=GeneralOAuthFlow`
- 原因: ネイティブGoogle Sign-Inが正しく動作していない

## 根本原因分析

### 問題1: Google Cloud Console設定の不備
現在のiOSクライアントIDは`518497599552-0k7tnkmrg14h0ulbjsfgurvkmcnu0cf`ですが、
これが正しく設定されているか確認が必要です。

**確認項目:**
- [ ] バンドルID: `com.batsugaku.app` が正しく設定されているか
- [ ] チームID: Apple Developer Team IDが設定されているか（必要な場合）

### 問題2: Firebase Authentication設定
Firebase ConsoleでGoogle Sign-Inプロバイダが有効になっていない可能性があります。

**確認項目:**
- [ ] Firebase Console → Authentication → Sign-in method → Google が有効か
- [ ] iOSクライアントIDがFirebaseに登録されているか

### 問題3: ネイティブ設定ファイルの不足
`@react-native-google-signin/google-signin`は追加の設定ファイルが必要です。

**確認項目:**
- [ ] `GoogleService-Info.plist`がiosプロジェクトに含まれているか
- [ ] Xcodeプロジェクトに正しくリンクされているか

## 修正手順

### Phase 12.6: Google Sign-In詳細修正（新規追加）

#### 12.6.1 GoogleService-Info.plistの追加
1. Firebase Console → プロジェクト設定 → アプリを追加（iOS）
2. バンドルID: `com.batsugaku.app` で登録
3. `GoogleService-Info.plist`をダウンロード
4. `ios/app/`フォルダに配置
5. Xcodeでプロジェクトに追加

#### 12.6.2 Firebase AuthenticationでGoogle有効化
1. Firebase Console → Authentication → Sign-in method
2. Google プロバイダを有効化
3. Web Client IDを設定

#### 12.6.3 app.jsonのextra設定追加
`expo-build-properties`でiOS設定を追加

#### 12.6.4 prebuildの再実行
設定変更後にネイティブプロジェクトを再生成

#### 12.6.5 Xcodeで再ビルド・テスト

## 代替案: expo-auth-sessionに戻す

もしネイティブGoogle Sign-Inの設定が複雑すぎる場合、
`expo-auth-session`を使用したWebビュー認証に戻すことも可能です。

ただし、この場合はEAS Buildでのpreview/productionビルドが必要です。
（Xcodeローカルビルドでは環境変数が正しく埋め込まれない可能性があるため）

## 推奨アクション

1. まず GoogleService-Info.plist を追加
2. Firebase Authentication設定を確認
3. 再prebuild → Xcodeビルド
4. それでも失敗する場合はEAS Build (preview) を使用
