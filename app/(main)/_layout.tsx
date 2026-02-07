import { Tabs } from 'expo-router';
import { View, Image, StyleSheet } from 'react-native';

// アイコン画像の定義
const icons = {
  home: {
    active: require('../../assets/icons/home-blue.png'),
    inactive: require('../../assets/icons/home-gray.png'),
  },
  badges: {
    active: require('../../assets/icons/badgeーblue.png'),
    inactive: require('../../assets/icons/badge-gray.png'),
  },
  settings: {
    active: require('../../assets/icons/gear-blue.png'),
    inactive: require('../../assets/icons/gear-gray.png'),
  },
};

// タブアイコンコンポーネント
function TabIcon({ name, focused }: { name: 'home' | 'badges' | 'settings'; focused: boolean }) {
  const icon = icons[name];
  return (
    <View style={styles.iconContainer}>
      <Image
        source={focused ? icon.active : icon.inactive}
        style={styles.icon}
        resizeMode="contain"
      />
    </View>
  );
}

export default function MainLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E0E0E0',
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: '#4285F4',
        tabBarInactiveTintColor: '#666666',
        headerStyle: {
          backgroundColor: '#FFFFFF',
        },
        headerTintColor: '#000000',
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
          headerTitle: 'ホーム',
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
        name="settings"
        options={{
          title: '設定',
          tabBarIcon: ({ focused }) => <TabIcon name="settings" focused={focused} />,
          headerTitle: '設定',
        }}
      />
      {/* 以下の画面はタブに表示しない（設定画面からアクセス） */}
      <Tabs.Screen
        name="goal-edit"
        options={{
          href: null,
          headerTitle: '目標設定',
        }}
      />
      <Tabs.Screen
        name="subscription-cancel"
        options={{
          href: null,
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
    width: 24,
    height: 24,
  },
});
