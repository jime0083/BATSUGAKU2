import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../src/constants';

// シンプルなアイコンコンポーネント
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: { [key: string]: string } = {
    home: '🏠',
    badges: '🏆',
    goal: '🎯',
    settings: '⚙️',
  };

  return (
    <View style={styles.iconContainer}>
      <Text style={[styles.icon, focused && styles.iconFocused]}>
        {icons[name] || '📱'}
      </Text>
    </View>
  );
}

export default function MainLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textSecondary,
        headerStyle: {
          backgroundColor: COLORS.primary,
        },
        headerTintColor: COLORS.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'ホーム',
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
          headerTitle: 'バツガク',
        }}
      />
      <Tabs.Screen
        name="badges"
        options={{
          title: 'バッジ',
          tabBarIcon: ({ focused }) => <TabIcon name="badges" focused={focused} />,
          headerTitle: '獲得バッジ',
        }}
      />
      <Tabs.Screen
        name="goal-edit"
        options={{
          title: '目標',
          tabBarIcon: ({ focused }) => <TabIcon name="goal" focused={focused} />,
          headerTitle: '目標設定',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '設定',
          tabBarIcon: ({ focused }) => <TabIcon name="settings" focused={focused} />,
          headerTitle: '設定',
        }}
      />
      {/* サブスク解約画面はタブに表示しない（設定画面からアクセス） */}
      <Tabs.Screen
        name="subscription-cancel"
        options={{
          href: null, // タブバーに表示しない
          headerTitle: 'サブスクリプション解約',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 24,
    opacity: 0.6,
  },
  iconFocused: {
    opacity: 1,
  },
});
