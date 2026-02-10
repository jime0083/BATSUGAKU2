// アプリ定数
export const APP_NAME = 'BatsuGaku';
export const HASHTAG = '#BatsuGaku';

// 色定義（統一デザイン: 白背景、黒テキスト、青アクセント）
export const COLORS = {
  primary: '#FFFFFF',
  secondary: '#F5F5F5',
  accent: '#4285F4',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  background: '#FFFFFF',
  surface: '#F5F5F5',
  text: '#000000',
  textSecondary: '#666666',
  border: '#E0E0E0',
} as const;

// 連続日数のマイルストーン（ツイート対象）
export const STREAK_MILESTONES = [5, 10, 15, 20, 25, 30, 50, 100, 200, 365] as const;

// 達成ツイート用マイルストーン
// 通算日数: 5日, 10日, 以降10日ごと
export const TOTAL_DAYS_ACHIEVEMENT_MILESTONES = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 150, 200, 250, 300, 365] as const;
// 連続日数: 3日, 5日, 以降5日ごと
export const STREAK_ACHIEVEMENT_MILESTONES = [3, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 100, 150, 200, 365] as const;

// バッジ定義
export const BADGES = {
  // 連続学習日数バッジ
  streak: [
    { id: 'streak_3', name: '3日連続', requirement: 3, image: '2-3.png' },
    { id: 'streak_5', name: '5日連続', requirement: 5, image: '2-5.png' },
    { id: 'streak_10', name: '10日連続', requirement: 10, image: '2-10.png' },
    { id: 'streak_15', name: '15日連続', requirement: 15, image: '2-15.png' },
    { id: 'streak_20', name: '20日連続', requirement: 20, image: '2-20.png' },
    { id: 'streak_25', name: '25日連続', requirement: 25, image: '2-25.png' },
    { id: 'streak_30', name: '30日連続', requirement: 30, image: '2-30.png' },
    { id: 'streak_35', name: '35日連続', requirement: 35, image: '2-35.png' },
    { id: 'streak_40', name: '40日連続', requirement: 40, image: '2-40.png' },
    { id: 'streak_50', name: '50日連続', requirement: 50, image: '2-50.png' },
  ],
  // 累計学習日数バッジ
  totalStudy: [
    { id: 'total_5', name: '累計5日', requirement: 5, image: '1-5.png' },
    { id: 'total_10', name: '累計10日', requirement: 10, image: '1-10.png' },
    { id: 'total_20', name: '累計20日', requirement: 20, image: '1-20.png' },
    { id: 'total_30', name: '累計30日', requirement: 30, image: '1-30.png' },
    { id: 'total_40', name: '累計40日', requirement: 40, image: '1-40.png' },
    { id: 'total_50', name: '累計50日', requirement: 50, image: '1-50.png' },
    { id: 'total_60', name: '累計60日', requirement: 60, image: '1-60.png' },
    { id: 'total_70', name: '累計70日', requirement: 70, image: '1-70.png' },
    { id: 'total_80', name: '累計80日', requirement: 80, image: '1-80.png' },
    { id: 'total_90', name: '累計90日', requirement: 90, image: '1-90.png' },
    { id: 'total_100', name: '累計100日', requirement: 100, image: '1-100.png' },
  ],
  // 累計サボり日数バッジ
  totalSkip: [
    { id: 'skip_1', name: '累計サボり1日', requirement: 1, image: '3-d.png' },
    { id: 'skip_3', name: '累計サボり3日', requirement: 3, image: '3-3.png' },
    { id: 'skip_5', name: '累計サボり5日', requirement: 5, image: '3-5.png' },
    { id: 'skip_10', name: '累計サボり10日', requirement: 10, image: '3-10.png' },
    { id: 'skip_15', name: '累計サボり15日', requirement: 15, image: '3-15.png' },
    { id: 'skip_20', name: '累計サボり20日', requirement: 20, image: '3-20.png' },
    { id: 'skip_25', name: '累計サボり25日', requirement: 25, image: '3-25.png' },
    { id: 'skip_30', name: '累計サボり30日', requirement: 30, image: '3-30.png' },
  ],
} as const;

// ツイートテンプレート
export const TWEET_TEMPLATES = {
  // 初回目標宣言投稿
  goalAnnouncement: (deadline: string, skill: string, incomeType: string, targetIncome: number) =>
    `私は${deadline}までに${skill}で${incomeType === 'monthly' ? '月収' : '年収'}${targetIncome}万円稼げる様毎日サボらず努力します🔥\n${HASHTAG}`,

  // サボり投稿
  skip: (targetIncome: number, incomeType: string, skills: string[], monthCount: number, totalCount: number) =>
    `私は${incomeType === 'monthly' ? '月収' : '年収'}${targetIncome}万稼ぐエンジニアになるため${skills.join('、')}の学習をすると宣言したにも関わらずサボった愚かな人間です\n#今月${monthCount}回目 #累計${totalCount}回 ${HASHTAG}`,

  // 連続達成投稿
  streak: (skills: string[], days: number) =>
    `${skills.join('、')}学習${days}日連続達成！ #${days}日連続 ${HASHTAG}`,

  // 管理者日次統計投稿
  dailyStats: (studyCount: number, skipCount: number) =>
    `今日学習をした人：${studyCount}人、サボった人：${skipCount}人 ${HASHTAG}`,

  // 通算日数達成投稿
  totalDaysAchievement: (deadline: string, skill: string, incomeType: string, targetIncome: number, totalDays: number) =>
    `${deadline}までに${skill}で${incomeType === 'monthly' ? '月収' : '年収'}${targetIncome}万円稼ぐという目標を設定してから通算${totalDays}日作業しました目標を達成するため日々がんばっています🔥\n${HASHTAG}`,

  // 連続日数達成投稿
  streakAchievement: (deadline: string, skill: string, incomeType: string, targetIncome: number, streakDays: number) =>
    `${deadline}までに${skill}で${incomeType === 'monthly' ? '月収' : '年収'}${targetIncome}万円稼ぐという目標を設定してから${streakDays}日連続で作業しました目標を達成するため日々がんばっています🔥\n${HASHTAG}`,
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
