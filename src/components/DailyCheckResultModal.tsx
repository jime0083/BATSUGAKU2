import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { COLORS } from '../constants';
import { DailyCheckResultDisplay } from '../hooks/useDailyCheck';

interface DailyCheckResultModalProps {
  visible: boolean;
  result: DailyCheckResultDisplay | null;
  onClose: () => void;
}

export function DailyCheckResultModal({
  visible,
  result,
  onClose,
}: DailyCheckResultModalProps) {
  if (!result) {
    return null;
  }

  const isSuccess = result.hasPushed;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* ヘッダー */}
          <View style={[styles.header, isSuccess ? styles.headerSuccess : styles.headerSkip]}>
            <Text style={styles.headerEmoji}>
              {isSuccess ? '🎉' : '😱'}
            </Text>
            <Text style={styles.headerTitle}>
              {isSuccess ? '学習確認完了！' : 'サボり検出...'}
            </Text>
          </View>

          {/* 結果詳細 */}
          <View style={styles.content}>
            {isSuccess ? (
              <>
                <Text style={styles.message}>
                  今日もGitHubへのpushを確認しました！
                </Text>
                <View style={styles.streakContainer}>
                  <Text style={styles.streakLabel}>現在の連続日数</Text>
                  <Text style={styles.streakValue}>{result.newStreak}日</Text>
                </View>

                {result.streakMilestone && (
                  <View style={styles.milestoneContainer}>
                    <Text style={styles.milestoneText}>
                      🏆 {result.streakMilestone}日連続達成！
                    </Text>
                    {result.tweetedStreak && (
                      <Text style={styles.tweetedText}>
                        達成ツイートを投稿しました
                      </Text>
                    )}
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={styles.message}>
                  今日はGitHubへのpushが確認できませんでした...
                </Text>
                <View style={styles.skipContainer}>
                  <Text style={styles.skipText}>連続記録がリセットされました</Text>
                </View>

                {result.tweetedSkip && (
                  <View style={styles.tweetedContainer}>
                    <Text style={styles.tweetedWarning}>
                      ⚠️ サボりツイートが投稿されました
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* 獲得バッジ */}
            {result.earnedBadges.length > 0 && (
              <View style={styles.badgesContainer}>
                <Text style={styles.badgesTitle}>🏅 新しいバッジを獲得！</Text>
                {result.earnedBadges.map((badge, index) => (
                  <Text key={index} style={styles.badgeItem}>
                    • {badge}
                  </Text>
                ))}
              </View>
            )}
          </View>

          {/* 閉じるボタン */}
          <TouchableOpacity
            style={[styles.closeButton, isSuccess ? styles.closeButtonSuccess : styles.closeButtonSkip]}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>閉じる</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    width: '100%',
    maxWidth: 340,
    overflow: 'hidden',
  },
  header: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  headerSuccess: {
    backgroundColor: COLORS.success,
  },
  headerSkip: {
    backgroundColor: COLORS.error,
  },
  headerEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  content: {
    padding: 24,
  },
  message: {
    fontSize: 14,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  streakContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  streakLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  streakValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  milestoneContainer: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  milestoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.success,
  },
  tweetedText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  skipContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  skipText: {
    fontSize: 14,
    color: COLORS.error,
  },
  tweetedContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  tweetedWarning: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.error,
  },
  badgesContainer: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  badgesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.warning,
    marginBottom: 8,
  },
  badgeItem: {
    fontSize: 14,
    color: COLORS.text,
    marginLeft: 8,
  },
  closeButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 12,
  },
  closeButtonSuccess: {
    backgroundColor: COLORS.success,
  },
  closeButtonSkip: {
    backgroundColor: COLORS.error,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
