import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { useSubscription } from '../../src/hooks/useSubscription';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';

const PRIVACY_POLICY_URL = 'https://batugaku2-ad498.web.app/privacy-policy.html';
const TERMS_URL = 'https://batugaku2-ad498.web.app/terms-of-service.html';

export default function SubscriptionScreen() {
  const { user, updateUser } = useAuth();
  const subscription = useSubscription(user);
  const { isLoading, error, purchase, restore, PRODUCT_IDS } = subscription;

  const handlePurchase = async () => {
    try {
      const success = await purchase(PRODUCT_IDS.MONTHLY_300);

      if (success && user) {
        // Firestoreから最新のユーザーデータを取得してローカル状態を更新
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          updateUser({
            subscription: userData.subscription,
          });
        }
      }
    } catch (err) {
      console.error('Purchase error:', err);
      Alert.alert('エラー', '購入処理中にエラーが発生しました。');
    }
  };

  const handleRestore = async () => {
    try {
      const success = await restore();

      if (success && user) {
        // Firestoreから最新のユーザーデータを取得してローカル状態を更新
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          updateUser({
            subscription: userData.subscription,
          });
        }
        Alert.alert('成功', '購入を復元しました。');
      } else {
        Alert.alert('情報', '復元できる購入が見つかりませんでした。');
      }
    } catch (err) {
      console.error('Restore error:', err);
      Alert.alert('エラー', '復元処理中にエラーが発生しました。');
    }
  };

  const handleOpenTerms = () => {
    Linking.openURL(TERMS_URL);
  };

  const handleOpenPrivacy = () => {
    Linking.openURL(PRIVACY_POLICY_URL);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ヘッダーセクション: タイトル + アニメーション */}
        <View style={styles.headerSection}>
          <View style={styles.titleContainer}>
            <Text style={styles.titleLine}>絶対にサボれない環境で</Text>
            <Text style={styles.titleLine}>学習習慣を身に付け</Text>
            <Text style={styles.titleLine}>収入UP!!</Text>
          </View>
          <View style={styles.animationContainer}>
            <LottieView
              source={require('../../assets/animations/Meta animation.json')}
              autoPlay
              loop
              style={styles.animation}
            />
          </View>
        </View>

        {/* プランセクション */}
        <View style={styles.planSection}>
          <Text style={styles.planLabel}>プラン</Text>

          {/* 月額プラン */}
          <View style={[styles.planCard, styles.planCardSelected]}>
            <View style={styles.planCardContent}>
              <View>
                <Text style={styles.planName}>バツガクプレミアム</Text>
                <Text style={styles.planDuration}>月額プラン</Text>
              </View>
              <View style={styles.planPriceContainer}>
                <Text style={styles.planPrice}>¥300</Text>
                <Text style={styles.planPriceUnit}>/月</Text>
              </View>
            </View>
          </View>

          {/* サブスクリプション詳細情報 */}
          <View style={styles.subscriptionDetails}>
            <Text style={styles.subscriptionDetailItem}>• サブスクリプション期間: 1ヶ月</Text>
            <Text style={styles.subscriptionDetailItem}>• 価格: 月額¥300（税込）</Text>
            <Text style={styles.subscriptionDetailItem}>• 自動更新: 期間終了の24時間前までにキャンセルしない限り自動更新</Text>
          </View>
        </View>

        {/* エラー表示 */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error.message}</Text>
          </View>
        )}

        {/* 購入ボタン */}
        <View style={styles.buttonSection}>
          <TouchableOpacity
            style={[styles.purchaseButton, isLoading && styles.buttonDisabled]}
            onPress={handlePurchase}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.purchaseButtonText}>登録して学習開始</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.restoreButton, isLoading && styles.buttonDisabled]}
            onPress={handleRestore}
            disabled={isLoading}
          >
            <Text style={styles.restoreButtonText}>購入を復元</Text>
          </TouchableOpacity>
        </View>

        {/* 注意事項 */}
        <View style={styles.termsSection}>
          <Text style={styles.termsText}>
            購入確認時にApple IDアカウントに請求されます。
            サブスクリプションは現在の期間が終了する24時間前までにキャンセルしない限り自動的に更新されます。
            アカウント設定からいつでもキャンセルできます。
          </Text>
        </View>

        {/* フッター */}
        <View style={styles.footer}>
          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={handleOpenTerms}>
              <Text style={styles.footerLinkText}>利用規約</Text>
            </TouchableOpacity>
            <Text style={styles.footerSpacer}>{'    '}</Text>
            <TouchableOpacity onPress={handleOpenPrivacy}>
              <Text style={styles.footerLinkText}>プライバシーポリシー</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  titleContainer: {
    flex: 1,
  },
  titleLine: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a1a',
    lineHeight: 28,
  },
  animationContainer: {
    width: 100,
    height: 80,
  },
  animation: {
    width: 100,
    height: 80,
  },
  planSection: {
    marginBottom: 24,
  },
  planLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
  },
  planCard: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    position: 'relative',
  },
  planCardSelected: {
    borderColor: '#1a3fc7',
    borderWidth: 2,
  },
  discountBadge: {
    position: 'absolute',
    top: -10,
    left: 12,
    backgroundColor: '#00bcd4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  discountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  planCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  planDuration: {
    fontSize: 14,
    color: '#666666',
  },
  planPriceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  planPrice: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  planPriceUnit: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 2,
  },
  subscriptionDetails: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  subscriptionDetailItem: {
    fontSize: 12,
    color: '#666666',
    lineHeight: 20,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#d32f2f',
    textAlign: 'center',
  },
  buttonSection: {
    marginBottom: 32,
  },
  purchaseButton: {
    backgroundColor: '#4a7aff',
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  purchaseButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  restoreButtonText: {
    fontSize: 14,
    color: '#999999',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  termsSection: {
    marginBottom: 16,
  },
  termsText: {
    fontSize: 11,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 16,
  },
  footer: {
    alignItems: 'center',
    marginTop: 24,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerLinkText: {
    fontSize: 12,
    color: '#999999',
  },
  footerSpacer: {
    fontSize: 12,
  },
});
