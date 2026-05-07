import { db } from './firebase-service.js';

export type PushTokenType = 'expo' | 'fcm_web';
export type PushPlatform = 'ios' | 'android' | 'web';

export type PushTokenDocument = {
  tokenId: string;
  uid: string;
  token: string;
  type: PushTokenType;
  platform: PushPlatform;
  deviceName: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastError: string | null;
};

export type RegisterPushTokenInput = {
  uid: string;
  token: string;
  type: PushTokenType;
  platform: PushPlatform;
  deviceName?: string | null;
};

const USERS_COLLECTION = 'users';
const PUSH_TOKENS_SUBCOLLECTION = 'pushTokens';

function tokenDocId(token: string): string {
  return Buffer.from(token.trim()).toString('base64url').slice(0, 120);
}

function mapPushTokenDoc(
  uid: string,
  id: string,
  data: FirebaseFirestore.DocumentData | undefined
): PushTokenDocument | null {
  if (!data?.token || !data?.type || !data?.platform) {
    return null;
  }

  return {
    tokenId: id,
    uid,
    token: data.token,
    type: data.type,
    platform: data.platform,
    deviceName: data.deviceName ?? null,
    enabled: data.enabled !== false,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
    lastError: data.lastError ?? null
  };
}

export async function registerPushToken(input: RegisterPushTokenInput): Promise<PushTokenDocument> {
  const uid = input.uid.trim();
  const token = input.token.trim();
  if (!uid) {
    throw new Error('uid is required.');
  }
  if (!token) {
    throw new Error('token is required.');
  }

  const now = new Date();
  const tokenId = tokenDocId(token);
  const ref = db.collection(USERS_COLLECTION).doc(uid).collection(PUSH_TOKENS_SUBCOLLECTION).doc(tokenId);
  const existing = await ref.get();
  const existingData = existing.data();
  const createdAt = existingData?.createdAt?.toDate ? existingData.createdAt.toDate() : existingData?.createdAt ?? now;

  await ref.set(
    {
      token,
      type: input.type,
      platform: input.platform,
      deviceName: input.deviceName?.trim() || null,
      enabled: true,
      createdAt,
      updatedAt: now,
      lastError: null
    },
    { merge: true }
  );

  return {
    tokenId,
    uid,
    token,
    type: input.type,
    platform: input.platform,
    deviceName: input.deviceName?.trim() || null,
    enabled: true,
    createdAt,
    updatedAt: now,
    lastError: null
  };
}

export async function disablePushToken(uid: string, token: string): Promise<void> {
  const normalizedUid = uid.trim();
  const normalizedToken = token.trim();
  if (!normalizedUid || !normalizedToken) {
    return;
  }

  await db
    .collection(USERS_COLLECTION)
    .doc(normalizedUid)
    .collection(PUSH_TOKENS_SUBCOLLECTION)
    .doc(tokenDocId(normalizedToken))
    .set(
      {
        enabled: false,
        updatedAt: new Date()
      },
      { merge: true }
    );
}

export async function markPushTokenError(uid: string, token: string, error: string): Promise<void> {
  const normalizedUid = uid.trim();
  const normalizedToken = token.trim();
  if (!normalizedUid || !normalizedToken) {
    return;
  }

  await db
    .collection(USERS_COLLECTION)
    .doc(normalizedUid)
    .collection(PUSH_TOKENS_SUBCOLLECTION)
    .doc(tokenDocId(normalizedToken))
    .set(
      {
        enabled: false,
        lastError: error,
        updatedAt: new Date()
      },
      { merge: true }
    );
}

export async function listPushTokensForUsers(userIds: string[]): Promise<PushTokenDocument[]> {
  const uniqueUserIds = Array.from(new Set(userIds.map((uid) => uid.trim()).filter(Boolean)));
  const nested = await Promise.all(
    uniqueUserIds.map(async (uid) => {
      const snapshot = await db
        .collection(USERS_COLLECTION)
        .doc(uid)
        .collection(PUSH_TOKENS_SUBCOLLECTION)
        .where('enabled', '==', true)
        .get();

      return snapshot.docs
        .map((doc) => mapPushTokenDoc(uid, doc.id, doc.data()))
        .filter((token): token is PushTokenDocument => Boolean(token));
    })
  );

  return nested.flat();
}
