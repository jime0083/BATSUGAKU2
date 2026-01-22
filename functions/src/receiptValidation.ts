import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

// プロダクトID
const VALID_PRODUCT_IDS = ['batsugaku_monthly_300'];

// Apple App Store URLs
const APPLE_PRODUCTION_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';

export interface AppleReceiptResponse {
  status: number;
  receipt?: {
    bundle_id: string;
    in_app: Array<{
      product_id: string;
      original_transaction_id: string;
      purchase_date_ms: string;
      expires_date_ms?: string;
    }>;
    latest_receipt_info?: Array<{
      product_id: string;
      original_transaction_id: string;
      purchase_date_ms: string;
      expires_date_ms?: string;
    }>;
  };
  latest_receipt_info?: Array<{
    product_id: string;
    original_transaction_id: string;
    purchase_date_ms: string;
    expires_date_ms?: string;
  }>;
  pending_renewal_info?: Array<{
    auto_renew_status: string;
    product_id: string;
  }>;
}

export interface GoogleReceiptResponse {
  expiryTimeMillis?: string;
  startTimeMillis?: string;
  autoRenewing?: boolean;
  paymentState?: number;
  orderId?: string;
}

export interface ReceiptValidationResult {
  isValid: boolean;
  productId: string | null;
  purchaseDate: Date | null;
  expirationDate: Date | null;
  transactionId: string | null;
  isExpired: boolean;
  error?: string;
}

/**
 * Appleレシートを検証
 */
export async function verifyAppleReceipt(
  receipt: string,
  appSharedSecret?: string
): Promise<ReceiptValidationResult> {
  const requestBody = {
    'receipt-data': receipt,
    password: appSharedSecret,
    'exclude-old-transactions': true,
  };

  try {
    // 本番環境で検証
    let response = await fetchAppleReceipt(APPLE_PRODUCTION_URL, requestBody);

    // サンドボックスレシートの場合は再試行
    if (response.status === 21007) {
      response = await fetchAppleReceipt(APPLE_SANDBOX_URL, requestBody);
    }

    return parseAppleResponse(response);
  } catch (error) {
    console.error('Apple receipt validation error:', error);
    return {
      isValid: false,
      productId: null,
      purchaseDate: null,
      expirationDate: null,
      transactionId: null,
      isExpired: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function fetchAppleReceipt(
  url: string,
  body: object
): Promise<AppleReceiptResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Apple API error: ${response.status}`);
  }

  return response.json() as Promise<AppleReceiptResponse>;
}

function parseAppleResponse(response: AppleReceiptResponse): ReceiptValidationResult {
  // エラーステータスチェック
  if (response.status !== 0) {
    return {
      isValid: false,
      productId: null,
      purchaseDate: null,
      expirationDate: null,
      transactionId: null,
      isExpired: false,
      error: `Apple status: ${response.status}`,
    };
  }

  // 最新のレシート情報を取得
  const receiptInfo =
    response.latest_receipt_info ||
    response.receipt?.latest_receipt_info ||
    response.receipt?.in_app;

  if (!receiptInfo || receiptInfo.length === 0) {
    return {
      isValid: false,
      productId: null,
      purchaseDate: null,
      expirationDate: null,
      transactionId: null,
      isExpired: false,
      error: 'No receipt info found',
    };
  }

  // 有効なサブスクリプションを検索
  const validSubscription = receiptInfo
    .filter((item) => VALID_PRODUCT_IDS.includes(item.product_id))
    .sort((a, b) => {
      const expiresA = parseInt(a.expires_date_ms || '0', 10);
      const expiresB = parseInt(b.expires_date_ms || '0', 10);
      return expiresB - expiresA;
    })[0];

  if (!validSubscription) {
    return {
      isValid: false,
      productId: null,
      purchaseDate: null,
      expirationDate: null,
      transactionId: null,
      isExpired: false,
      error: 'No valid subscription found',
    };
  }

  const purchaseDate = new Date(parseInt(validSubscription.purchase_date_ms, 10));
  const expirationDate = validSubscription.expires_date_ms
    ? new Date(parseInt(validSubscription.expires_date_ms, 10))
    : null;

  const isExpired = expirationDate ? expirationDate < new Date() : false;

  return {
    isValid: !isExpired,
    productId: validSubscription.product_id,
    purchaseDate,
    expirationDate,
    transactionId: validSubscription.original_transaction_id,
    isExpired,
  };
}

/**
 * Googleレシートを検証
 */
export async function verifyGoogleReceipt(
  packageName: string,
  subscriptionId: string,
  purchaseToken: string,
  serviceAccountCredentials: object
): Promise<ReceiptValidationResult> {
  try {
    // Google Play Developer API を使用
    const accessToken = await getGoogleAccessToken(serviceAccountCredentials);

    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${subscriptionId}/tokens/${purchaseToken}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as GoogleReceiptResponse;
    return parseGoogleResponse(data, subscriptionId);
  } catch (error) {
    console.error('Google receipt validation error:', error);
    return {
      isValid: false,
      productId: null,
      purchaseDate: null,
      expirationDate: null,
      transactionId: null,
      isExpired: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function getGoogleAccessToken(credentials: object): Promise<string> {
  // サービスアカウント認証を使用してアクセストークンを取得
  // Google Auth Libraryを使用する場合はここで実装
  // 簡易実装: Firebase Admin SDKの認証を使用
  const { GoogleAuth } = await import('google-auth-library');

  const auth = new GoogleAuth({
    credentials: credentials as {
      client_email: string;
      private_key: string;
    },
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();

  if (!tokenResponse.token) {
    throw new Error('Failed to get Google access token');
  }

  return tokenResponse.token;
}

function parseGoogleResponse(
  response: GoogleReceiptResponse,
  subscriptionId: string
): ReceiptValidationResult {
  const purchaseDate = response.startTimeMillis
    ? new Date(parseInt(response.startTimeMillis, 10))
    : null;

  const expirationDate = response.expiryTimeMillis
    ? new Date(parseInt(response.expiryTimeMillis, 10))
    : null;

  const isExpired = expirationDate ? expirationDate < new Date() : false;

  // paymentState: 0 = pending, 1 = received, 2 = free trial, 3 = deferred
  const isPaymentValid = response.paymentState === 1 || response.paymentState === 2;

  return {
    isValid: !isExpired && isPaymentValid,
    productId: subscriptionId,
    purchaseDate,
    expirationDate,
    transactionId: response.orderId || null,
    isExpired,
  };
}

/**
 * レシート検証結果をFirestoreに保存
 */
export async function saveSubscriptionToFirestore(
  userId: string,
  result: ReceiptValidationResult
): Promise<void> {
  if (!result.isValid || !result.productId) {
    return;
  }

  const db = admin.firestore();
  const subscriptionData = {
    isActive: result.isValid,
    productId: result.productId,
    purchasedAt: result.purchaseDate
      ? Timestamp.fromDate(result.purchaseDate)
      : Timestamp.now(),
    expiresAt: result.expirationDate
      ? Timestamp.fromDate(result.expirationDate)
      : Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
    originalTransactionId: result.transactionId || '',
    verifiedAt: Timestamp.now(),
  };

  await db.collection('users').doc(userId).update({
    subscription: subscriptionData,
  });
}
