import { Timestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { fetchAllPushDates } from './github';
import { UserStats, User } from '../types';

/**
 * GitHub APIから取得したpush日リストから統計を計算
 * @param pushDates push日の配列（YYYY-MM-DD形式、古い順）
 * @param currentStats 現在の統計（skipDays用）
 * @returns 再計算された統計
 */
export function calculateStatsFromPushDates(
  pushDates: string[],
  currentStats: Partial<UserStats>
): Partial<UserStats> {
  const today = new Date();
  const todayString = formatDateString(today);
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // 今月のpush日をカウント
  let currentMonthStudyDays = 0;
  pushDates.forEach((dateStr) => {
    const [year, month] = dateStr.split('-').map(Number);
    if (year === currentYear && month - 1 === currentMonth) {
      currentMonthStudyDays++;
    }
  });

  // 総学習日数
  const totalStudyDays = pushDates.length;

  // 連続日数を計算
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  let previousDate: Date | null = null;

  // 古い順にソートされたpush日を処理
  const sortedDates = [...pushDates].sort();

  for (const dateStr of sortedDates) {
    const currentDate = new Date(dateStr + 'T00:00:00');

    if (previousDate === null) {
      tempStreak = 1;
    } else {
      // 前日との差を計算
      const diffTime = currentDate.getTime() - previousDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      if (diffDays === 1) {
        // 連続
        tempStreak++;
      } else {
        // 連続が途切れた
        tempStreak = 1;
      }
    }

    longestStreak = Math.max(longestStreak, tempStreak);
    previousDate = currentDate;
  }

  // 現在のストリークを計算（今日または昨日から続いているか）
  if (pushDates.length > 0) {
    const lastPushDate = sortedDates[sortedDates.length - 1];
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = formatDateString(yesterday);

    if (lastPushDate === todayString || lastPushDate === yesterdayString) {
      // 今日または昨日にpushがあれば、現在のストリークを計算
      currentStreak = tempStreak;
    } else {
      // 今日も昨日もpushしていない場合、ストリークは0
      currentStreak = 0;
    }
  }

  // lastStudyDateを設定
  let lastStudyDate: Timestamp | null = null;
  if (pushDates.length > 0) {
    const lastDateStr = sortedDates[sortedDates.length - 1];
    const lastDate = new Date(lastDateStr + 'T12:00:00'); // 正午に設定
    lastStudyDate = Timestamp.fromDate(lastDate);
  }

  return {
    currentMonthStudyDays,
    currentMonthSkipDays: currentStats.currentMonthSkipDays ?? 0,
    totalStudyDays,
    totalSkipDays: currentStats.totalSkipDays ?? 0,
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStats.longestStreak ?? 0),
    lastStudyDate,
    lastCheckedDate: Timestamp.fromDate(today),
  };
}

/**
 * 日付をYYYY-MM-DD形式にフォーマット
 */
function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * GitHub APIから統計を再計算してFirestoreを更新
 * @param user ユーザーオブジェクト
 * @returns 再計算された統計
 */
export async function recalculateAndUpdateStats(
  user: User
): Promise<{ success: boolean; stats?: Partial<UserStats>; error?: string }> {
  console.log('=== recalculateAndUpdateStats START ===');

  if (!user.githubLinked || !user.githubUsername || !user.githubAccessToken) {
    return { success: false, error: 'GitHub連携が必要です' };
  }

  try {
    // GitHub APIから全push日を取得
    console.log('recalculateAndUpdateStats: fetching push dates from GitHub...');
    const pushDates = await fetchAllPushDates(user.githubUsername, user.githubAccessToken);
    console.log('recalculateAndUpdateStats: got', pushDates.length, 'push dates');

    // 現在のFirestoreデータを取得
    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);
    const currentStats = userDoc.exists() ? (userDoc.data().stats as Partial<UserStats>) : {};

    // 統計を再計算
    const newStats = calculateStatsFromPushDates(pushDates, currentStats);
    console.log('recalculateAndUpdateStats: calculated stats =', JSON.stringify(newStats, null, 2));

    // Firestoreを更新
    await updateDoc(userRef, {
      'stats.currentMonthStudyDays': newStats.currentMonthStudyDays,
      'stats.totalStudyDays': newStats.totalStudyDays,
      'stats.currentStreak': newStats.currentStreak,
      'stats.longestStreak': newStats.longestStreak,
      'stats.lastStudyDate': newStats.lastStudyDate,
      'stats.lastCheckedDate': newStats.lastCheckedDate,
    });
    console.log('recalculateAndUpdateStats: Firestore updated');

    console.log('=== recalculateAndUpdateStats END ===');
    return { success: true, stats: newStats };
  } catch (error) {
    console.error('recalculateAndUpdateStats error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
