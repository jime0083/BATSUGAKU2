import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Modal,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants';
import { UseSubscriptionReturn } from '../hooks/useSubscription';

const PRIVACY_POLICY_URL = 'https://batugaku2-ad498.web.app/privacy-policy.html';
const TERMS_URL = 'https://batugaku2-ad498.web.app/terms-of-service.html';

interface PaywallScreenProps {
  visible: boolean;
  onClose: () => void;
  subscription: UseSubscriptionReturn;
}

interface FeatureItemProps {
  icon: string;
  title: string;
  description: string;
}

function FeatureItem({ icon, title, description }: FeatureItemProps) {
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <View style={styles.featureContent}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );
}

export function PaywallScreen({ visible, onClose, subscription }: PaywallScreenProps) {
  const { isLoading, error, purchase, restore, getPrice, PRODUCT_IDS } = subscription;

  const handlePurchase = async () => {
    const success = await purchase(PRODUCT_IDS.MONTHLY_300);
    if (success) {
      onClose();
    }
  };

  const handleRestore = async () => {
    const success = await restore();
    if (success) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ヘッダー */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </View>

          {/* タイトル */}
          <View style={styles.titleSection}>
            <Text style={styles.premiumBadge}>PREMIUM</Text>
            <Text style={styles.title}>バツガク プレミアム</Text>
            <Text style={styles.subtitle}>
              学習の継続をサポートする全機能が使えます
            </Text>
          </View>

          {/* 機能一覧 */}
          <View style={styles.featuresSection}>
            <FeatureItem
              icon="📊"
              title="日次チェック機能"
              description="毎日のGitHub push状況を自動でチェック"
            />
            <FeatureItem
              icon="🐦"
              title="自動ツイート投稿"
              description="サボり時の自動投稿でモチベーション維持"
            />
            <FeatureItem
              icon="🔥"
              title="ストリーク追跡"
              description="連続学習日数を記録し達成をお祝い"
            />
            <FeatureItem
              icon="🏆"
              title="バッジ獲得"
              description="学習実績に応じたバッジを獲得"
            />
            <FeatureItem
              icon="📈"
              title="詳細統計"
              description="月別・累計の学習状況を可視化"
            />
            <FeatureItem
              icon="🔔"
              title="リマインダー通知"
              description="学習忘れ防止の通知機能"
            />
          </View>

          {/* 価格セクション */}
          <View style={styles.priceSection}>
            <Text style={styles.priceLabel}>月額</Text>
            <Text style={styles.price}>{getPrice()}</Text>
            <Text style={styles.priceNote}>いつでもキャンセル可能</Text>
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
            >
              {isLoading ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <Text style={styles.purchaseButtonText}>プレミアムに登録</Text>
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

          {/* サブスクリプション詳細 */}
          <View style={styles.subscriptionDetails}>
            <Text style={styles.subscriptionDetailItem}>• サブスクリプション名: バツガクプレミアム（月額）</Text>
            <Text style={styles.subscriptionDetailItem}>• 期間: 1ヶ月</Text>
            <Text style={styles.subscriptionDetailItem}>• 価格: {getPrice()}/月（税込）</Text>
          </View>

          {/* 注意事項 */}
          <View style={styles.termsSection}>
            <Text style={styles.termsText}>
              購入確認時にApple IDアカウントに請求されます。
              サブスクリプションは現在の期間が終了する24時間前までにキャンセルしない限り、
              自動的に更新されます。アカウント設定からいつでもキャンセルできます。
            </Text>
            <View style={styles.termsLinks}>
              <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
                <Text style={styles.termLink}>利用規約</Text>
              </TouchableOpacity>
              <Text style={styles.termsDivider}>|</Text>
              <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
                <Text style={styles.termLink}>プライバシーポリシー</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 8,
    paddingBottom: 16,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: COLORS.text,
    lineHeight: 28,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  premiumBadge: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.accent,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  featuresSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  priceSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  priceLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  price: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.accent,
    marginBottom: 4,
  },
  priceNote: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    backgroundColor: COLORS.error + '20',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    textAlign: 'center',
  },
  buttonSection: {
    marginBottom: 24,
  },
  purchaseButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  purchaseButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  restoreButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  restoreButtonText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  subscriptionDetails: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  subscriptionDetailItem: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  termsSection: {
    alignItems: 'center',
  },
  termsText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 8,
  },
  termsLinks: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  termLink: {
    fontSize: 11,
    color: COLORS.accent,
  },
  termsDivider: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginHorizontal: 8,
  },
});
