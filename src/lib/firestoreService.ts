import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { DailyLog, UserStats, User } from '../types';

/**
 * 日付をYYYY-MM-DD形式の文字列に変換
 */
export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * DailyLogのドキュメントIDを生成
 */
function generateDailyLogId(userId: string, date: string): string {
  return `${userId}_${date}`;
}

/**
 * DailyLogを保存
 */
export async function saveDailyLog(
  dailyLog: Omit<DailyLog, 'id' | 'createdAt'>
): Promise<string> {
  const docId = generateDailyLogId(dailyLog.userId, dailyLog.date);
  const docRef = doc(db, 'dailyLogs', docId);

  const logData = {
    ...dailyLog,
    id: docId,
    createdAt: serverTimestamp(),
  };

  console.log('saveDailyLog: saving', docId, 'with data', { date: dailyLog.date, hasPushed: dailyLog.hasPushed });

  try {
    await setDoc(docRef, logData);
    console.log('saveDailyLog: saved successfully', docId);
    return docId;
  } catch (error) {
    console.error('saveDailyLog: failed to save', docId, error);
    throw error;
  }
}

/**
 * 特定の日のDailyLogを取得
 */
export async function getDailyLog(
  userId: string,
  date: string
): Promise<DailyLog | null> {
  const docId = generateDailyLogId(userId, date);
  const docRef = doc(db, 'dailyLogs', docId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as DailyLog;
}

/**
 * ユーザーのDailyLog一覧を取得
 */
export async function getUserDailyLogs(
  userId: string,
  limitCount: number = 30
): Promise<DailyLog[]> {
  const logsRef = collection(db, 'dailyLogs');
  const q = query(
    logsRef,
    where('userId', '==', userId),
    orderBy('date', 'desc'),
    limit(limitCount)
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as DailyLog[];
}

/**
 * ユーザーの統計を更新
 */
export async function updateUserStats(
  userId: string,
  newStats: UserStats
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    stats: newStats,
  });
}

/**
 * ユーザーのバッジを更新（新しいバッジを追加）
 */
export async function updateUserBadges(
  userId: string,
  newBadges: string[]
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    throw new Error('User not found');
  }

  const currentBadges = userSnap.data().badges || [];
  const uniqueBadges = [...new Set([...currentBadges, ...newBadges])];

  await updateDoc(userRef, {
    badges: uniqueBadges,
  });
}

/**
 * ユーザー情報を取得
 */
export async function getUser(userId: string): Promise<User | null> {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    return null;
  }

  return userSnap.data() as User;
}

/**
 * ユーザー情報を更新
 */
export async function updateUser(
  userId: string,
  updates: Partial<User>
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, updates);
}

/**
 * 日次チェック結果を保存し、ユーザー情報を更新
 */
export interface DailyCheckSaveParams {
  userId: string;
  date: Date;
  hasPushed: boolean;
  pushCount: number;
  newStats: UserStats;
  newBadges: string[];
  tweetedSkip: boolean;
  tweetedStreak: boolean;
  streakMilestone: number | null;
}

export async function saveDailyCheckResult(
  params: DailyCheckSaveParams
): Promise<void> {
  const {
    userId,
    date,
    hasPushed,
    pushCount,
    newStats,
    newBadges,
    tweetedSkip,
    tweetedStreak,
    streakMilestone,
  } = params;

  const dateString = formatDateString(date);

  // DailyLogを保存
  await saveDailyLog({
    userId,
    date: dateString,
    hasPushed,
    pushCount,
    pushedAt: hasPushed ? Timestamp.fromDate(date) : null,
    skipped: !hasPushed,
    tweetedSkip,
    tweetedStreak,
    streakMilestone,
  });

  // 統計を更新
  await updateUserStats(userId, newStats);

  // 新しいバッジがあれば追加
  if (newBadges.length > 0) {
    await updateUserBadges(userId, newBadges);
  }
}

/**
 * 今月のDailyLogを取得
 */
export async function getCurrentMonthLogs(userId: string): Promise<DailyLog[]> {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstDayString = formatDateString(firstDayOfMonth);

  const logsRef = collection(db, 'dailyLogs');
  const q = query(
    logsRef,
    where('userId', '==', userId),
    where('date', '>=', firstDayString),
    orderBy('date', 'desc')
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as DailyLog[];
}

/**
 * 今週のDailyLogを取得（月曜始まり）
 */
export async function getCurrentWeekLogs(userId: string): Promise<DailyLog[]> {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);

  const mondayString = formatDateString(monday);
  console.log('getCurrentWeekLogs: userId =', userId, 'mondayString =', mondayString);

  try {
    const logsRef = collection(db, 'dailyLogs');
    const q = query(
      logsRef,
      where('userId', '==', userId),
      where('date', '>=', mondayString),
      orderBy('date', 'asc')
    );

    const querySnapshot = await getDocs(q);
    console.log('getCurrentWeekLogs: found', querySnapshot.docs.length, 'docs');

    const logs = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as DailyLog[];

    console.log('getCurrentWeekLogs: logs =', logs.map(l => ({ id: l.id, date: l.date, hasPushed: l.hasPushed })));
    return logs;
  } catch (error) {
    console.error('getCurrentWeekLogs: query error', error);
    // Firestoreインデックスが必要な場合はエラーメッセージにURLが含まれる
    if (error instanceof Error && error.message.includes('index')) {
      console.error('getCurrentWeekLogs: Firestore index required. Check the error message for the URL to create the index.');
    }
    throw error;
  }
}
