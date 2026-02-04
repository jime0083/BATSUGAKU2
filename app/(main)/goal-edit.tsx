import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';
import { useAuth } from '../../src/contexts/AuthContext';
import { COLORS } from '../../src/constants';

export default function GoalEditScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // フォーム状態
  const [deadline, setDeadline] = useState('');
  const [skill, setSkill] = useState('');
  const [incomeType, setIncomeType] = useState<'monthly' | 'yearly'>('monthly');
  const [targetIncome, setTargetIncome] = useState('');

  // 既存の目標値を読み込む
  useEffect(() => {
    if (user?.goal) {
      const goalDeadline = user.goal.deadline?.toDate?.();
      if (goalDeadline) {
        const year = goalDeadline.getFullYear();
        const month = String(goalDeadline.getMonth() + 1).padStart(2, '0');
        setDeadline(`${year}.${month}`);
      }
      setSkill(user.goal.skills?.[0] || '');
      setIncomeType(user.goal.incomeType || 'monthly');
      setTargetIncome(String(user.goal.targetIncome || ''));
    }
  }, [user?.goal]);

  const handleSubmit = async () => {
    if (!deadline.trim()) {
      Alert.alert('エラー', '目標期限を入力してください');
      return;
    }
    if (!skill.trim()) {
      Alert.alert('エラー', 'スキルを入力してください');
      return;
    }
    if (!targetIncome || isNaN(Number(targetIncome))) {
      Alert.alert('エラー', '目標収入を入力してください');
      return;
    }
    if (!user) return;

    setLoading(true);
    try {
      // deadline を YYYY.MM 形式からDateに変換
      const parts = deadline.split('.');
      const year = Number(parts[0]);
      const month = parts[1] ? Number(parts[1]) - 1 : 0;
      const deadlineDate = new Date(year, month);

      await updateDoc(doc(db, 'users', user.uid), {
        goal: {
          deadline: Timestamp.fromDate(deadlineDate),
          skills: [skill.trim()],
          targetIncome: Number(targetIncome),
          incomeType,
        },
      });

      Alert.alert('完了', '目標を更新しました', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('エラー', '保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const toggleIncomeType = () => {
    setIncomeType((prev) => (prev === 'monthly' ? 'yearly' : 'monthly'));
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ヘッダー */}
          <View style={styles.headerSection}>
            <Text style={styles.headerTitle}>目標を編集</Text>
            <Text style={styles.headerSubtitle}>
              目標を変更すると、達成ツイートのフォーマットも更新されます
            </Text>
          </View>

          {/* フォーム: 文章形式 */}
          <View style={styles.formSection}>
            {/* 行1: [YYYY.MM] までに */}
            <View style={styles.formRow}>
              <View style={styles.dateInputWrapper}>
                <TextInput
                  style={styles.dateInput}
                  value={deadline}
                  onChangeText={setDeadline}
                  placeholder="2026.12"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="numeric"
                />
              </View>
              <Text style={styles.formLabel}>までに</Text>
            </View>

            {/* 行2: [スキル] で */}
            <View style={styles.formRow}>
              <View style={styles.skillInputWrapper}>
                <TextInput
                  style={styles.skillInput}
                  value={skill}
                  onChangeText={setSkill}
                  placeholder="やること・身に付けたいスキル"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
              <Text style={styles.formLabel}>で</Text>
            </View>

            {/* 行3: [月収] [金額] 万円稼げる様になる */}
            <View style={styles.formRow}>
              <TouchableOpacity
                style={styles.incomeTypeTag}
                onPress={toggleIncomeType}
                activeOpacity={0.7}
              >
                <Text style={styles.incomeTypeText}>
                  {incomeType === 'monthly' ? '月収' : '年収'}
                </Text>
              </TouchableOpacity>
              <View style={styles.incomeInputWrapper}>
                <TextInput
                  style={styles.incomeInput}
                  value={targetIncome}
                  onChangeText={setTargetIncome}
                  keyboardType="numeric"
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
              <Text style={styles.formLabel}>万円稼げる様になる</Text>
            </View>
          </View>

          {/* ボタン */}
          <View style={styles.buttonSection}>
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.submitButtonText}>
                {loading ? '保存中...' : '目標を更新'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelButtonText}>キャンセル</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: {
    flex: 1,
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
    marginBottom: 32,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  formSection: {
    gap: 24,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  dateInputWrapper: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 12,
    backgroundColor: COLORS.surface,
  },
  dateInput: {
    fontSize: 16,
    color: COLORS.text,
    minWidth: 80,
  },
  skillInputWrapper: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 8,
    marginRight: 12,
  },
  skillInput: {
    fontSize: 16,
    color: COLORS.text,
  },
  incomeTypeTag: {
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 12,
    backgroundColor: COLORS.surface,
  },
  incomeTypeText: {
    fontSize: 16,
    color: COLORS.accent,
    fontWeight: '600',
  },
  incomeInputWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 8,
    marginRight: 12,
    minWidth: 60,
  },
  incomeInput: {
    fontSize: 16,
    color: COLORS.text,
    textAlign: 'center',
  },
  formLabel: {
    fontSize: 16,
    color: COLORS.text,
  },
  buttonSection: {
    marginTop: 48,
    gap: 12,
  },
  submitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
});
