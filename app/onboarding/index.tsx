import { useState } from 'react';
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
import LottieView from 'lottie-react-native';
import { db } from '../../src/lib/firebase';
import { useAuth } from '../../src/contexts/AuthContext';

export default function OnboardingScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // フォーム状態
  const [deadline, setDeadline] = useState('');
  const [skill, setSkill] = useState('');
  const [incomeType, setIncomeType] = useState<'monthly' | 'yearly'>('monthly');
  const [targetIncome, setTargetIncome] = useState('');

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
        onboardingCompleted: true,
      });

      // _layoutで自動的にlinking画面に遷移するが、明示的に遷移
      router.replace('/linking');
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
    <SafeAreaView style={styles.container}>
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
          {/* Lottieアニメーション */}
          <View style={styles.animationContainer}>
            <LottieView
              source={require('../../assets/animations/Blog Page.json')}
              autoPlay
              loop
              style={styles.animation}
            />
          </View>

          {/* タイトル */}
          <View style={styles.titleSection}>
            <Text style={styles.titleText}>
              <Text style={styles.titleBold}>目標</Text>を設定
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
                  placeholderTextColor="#bbb"
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
                  placeholderTextColor="#bbb"
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
                  placeholderTextColor="#bbb"
                />
              </View>
              <Text style={styles.formLabel}>万円稼げる様になる</Text>
            </View>
          </View>

          {/* 送信ボタン */}
          <View style={styles.buttonSection}>
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.submitButtonText}>
                {loading ? '保存中...' : '目標を設定'}
              </Text>
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
    backgroundColor: '#ffffff',
  },
  flex: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  animationContainer: {
    alignItems: 'center',
    marginTop: 10,
    height: 260,
  },
  animation: {
    width: 320,
    height: 260,
  },
  titleSection: {
    marginTop: 16,
    marginBottom: 24,
  },
  titleText: {
    fontSize: 24,
    fontWeight: '400',
    color: '#1a1a1a',
  },
  titleBold: {
    fontWeight: '800',
  },
  formSection: {
    gap: 20,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  dateInputWrapper: {
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 10,
  },
  dateInput: {
    fontSize: 15,
    color: '#1a1a1a',
    minWidth: 70,
  },
  skillInputWrapper: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
    paddingBottom: 6,
    marginRight: 10,
  },
  skillInput: {
    fontSize: 15,
    color: '#1a1a1a',
  },
  incomeTypeTag: {
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 10,
  },
  incomeTypeText: {
    fontSize: 15,
    color: '#1a1a1a',
  },
  incomeInputWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
    paddingBottom: 6,
    marginRight: 10,
    minWidth: 60,
  },
  incomeInput: {
    fontSize: 15,
    color: '#1a1a1a',
    textAlign: 'center',
  },
  formLabel: {
    fontSize: 15,
    color: '#1a1a1a',
  },
  buttonSection: {
    marginTop: 36,
  },
  submitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a3fc7',
    paddingVertical: 16,
    borderRadius: 30,
    width: '100%',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
