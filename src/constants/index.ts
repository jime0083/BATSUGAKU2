// アプリ定数
export const APP_NAME = 'バツガク';
export const HASHTAG = '#バツガク';

// 色定義
export const COLORS = {
  primary: '#1a1a2e',
  secondary: '#16213e',
  accent: '#e94560',
  success: '#4ade80',
  warning: '#fbbf24',
  error: '#ef4444',
  background: '#0f0f23',
  surface: '#1a1a2e',
  text: '#ffffff',
  textSecondary: '#a0a0a0',
  border: '#2a2a4e',
} as const;

// 連続日数のマイルストーン（ツイート対象）
export const STREAK_MILESTONES = [5, 10, 15, 20, 25, 30, 50, 100, 200, 365] as const;

// バッジ定義
export const BADGES = {
  // 連続学習日数バッジ
  streak: [
    { id: 'streak_5', name: '5日連続', requirement: 5, icon: 'flame' },
    { id: 'streak_10', name: '10日連続', requirement: 10, icon: 'flame' },
    { id: 'streak_15', name: '15日連続', requirement: 15, icon: 'flame' },
    { id: 'streak_30', name: '30日連続', requirement: 30, icon: 'fire' },
    { id: 'streak_100', name: '100日連続', requirement: 100, icon: 'fire' },
    { id: 'streak_365', name: '365日連続', requirement: 365, icon: 'crown' },
  ],
  // 累計学習日数バッジ
  totalStudy: [
    { id: 'total_10', name: '累計10日', requirement: 10, icon: 'star' },
    { id: 'total_30', name: '累計30日', requirement: 30, icon: 'star' },
    { id: 'total_100', name: '累計100日', requirement: 100, icon: 'star' },
    { id: 'total_365', name: '累計365日', requirement: 365, icon: 'trophy' },
  ],
  // 累計サボり日数バッジ（ネガティブ）
  totalSkip: [
    { id: 'skip_1', name: '初サボり', requirement: 1, icon: 'skull' },
    { id: 'skip_10', name: 'サボり10回', requirement: 10, icon: 'skull' },
    { id: 'skip_30', name: 'サボり30回', requirement: 30, icon: 'skull' },
  ],
} as const;

// ツイートテンプレート
export const TWEET_TEMPLATES = {
  // 初回目標宣言投稿
  goalAnnouncement: (deadline: string, skill: string, incomeType: string, targetIncome: number) =>
    `私は「${deadline}」までに「${skill}」で「${incomeType === 'monthly' ? '月収' : '年収'}」「${targetIncome}」万円稼げる様毎日サボらず努力します🔥\n${HASHTAG}`,

  // サボり投稿
  skip: (targetIncome: number, incomeType: string, skills: string[], monthCount: number, totalCount: number) =>
    `私は${incomeType === 'monthly' ? '月収' : '年収'}${targetIncome}万稼ぐエンジニアになるため${skills.join('、')}の学習をすると宣言したにも関わらず、学習をサボった愚かな人間です\n#今月${monthCount}回目 #累計${totalCount}回 ${HASHTAG}`,

  // 連続達成投稿
  streak: (skills: string[], days: number) =>
    `${skills.join('、')}学習${days}日連続達成！ #${days}日連続 ${HASHTAG}`,

  // 管理者日次統計投稿
  dailyStats: (studyCount: number, skipCount: number) =>
    `今日学習をした人：${studyCount}人、サボった人：${skipCount}人 ${HASHTAG}`,
} as const;

// 通知メッセージ
export const NOTIFICATION_MESSAGES = {
  pushDetected: (days: number) => ({
    title: 'お疲れ様でした！',
    body: days > 1 ? `これで${days}日連続！えらい！！` : '今日も学習ご苦労様',
  }),
  reminder23: {
    title: '学習リマインダー',
    body: '今日はまだ学習していないようです。0:00にサボり投稿が投稿されます。',
  },
  reminder2330: {
    title: '最終警告',
    body: '残り30分！0:00にサボり投稿が投稿されます。',
  },
} as const;

// スキル選択肢
export const SKILL_OPTIONS = [
  'JavaScript',
  'TypeScript',
  'React',
  'React Native',
  'Next.js',
  'Node.js',
  'Python',
  'Go',
  'Rust',
  'Java',
  'Kotlin',
  'Swift',
  'Flutter',
  'AWS',
  'GCP',
  'Firebase',
  'Docker',
  'Kubernetes',
  'SQL',
  'NoSQL',
  'GraphQL',
  'AI/ML',
  'その他',
] as const;

// API制限
export const API_LIMITS = {
  X_FREE_TIER_MONTHLY_TWEETS: 1500,
  GITHUB_RATE_LIMIT_PER_HOUR: 5000,
} as const;

// 管理者機能の閾値
export const ADMIN_THRESHOLDS = {
  MIN_USERS_FOR_DAILY_STATS: 20,
} as const;
