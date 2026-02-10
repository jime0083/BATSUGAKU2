import { View, Text, StyleSheet, ScrollView, Image, ImageSourcePropType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import { BADGES } from '../../src/constants';

// 統一カラーパレット
const COLORS = {
  background: '#FFFFFF',
  surface: '#F5F5F5',
  text: '#000000',
  textSecondary: '#666666',
  accent: '#4285F4',
  border: '#E0E0E0',
  success: '#4CAF50',
};

// バッジ画像のマッピング（React Nativeでは動的requireが使えないため）
const BADGE_IMAGES: { [key: string]: ImageSourcePropType } = {
  // 連続学習日数バッジ
  '2-3.png': require('../../assets/images/2-3.png'),
  '2-5.png': require('../../assets/images/2-5.png'),
  '2-10.png': require('../../assets/images/2-10.png'),
  '2-15.png': require('../../assets/images/2-15.png'),
  '2-20.png': require('../../assets/images/2-20.png'),
  '2-25.png': require('../../assets/images/2-25.png'),
  '2-30.png': require('../../assets/images/2-30.png'),
  '2-35.png': require('../../assets/images/2-35.png'),
  '2-40.png': require('../../assets/images/2-40.png'),
  '2-50.png': require('../../assets/images/2-50.png'),
  // 累計学習日数バッジ
  '1-5.png': require('../../assets/images/1-5.png'),
  '1-10.png': require('../../assets/images/1-10.png'),
  '1-20.png': require('../../assets/images/1-20.png'),
  '1-30.png': require('../../assets/images/1-30.png'),
  '1-40.png': require('../../assets/images/1-40.png'),
  '1-50.png': require('../../assets/images/1-50.png'),
  '1-60.png': require('../../assets/images/1-60.png'),
  '1-70.png': require('../../assets/images/1-70.png'),
  '1-80.png': require('../../assets/images/1-80.png'),
  '1-90.png': require('../../assets/images/1-90.png'),
  '1-100.png': require('../../assets/images/1-100.png'),
  // 累計サボり日数バッジ
  '3-d.png': require('../../assets/images/3-d.png'),
  '3-3.png': require('../../assets/images/3-3.png'),
  '3-5.png': require('../../assets/images/3-5.png'),
  '3-10.png': require('../../assets/images/3-10.png'),
  '3-15.png': require('../../assets/images/3-15.png'),
  '3-20.png': require('../../assets/images/3-20.png'),
  '3-25.png': require('../../assets/images/3-25.png'),
  '3-30.png': require('../../assets/images/3-30.png'),
};

interface BadgeItem {
  id: string;
  name: string;
  requirement: number;
  image: string;
  category: string;
}

export default function BadgesScreen() {
  const { user } = useAuth();
  const userBadges = user?.badges || [];

  // バッジをカテゴリごとにフラット化
  const allBadges: BadgeItem[] = [
    ...BADGES.streak.map((b) => ({ ...b, category: 'streak' })),
    ...BADGES.totalStudy.map((b) => ({ ...b, category: 'totalStudy' })),
    ...BADGES.totalSkip.map((b) => ({ ...b, category: 'totalSkip' })),
  ];

  const getCategoryTitle = (category: string) => {
    switch (category) {
      case 'streak':
        return '連続学習日数';
      case 'totalStudy':
        return '累計学習日数';
      case 'totalSkip':
        return '累計サボり日数';
      default:
        return 'その他';
    }
  };

  const renderBadge = ({ item }: { item: BadgeItem }) => {
    const isEarned = userBadges.includes(item.id);
    const imageSource = BADGE_IMAGES[item.image];

    return (
      <View style={[styles.badgeCard, !isEarned && styles.badgeCardLocked]}>
        {imageSource && (
          <Image
            source={imageSource}
            style={[styles.badgeImage, !isEarned && styles.badgeImageLocked]}
            resizeMode="contain"
          />
        )}
        <Text style={[styles.badgeName, !isEarned && styles.badgeNameLocked]}>
          {item.name}
        </Text>
      </View>
    );
  };

  // カテゴリごとにグループ化
  const categories = ['streak', 'totalStudy', 'totalSkip'];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* 獲得バッジ数 */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{userBadges.length}</Text>
          <Text style={styles.summaryLabel}>/ {allBadges.length} バッジ獲得</Text>
        </View>

        {/* カテゴリごとのバッジ一覧 */}
        {categories.map((category) => {
          const categoryBadges = allBadges.filter((b) => b.category === category);
          return (
            <View key={category} style={styles.categorySection}>
              <Text style={styles.categoryTitle}>{getCategoryTitle(category)}</Text>
              <View style={styles.badgeGrid}>
                {categoryBadges.map((badge) => (
                  <View key={badge.id} style={styles.badgeWrapper}>
                    {renderBadge({ item: badge })}
                  </View>
                ))}
              </View>
            </View>
          );
        })}
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
    paddingHorizontal: 16,
  },
  summaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  summaryValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.accent,
  },
  summaryLabel: {
    fontSize: 18,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  badgeWrapper: {
    width: '33.33%',
    padding: 6,
  },
  badgeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  badgeCardLocked: {
    borderColor: COLORS.border,
    opacity: 0.5,
  },
  badgeImage: {
    width: 48,
    height: 48,
    marginBottom: 8,
  },
  badgeImageLocked: {
    opacity: 0.3,
  },
  badgeName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  badgeNameLocked: {
    color: COLORS.textSecondary,
  },
  badgeRequirement: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
});
