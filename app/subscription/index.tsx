import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../src/constants';
import { useAuth } from '../../src/contexts/AuthContext';
import { useSubscription } from '../../src/hooks/useSubscription';

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

export default function MandatorySubscriptionScreen() {
  const { user, signOut } = useAuth();
  const subscription = useSubscription(user);
  const { isLoading, error, purchase, restore, getPrice } = subscription;

  const handlePurchase = async () => {
    await purchase();
  };

  const handleRestore = async () => {
    await restore();
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('ログアウトエラー:', err);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* タイトルセクション */}
        <View style={styles.titleSection}>
          <Text style={styles.premiumBadge}>PREMIUM</Text>
          <Text style={styles.title}>バツガク プレミアム</Text>
          <Text style={styles.subtitle}>
            バツガクを利用するには{'\n'}サブスクリプションへの登録が必要です
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

        {/* 注意事項 */}
        <View style={styles.termsSection}>
          <Text style={styles.termsText}>
            購入確認時にiTunesアカウントに請求されます。
            サブスクリプションは現在の期間が終了する24時間前までにキャンセルしない限り、
            自動的に更新されます。
          </Text>
          <View style={styles.termsLinks}>
            <TouchableOpacity>
              <Text style={styles.termLink}>利用規約</Text>
            </TouchableOpacity>
            <Text style={styles.termsDivider}>|</Text>
            <TouchableOpacity>
              <Text style={styles.termLink}>プライバシーポリシー</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ログアウトボタン */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>別のアカウントでログインする</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
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
    paddingTop: 40,
    paddingBottom: 32,
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
    lineHeight: 22,
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
    color: COLORS.text,
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
  termsSection: {
    alignItems: 'center',
    marginBottom: 24,
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
  signOutButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  signOutText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textDecorationLine: 'underline',
  },
});
