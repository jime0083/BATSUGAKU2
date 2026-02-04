import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { COLORS } from '../../src/constants';
import { useSubscription } from '../../src/hooks/useSubscription';
import { getSubscriptionDaysRemaining } from '../../src/lib/subscription';

export default function SubscriptionCancelScreen() {
  const { user } = useAuth();
  const subscription = useSubscription(user);

  const handleOpenSubscriptionSettings = async () => {
    try {
      // App Storeのサブスクリプション管理画面を開く
      await Linking.openURL('https://apps.apple.com/account/subscriptions');
    } catch (error) {
      Alert.alert(
        'エラー',
        'サブスクリプション管理画面を開けませんでした。設定アプリから直接開いてください。'
      );
    }
  };

  const daysRemaining = user?.subscription ? getSubscriptionDaysRemaining(user.subscription) : 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ヘッダー */}
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>サブスクリプションの解約</Text>
        </View>

        {/* 現在のステータス */}
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>現在のプラン</Text>
          <Text style={styles.statusValue}>
            {subscription.isPremium ? 'プレミアム会員' : 'フリー'}
          </Text>
          {subscription.isPremium && user?.subscription && (
            <Text style={styles.statusExpiry}>
              有効期限まであと {daysRemaining} 日
            </Text>
          )}
        </View>

        {/* 解約に関する注意事項 */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>解約について</Text>

          <View style={styles.infoItem}>
            <Text style={styles.infoBullet}>•</Text>
            <Text style={styles.infoText}>
              サブスクリプションはApp Storeから解約できます
            </Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoBullet}>•</Text>
            <Text style={styles.infoText}>
              解約しても、現在の有効期限（{daysRemaining}日後）まではプレミアム機能を利用できます
            </Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoBullet}>•</Text>
            <Text style={styles.infoText}>
              有効期限が過ぎると、自動的にフリープランに戻ります
            </Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoBullet}>•</Text>
            <Text style={styles.infoText}>
              フリープランでは日次チェック機能や自動ツイート機能が利用できなくなります
            </Text>
          </View>
        </View>

        {/* 解約手順 */}
        <View style={styles.stepsSection}>
          <Text style={styles.stepsTitle}>解約手順</Text>

          <View style={styles.stepItem}>
            <Text style={styles.stepNumber}>1</Text>
            <Text style={styles.stepText}>
              下のボタンをタップして、App Storeのサブスクリプション管理画面を開きます
            </Text>
          </View>
          <View style={styles.stepItem}>
            <Text style={styles.stepNumber}>2</Text>
            <Text style={styles.stepText}>
              「バツガク」を選択します
            </Text>
          </View>
          <View style={styles.stepItem}>
            <Text style={styles.stepNumber}>3</Text>
            <Text style={styles.stepText}>
              「サブスクリプションをキャンセルする」をタップします
            </Text>
          </View>
        </View>

        {/* ボタン */}
        <View style={styles.buttonSection}>
          {subscription.isPremium && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleOpenSubscriptionSettings}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelButtonText}>App Storeで解約する</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={styles.backButtonText}>戻る</Text>
          </TouchableOpacity>
        </View>

        {/* 非プレミアムユーザー向けメッセージ */}
        {!subscription.isPremium && (
          <View style={styles.notPremiumCard}>
            <Text style={styles.notPremiumText}>
              現在サブスクリプションに加入していません
            </Text>
          </View>
        )}
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
    paddingBottom: 40,
  },
  headerSection: {
    marginTop: 24,
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  statusCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  statusLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  statusExpiry: {
    fontSize: 14,
    color: COLORS.warning,
    marginTop: 8,
  },
  infoSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  infoBullet: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginRight: 8,
    width: 16,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  stepsSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
  },
  stepsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  stepItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 24,
    marginRight: 12,
  },
  stepText: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
    lineHeight: 20,
  },
  buttonSection: {
    gap: 12,
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.error,
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  backButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  notPremiumCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 20,
    marginTop: 24,
    alignItems: 'center',
  },
  notPremiumText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});
