"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAppleReceipt = verifyAppleReceipt;
exports.verifyGoogleReceipt = verifyGoogleReceipt;
exports.saveSubscriptionToFirestore = saveSubscriptionToFirestore;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
// プロダクトID
const VALID_PRODUCT_IDS = ['batsugaku_monthly_300'];
// Apple App Store URLs
const APPLE_PRODUCTION_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';
/**
 * Appleレシートを検証
 */
async function verifyAppleReceipt(receipt, appSharedSecret) {
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
    }
    catch (error) {
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
async function fetchAppleReceipt(url, body) {
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
    return response.json();
}
function parseAppleResponse(response) {
    var _a, _b;
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
    const receiptInfo = response.latest_receipt_info ||
        ((_a = response.receipt) === null || _a === void 0 ? void 0 : _a.latest_receipt_info) ||
        ((_b = response.receipt) === null || _b === void 0 ? void 0 : _b.in_app);
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
async function verifyGoogleReceipt(packageName, subscriptionId, purchaseToken, serviceAccountCredentials) {
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
        const data = (await response.json());
        return parseGoogleResponse(data, subscriptionId);
    }
    catch (error) {
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
async function getGoogleAccessToken(credentials) {
    // サービスアカウント認証を使用してアクセストークンを取得
    // Google Auth Libraryを使用する場合はここで実装
    // 簡易実装: Firebase Admin SDKの認証を使用
    const { GoogleAuth } = await Promise.resolve().then(() => __importStar(require('google-auth-library')));
    const auth = new GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    if (!tokenResponse.token) {
        throw new Error('Failed to get Google access token');
    }
    return tokenResponse.token;
}
function parseGoogleResponse(response, subscriptionId) {
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
async function saveSubscriptionToFirestore(userId, result) {
    if (!result.isValid || !result.productId) {
        return;
    }
    const db = admin.firestore();
    const subscriptionData = {
        isActive: result.isValid,
        productId: result.productId,
        purchasedAt: result.purchaseDate
            ? firestore_1.Timestamp.fromDate(result.purchaseDate)
            : firestore_1.Timestamp.now(),
        expiresAt: result.expirationDate
            ? firestore_1.Timestamp.fromDate(result.expirationDate)
            : firestore_1.Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
        originalTransactionId: result.transactionId || '',
        verifiedAt: firestore_1.Timestamp.now(),
    };
    await db.collection('users').doc(userId).update({
        subscription: subscriptionData,
    });
}
//# sourceMappingURL=receiptValidation.js.map