import { Modal, View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import LottieView from 'lottie-react-native';
import { useMemo } from 'react';

// アニメーションファイル
const ANIMATIONS = [
  require('../../assets/animations/dog.json'),
  require('../../assets/animations/bear.json'),
  require('../../assets/animations/birds.json'),
  require('../../assets/animations/monkey.json'),
  require('../../assets/animations/Raccoon.json'),
];

// 連続達成メッセージ
const STREAK_MESSAGES = [
  (days: number) => `${days}日連続達成！\n目標達成に向けて継続できています！`,
  (days: number) => `${days}日連続達成！\n継続できてる自分を誇ってください！`,
];

// 累計達成メッセージ
const TOTAL_MESSAGES = [
  (days: number) => `累計${days}日達成！\n今日も頑張るあなたは本当に素敵です`,
  (days: number) => `累計${days}日達成！\n目標達成に着実に近づいています！`,
];

// 通常メッセージ
const NORMAL_MESSAGES = [
  '今日もお疲れ様！\n目標達成に着実に近づいています！',
  'ナイス継続！\n確実に成長につながっています！',
  '今日のチャレンジ完了！\nその積み重ねが未来を変えていきます！',
];

// 達成タイプ
export type AchievementType = 'streak' | 'total' | 'normal';

export interface PushSuccessModalProps {
  visible: boolean;
  onClose: () => void;
  achievementType: AchievementType;
  streakDays?: number;
  totalDays?: number;
}

/**
 * ランダムに配列の要素を選択
 */
function getRandomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Push成功時に表示するモーダル
 */
export function PushSuccessModal({
  visible,
  onClose,
  achievementType,
  streakDays = 0,
  totalDays = 0,
}: PushSuccessModalProps) {
  // アニメーションとメッセージをランダムに選択（モーダル表示時に固定）
  const { animation, message } = useMemo(() => {
    const selectedAnimation = getRandomItem(ANIMATIONS);
    let selectedMessage: string;

    switch (achievementType) {
      case 'streak':
        selectedMessage = getRandomItem(STREAK_MESSAGES)(streakDays);
        break;
      case 'total':
        selectedMessage = getRandomItem(TOTAL_MESSAGES)(totalDays);
        break;
      default:
        selectedMessage = getRandomItem(NORMAL_MESSAGES);
    }

    return { animation: selectedAnimation, message: selectedMessage };
  }, [achievementType, streakDays, totalDays, visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* キャラクターアニメーション */}
          <View style={styles.animationContainer}>
            <LottieView
              source={animation}
              autoPlay
              loop
              style={styles.animation}
            />
          </View>

          {/* メッセージ */}
          <Text style={styles.message}>{message}</Text>

          {/* 閉じるボタン */}
          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>閉じる</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: SCREEN_WIDTH * 0.85,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  animationContainer: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  animation: {
    width: 200,
    height: 200,
  },
  message: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
    lineHeight: 28,
  },
  button: {
    width: '100%',
    backgroundColor: '#4285F4',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
