import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';
import { useAuth } from '../../src/contexts/AuthContext';
import { COLORS, SKILL_OPTIONS } from '../../src/constants';

export default function OnboardingScreen() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // フォーム状態
  const [targetIncome, setTargetIncome] = useState('');
  const [incomeType, setIncomeType] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [deadlineDays, setDeadlineDays] = useState('');

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill)
        ? prev.filter((s) => s !== skill)
        : [...prev, skill]
    );
  };

  const handleNext = () => {
    if (step === 1 && (!targetIncome || isNaN(Number(targetIncome)))) {
      Alert.alert('エラー', '目標収入を入力してください');
      return;
    }
    if (step === 2 && selectedSkills.length === 0) {
      Alert.alert('エラー', '少なくとも1つのスキルを選択してください');
      return;
    }
    if (step === 3 && (!deadlineDays || isNaN(Number(deadlineDays)))) {
      Alert.alert('エラー', '目標期限を入力してください');
      return;
    }

    if (step < 4) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + Number(deadlineDays));

      await updateDoc(doc(db, 'users', user.uid), {
        goal: {
          deadline: Timestamp.fromDate(deadline),
          skills: selectedSkills,
          targetIncome: Number(targetIncome),
          incomeType,
        },
        onboardingCompleted: true,
      });

      // メイン画面へ遷移
      router.replace('/(main)');
    } catch (error) {
      console.error('Goal save error:', error);
      Alert.alert('エラー', '保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* 進捗インジケーター */}
        <View style={styles.progressContainer}>
          {[1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                i <= step && styles.progressDotActive,
              ]}
            />
          ))}
        </View>

        {/* Step 1: 目標収入 */}
        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>目標収入を設定</Text>
            <Text style={styles.stepDescription}>
              エンジニアとしていくら稼ぎたいですか？
            </Text>

            <View style={styles.incomeTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.incomeTypeButton,
                  incomeType === 'monthly' && styles.incomeTypeButtonActive,
                ]}
                onPress={() => setIncomeType('monthly')}
              >
                <Text
                  style={[
                    styles.incomeTypeText,
                    incomeType === 'monthly' && styles.incomeTypeTextActive,
                  ]}
                >
                  月収
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.incomeTypeButton,
                  incomeType === 'yearly' && styles.incomeTypeButtonActive,
                ]}
                onPress={() => setIncomeType('yearly')}
              >
                <Text
                  style={[
                    styles.incomeTypeText,
                    incomeType === 'yearly' && styles.incomeTypeTextActive,
                  ]}
                >
                  年収
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={targetIncome}
                onChangeText={setTargetIncome}
                keyboardType="numeric"
                placeholder="100"
                placeholderTextColor={COLORS.textSecondary}
              />
              <Text style={styles.inputSuffix}>万円</Text>
            </View>
          </View>
        )}

        {/* Step 2: 学習スキル */}
        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>学習するスキル</Text>
            <Text style={styles.stepDescription}>
              これから学習するスキルを選択してください（複数可）
            </Text>

            <View style={styles.skillGrid}>
              {SKILL_OPTIONS.map((skill) => (
                <TouchableOpacity
                  key={skill}
                  style={[
                    styles.skillButton,
                    selectedSkills.includes(skill) && styles.skillButtonActive,
                  ]}
                  onPress={() => toggleSkill(skill)}
                >
                  <Text
                    style={[
                      styles.skillText,
                      selectedSkills.includes(skill) && styles.skillTextActive,
                    ]}
                  >
                    {skill}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedSkills.length > 0 && (
              <Text style={styles.selectedText}>
                選択中: {selectedSkills.join(', ')}
              </Text>
            )}
          </View>
        )}

        {/* Step 3: 目標期限 */}
        {step === 3 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>目標期限を設定</Text>
            <Text style={styles.stepDescription}>
              何日後までに目標を達成しますか？
            </Text>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={deadlineDays}
                onChangeText={setDeadlineDays}
                keyboardType="numeric"
                placeholder="90"
                placeholderTextColor={COLORS.textSecondary}
              />
              <Text style={styles.inputSuffix}>日後</Text>
            </View>

            {deadlineDays && !isNaN(Number(deadlineDays)) && (
              <Text style={styles.deadlinePreview}>
                目標日: {new Date(Date.now() + Number(deadlineDays) * 24 * 60 * 60 * 1000).toLocaleDateString('ja-JP')}
              </Text>
            )}
          </View>
        )}

        {/* Step 4: 確認 */}
        {step === 4 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>設定内容の確認</Text>
            <Text style={styles.stepDescription}>
              以下の内容でよろしいですか？
            </Text>

            <View style={styles.confirmCard}>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>目標収入</Text>
                <Text style={styles.confirmValue}>
                  {incomeType === 'monthly' ? '月収' : '年収'}{targetIncome}万円
                </Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>学習スキル</Text>
                <Text style={styles.confirmValue}>
                  {selectedSkills.join(', ')}
                </Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>目標期限</Text>
                <Text style={styles.confirmValue}>
                  {deadlineDays}日後
                </Text>
              </View>
            </View>

            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>注意</Text>
              <Text style={styles.warningText}>
                毎日0:00までにGitHubにpushしないと、{'\n'}
                Xに自動でサボり投稿が投稿されます。
              </Text>
            </View>
          </View>
        )}

        {/* ナビゲーションボタン */}
        <View style={styles.buttonContainer}>
          {step > 1 && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setStep(step - 1)}
            >
              <Text style={styles.backButtonText}>戻る</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextButton, loading && styles.buttonDisabled]}
            onPress={handleNext}
            disabled={loading}
          >
            <Text style={styles.nextButtonText}>
              {loading ? '保存中...' : step === 4 ? '設定を完了' : '次へ'}
            </Text>
          </TouchableOpacity>
        </View>
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
    paddingHorizontal: 24,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 32,
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
  },
  progressDotActive: {
    backgroundColor: COLORS.accent,
    width: 24,
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  incomeTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 12,
  },
  incomeTypeButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  incomeTypeButtonActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  incomeTypeText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  incomeTypeTextActive: {
    color: COLORS.text,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    minWidth: 120,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.accent,
    paddingVertical: 8,
  },
  inputSuffix: {
    fontSize: 24,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  skillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  skillButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  skillButtonActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  skillText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  skillTextActive: {
    color: COLORS.text,
    fontWeight: '600',
  },
  selectedText: {
    fontSize: 12,
    color: COLORS.accent,
    textAlign: 'center',
    marginTop: 24,
  },
  deadlinePreview: {
    fontSize: 16,
    color: COLORS.accent,
    textAlign: 'center',
    marginTop: 24,
  },
  confirmCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  confirmLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  confirmValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    maxWidth: '60%',
    textAlign: 'right',
  },
  warningBox: {
    backgroundColor: COLORS.error + '20',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.error,
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 32,
    marginBottom: 48,
    gap: 12,
  },
  backButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  nextButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
