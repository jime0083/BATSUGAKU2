import { View, Text, StyleSheet, ScrollView, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import { COLORS, BADGES } from '../../src/constants';

interface BadgeItem {
  id: string;
  name: string;
  requirement: number;
  icon: string;
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

  const getIconEmoji = (icon: string) => {
    const icons: { [key: string]: string } = {
      flame: '🔥',
      fire: '🔥',
      crown: '👑',
      star: '⭐',
      trophy: '🏆',
      skull: '💀',
    };
    return icons[icon] || '🏅';
  };

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

    return (
      <View style={[styles.badgeCard, !isEarned && styles.badgeCardLocked]}>
        <Text style={[styles.badgeIcon, !isEarned && styles.badgeIconLocked]}>
          {getIconEmoji(item.icon)}
        </Text>
        <Text style={[styles.badgeName, !isEarned && styles.badgeNameLocked]}>
          {item.name}
        </Text>
        <Text style={styles.badgeRequirement}>
          {item.requirement}日達成
        </Text>
        {isEarned && (
          <View style={styles.earnedBadge}>
            <Text style={styles.earnedText}>獲得済み</Text>
          </View>
        )}
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
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  badgeCardLocked: {
    borderColor: COLORS.border,
    opacity: 0.5,
  },
  badgeIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  badgeIconLocked: {
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
  earnedBadge: {
    backgroundColor: COLORS.success,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 8,
  },
  earnedText: {
    fontSize: 8,
    color: COLORS.text,
    fontWeight: 'bold',
  },
});
