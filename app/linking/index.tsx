import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';

export default function LinkingScreen() {
  const { user, linkXAccount, linkGitHubAccount } = useAuth();
  const [xLoading, setXLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);

  const xLinked = user?.xLinked ?? false;
  const githubLinked = user?.githubLinked ?? false;

  // 両方連携完了したら自動遷移
  useEffect(() => {
    if (xLinked && githubLinked) {
      const timer = setTimeout(() => {
        router.replace('/subscription');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [xLinked, githubLinked]);

  const handleLinkX = async () => {
    if (xLinked) return;
    setXLoading(true);
    try {
      await linkXAccount();
    } catch (error) {
      Alert.alert('エラー', 'X（Twitter）との連携に失敗しました。もう一度お試しください。');
    } finally {
      setXLoading(false);
    }
  };

  const handleLinkGitHub = async () => {
    if (githubLinked) return;
    setGithubLoading(true);
    try {
      await linkGitHubAccount();
    } catch (error) {
      Alert.alert('エラー', 'GitHubとの連携に失敗しました。もう一度お試しください。');
    } finally {
      setGithubLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Lottieアニメーション */}
        <View style={styles.animationContainer}>
          <LottieView
            source={require('../../assets/animations/contact us.json')}
            autoPlay
            loop
            style={styles.animation}
          />
        </View>

        {/* タイトル */}
        <View style={styles.titleSection}>
          <Text style={styles.titleText}>X・Githubと連携して</Text>
          <Text style={styles.titleText}>サボりを防止しましょう</Text>
        </View>

        {/* 説明文 */}
        <View style={styles.descriptionSection}>
          <Text style={styles.descriptionText}>サボったらXで自動的に投稿され</Text>
          <Text style={styles.descriptionText}>サボったことが全フォロワーにバレます</Text>
        </View>

        {/* 連携ボタン */}
        <View style={styles.buttonsSection}>
          {/* X連携ボタン */}
          <TouchableOpacity
            style={[
              styles.outlineButton,
              xLinked && styles.linkedButton,
            ]}
            onPress={handleLinkX}
            disabled={xLinked || xLoading}
            activeOpacity={0.8}
          >
            {xLoading ? (
              <ActivityIndicator size="small" color="#1a3fc7" />
            ) : (
              <Text style={[styles.outlineButtonText, xLinked && styles.linkedButtonText]}>
                {xLinked ? 'X連携済み ✓' : 'Xと連携'}
              </Text>
            )}
          </TouchableOpacity>

          {/* GitHub連携ボタン */}
          <TouchableOpacity
            style={[
              styles.filledButton,
              githubLinked && styles.linkedButton,
            ]}
            onPress={handleLinkGitHub}
            disabled={githubLinked || githubLoading}
            activeOpacity={0.8}
          >
            {githubLoading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={[styles.filledButtonText, githubLinked && styles.linkedButtonText]}>
                {githubLinked ? 'Github連携済み ✓' : 'Githubと連携'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
  },
  animationContainer: {
    alignItems: 'center',
    marginTop: 30,
    height: 240,
  },
  animation: {
    width: 280,
    height: 240,
  },
  titleSection: {
    marginTop: 24,
    marginBottom: 12,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    lineHeight: 32,
  },
  descriptionSection: {
    marginBottom: 32,
  },
  descriptionText: {
    fontSize: 14,
    color: '#999999',
    lineHeight: 22,
  },
  buttonsSection: {
    gap: 16,
  },
  outlineButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#1a3fc7',
  },
  outlineButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a3fc7',
  },
  filledButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a3fc7',
    paddingVertical: 16,
    borderRadius: 30,
  },
  filledButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  linkedButton: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4caf50',
    borderWidth: 2,
  },
  linkedButtonText: {
    color: '#4caf50',
  },
});
