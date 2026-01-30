import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { useSubscription } from '../../src/hooks/useSubscription';

const PRIVACY_POLICY_URL = 'https://batugaku2-ad498.web.app/privacy-policy.html';
const TERMS_URL = 'https://batugaku2-ad498.web.app/terms-of-service.html';

export default function SubscriptionScreen() {
  const { user } = useAuth();
  const subscription = useSubscription(user);
  const { isLoading, error, purchase, restore, PRODUCT_IDS } = subscription;

  const [selectedPlan, setSelectedPlan] = useState<'yearly' | 'monthly'>('yearly');

  const handlePurchase = async () => {
    const productId = selectedPlan === 'yearly'
      ? PRODUCT_IDS.YEARLY_3000
      : PRODUCT_IDS.MONTHLY_300;
    await purchase(productId);
  };

  const handleRestore = async () => {
    await restore();
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

          {/* 年額プラン */}
          <TouchableOpacity
            style={[
              styles.planCard,
              selectedPlan === 'yearly' && styles.planCardSelected,
            ]}
            onPress={() => setSelectedPlan('yearly')}
            activeOpacity={0.8}
          >
            {/* 割引バッジ */}
            <View style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>16.7% OFF</Text>
            </View>

            <View style={styles.planCardContent}>
              <Text style={styles.planDuration}>12ヶ月</Text>
              <View style={styles.planPriceContainer}>
                <Text style={styles.planOriginalPrice}>¥3600</Text>
                <Text style={styles.planPrice}>¥3000</Text>
                <Text style={styles.planPricePerMonth}>¥250/月</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* 月額プラン */}
          <TouchableOpacity
            style={[
              styles.planCard,
              selectedPlan === 'monthly' && styles.planCardSelected,
            ]}
            onPress={() => setSelectedPlan('monthly')}
            activeOpacity={0.8}
          >
            <View style={styles.planCardContent}>
              <Text style={styles.planDuration}>1ヶ月</Text>
              <View style={styles.planPriceContainer}>
                <Text style={styles.planPriceMonthly}>¥300/月</Text>
              </View>
            </View>
          </TouchableOpacity>
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
  planDuration: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  planPriceContainer: {
    alignItems: 'flex-end',
  },
  planOriginalPrice: {
    fontSize: 12,
    color: '#999999',
    textDecorationLine: 'line-through',
  },
  planPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  planPricePerMonth: {
    fontSize: 12,
    color: '#666666',
  },
  planPriceMonthly: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
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
