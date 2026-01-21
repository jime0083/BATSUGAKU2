import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { User } from '../types';
import { useDailyCheck } from '../hooks/useDailyCheck';
import { hasPremiumAccess } from '../lib/subscription';
import { COLORS } from '../constants';

interface DailyCheckButtonProps {
  user: User | null;
  onCheckComplete?: () => void;
  onShowResult?: (result: ReturnType<typeof useDailyCheck>['lastResult']) => void;
  onShowPaywall?: () => void;
}

export function DailyCheckButton({
  user,
  onCheckComplete,
  onShowResult,
  onShowPaywall,
}: DailyCheckButtonProps) {
  const {
    isChecking,
    hasCheckedToday,
    canCheck,
    cannotCheckReason,
    lastResult,
    error,
    performCheck,
    refreshStatus,
  } = useDailyCheck(user);

  // プレミアムアクセスがないか確認
  const needsSubscription = user && !hasPremiumAccess(user);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (lastResult && onShowResult) {
      onShowResult(lastResult);
    }
  }, [lastResult, onShowResult]);

  const handlePress = async () => {
    // サブスクリプションが必要な場合はPaywallを表示
    if (needsSubscription && onShowPaywall) {
      onShowPaywall();
      return;
    }

    const result = await performCheck();
    if (result && onCheckComplete) {
      onCheckComplete();
    }
  };

  const getButtonStyle = () => {
    if (isChecking) {
      return [styles.button, styles.buttonChecking];
    }
    if (hasCheckedToday) {
      return [styles.button, styles.buttonChecked];
    }
    if (needsSubscription) {
      return [styles.button, styles.buttonUpgrade];
    }
    if (!canCheck) {
      return [styles.button, styles.buttonDisabled];
    }
    return [styles.button, styles.buttonActive];
  };

  const getButtonText = () => {
    if (isChecking) {
      return 'チェック中...';
    }
    if (hasCheckedToday) {
      return '今日のチェック完了 ✓';
    }
    if (needsSubscription) {
      return 'プレミアムにアップグレード';
    }
    return '今日の学習をチェック';
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={getButtonStyle()}
        onPress={handlePress}
        disabled={(!canCheck && !needsSubscription) || isChecking}
        activeOpacity={0.7}
      >
        {isChecking ? (
          <View style={styles.buttonContent}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.buttonText}>{getButtonText()}</Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>{getButtonText()}</Text>
        )}
      </TouchableOpacity>

      {cannotCheckReason && !hasCheckedToday && (
        <Text style={styles.reasonText}>{cannotCheckReason}</Text>
      )}

      {error && (
        <Text style={styles.errorText}>{error.message}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonActive: {
    backgroundColor: COLORS.accent,
  },
  buttonChecking: {
    backgroundColor: COLORS.accent,
    opacity: 0.7,
  },
  buttonChecked: {
    backgroundColor: COLORS.success,
  },
  buttonDisabled: {
    backgroundColor: COLORS.border,
  },
  buttonUpgrade: {
    backgroundColor: COLORS.warning,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  reasonText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
});
