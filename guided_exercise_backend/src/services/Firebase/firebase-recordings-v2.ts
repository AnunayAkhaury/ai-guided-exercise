import { db } from './firebase-service.js';

export type RecordingStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type ExerciseType = 'pushup' | 'lunge';

export type ClipsDocument = {
  duration: string;
  exercise: ExerciseType;
  feedback: string;
  processedVideoUrl: string;
  recordingId: string;
  userId: string;
};

export type RecordingDocument = {
  recordingId: string;
  sessionId: string;
  participantId: string;
  userId: string | null;
  rawS3Prefix: string;
  recordingStart: Date | null;
  recordingEnd: Date | null;
  durationMs: number | null;
  status: RecordingStatus;
  processedVideoUrl: string | null;
  feedbackJsonUrl: string | null;
  error: string | null;
  source: 'manual' | 'eventbridge' | 'worker';
  createdAt: Date;
  updatedAt: Date;
};

type UpsertRecordingInput = {
  recordingId?: string;
  sessionId: string;
  participantId: string;
  userId?: string | null;
  rawS3Prefix: string;
  recordingStart?: Date | null;
  recordingEnd?: Date | null;
  durationMs?: number | null;
  status?: RecordingStatus;
  processedVideoUrl?: string | null;
  feedbackJsonUrl?: string | null;
  error?: string | null;
  source?: 'manual' | 'eventbridge' | 'worker';
};

type UpdateRecordingPatch = {
  status?: RecordingStatus;
  processedVideoUrl?: string | null;
  feedbackJsonUrl?: string | null;
  error?: string | null;
};

const RECORDINGS_COLLECTION = 'recordings_v2';
const CLIPS_COLLECTION = 'clips';

function normalizePrefix(prefix: string): string {
  return prefix.trim().replace(/^s3:\/\//, '');
}

function toRecordingIdFromPrefix(prefix: string): string {
  const normalized = normalizePrefix(prefix);
  return Buffer.from(normalized).toString('base64url');
}

function mapRecordingDoc(id: string, data: FirebaseFirestore.DocumentData | undefined): RecordingDocument | null {
  if (!data) return null;
  return {
    recordingId: id,
    sessionId: data.sessionId,
    participantId: data.participantId,
    userId: data.userId ?? null,
    rawS3Prefix: data.rawS3Prefix,
    recordingStart: data.recordingStart?.toDate ? data.recordingStart.toDate() : (data.recordingStart ?? null),
    recordingEnd: data.recordingEnd?.toDate ? data.recordingEnd.toDate() : (data.recordingEnd ?? null),
    durationMs: typeof data.durationMs === 'number' ? data.durationMs : null,
    status: data.status,
    processedVideoUrl: data.processedVideoUrl ?? null,
    feedbackJsonUrl: data.feedbackJsonUrl ?? null,
    error: data.error ?? null,
    source: data.source ?? 'manual',
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt
  } as RecordingDocument;
}

export function toRecordingId(input: { recordingId: string | undefined; rawS3Prefix: string }): string {
  if (input.recordingId?.trim()) return input.recordingId.trim();
  return toRecordingIdFromPrefix(input.rawS3Prefix);
}

export async function upsertRecording(input: UpsertRecordingInput): Promise<RecordingDocument> {
  console.log('Check2');
  const now = new Date();
  const recordingId = toRecordingId({ recordingId: input.recordingId, rawS3Prefix: input.rawS3Prefix });
  const ref = db.collection(RECORDINGS_COLLECTION).doc(recordingId);
  const existingSnapshot = await ref.get();
  const existing = existingSnapshot.data();
  const createdAt = existing?.createdAt?.toDate ? existing.createdAt.toDate() : (existing?.createdAt ?? now);

  await ref.set(
    {
      recordingId,
      sessionId: input.sessionId.trim(),
      participantId: input.participantId.trim(),
      userId: input.userId?.trim() || null,
      rawS3Prefix: normalizePrefix(input.rawS3Prefix),
      recordingStart: input.recordingStart ?? null,
      recordingEnd: input.recordingEnd ?? null,
      durationMs: typeof input.durationMs === 'number' ? input.durationMs : null,
      status: input.status ?? (existing?.status as RecordingStatus | undefined) ?? 'queued',
      processedVideoUrl: input.processedVideoUrl ?? existing?.processedVideoUrl ?? null,
      feedbackJsonUrl: input.feedbackJsonUrl ?? existing?.feedbackJsonUrl ?? null,
      error: input.error ?? existing?.error ?? null,
      source: input.source ?? existing?.source ?? 'manual',
      createdAt,
      updatedAt: now
    },
    { merge: true }
  );

  const updatedSnapshot = await ref.get();
  const mapped = mapRecordingDoc(updatedSnapshot.id, updatedSnapshot.data());
  if (!mapped) {
    throw new Error('Failed to read recording after upsert.');
  }
  return mapped;
}

export async function getRecordingById(recordingId: string): Promise<RecordingDocument | null> {
  const normalizedRecordingId = recordingId.trim();
  if (!normalizedRecordingId) {
    return null;
  }

  const snapshot = await db.collection(RECORDINGS_COLLECTION).doc(normalizedRecordingId).get();
  if (!snapshot.exists) {
    return null;
  }

  return mapRecordingDoc(snapshot.id, snapshot.data());
}

export async function updateRecordingById(
  recordingId: string,
  patch: UpdateRecordingPatch
): Promise<RecordingDocument> {
  const normalizedRecordingId = recordingId.trim();
  if (!normalizedRecordingId) {
    throw new Error('recordingId is required.');
  }

  const ref = db.collection(RECORDINGS_COLLECTION).doc(normalizedRecordingId);
  const existingSnapshot = await ref.get();
  if (!existingSnapshot.exists) {
    throw new Error('Recording not found.');
  }

  const existing = existingSnapshot.data();
  const now = new Date();

  await ref.set(
    {
      status: patch.status ?? existing?.status ?? 'queued',
      processedVideoUrl:
        patch.processedVideoUrl !== undefined ? patch.processedVideoUrl : (existing?.processedVideoUrl ?? null),
      feedbackJsonUrl:
        patch.feedbackJsonUrl !== undefined ? patch.feedbackJsonUrl : (existing?.feedbackJsonUrl ?? null),
      error: patch.error !== undefined ? patch.error : (existing?.error ?? null),
      updatedAt: now
    },
    { merge: true }
  );

  const updatedSnapshot = await ref.get();
  const mapped = mapRecordingDoc(updatedSnapshot.id, updatedSnapshot.data());
  if (!mapped) {
    throw new Error('Failed to read recording after update.');
  }
  return mapped;
}

export async function claimRecordingForProcessing(recordingId: string): Promise<RecordingDocument | null> {
  const normalizedRecordingId = recordingId.trim();
  if (!normalizedRecordingId) {
    throw new Error('recordingId is required.');
  }

  const ref = db.collection(RECORDINGS_COLLECTION).doc(normalizedRecordingId);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) {
      throw new Error('Recording not found.');
    }

    const existing = mapRecordingDoc(snapshot.id, snapshot.data());
    if (!existing) {
      throw new Error('Recording not found.');
    }

    if (!existing.userId?.trim()) {
      throw new Error('Recording is missing userId and cannot be processed.');
    }

    if (!existing.rawS3Prefix?.trim()) {
      throw new Error('Recording is missing rawS3Prefix and cannot be processed.');
    }

    if (existing.status === 'processing' || Boolean(existing.processedVideoUrl)) {
      return null;
    }

    const now = new Date();
    transaction.set(
      ref,
      {
        status: 'processing',
        error: null,
        updatedAt: now
      },
      { merge: true }
    );

    return {
      ...existing,
      status: 'processing',
      error: null,
      updatedAt: now
    } satisfies RecordingDocument;
  });
}

function recordingSortTime(recording: RecordingDocument): number {
  const primary = recording.recordingStart ?? recording.createdAt;
  return primary.getTime();
}

export async function listRecordingsBySessionId(sessionId: string): Promise<RecordingDocument[]> {
  const normalizedSessionId = sessionId.trim();
  const snapshot = await db
    .collection(RECORDINGS_COLLECTION)
    .where('sessionId', '==', normalizedSessionId)
    .limit(500)
    .get();

  const recordings = snapshot.docs
    .map((doc) => mapRecordingDoc(doc.id, doc.data()))
    .filter((recording): recording is RecordingDocument => Boolean(recording));

  recordings.sort((a, b) => recordingSortTime(b) - recordingSortTime(a));
  return recordings;
}

export async function listRecordingsByUserId(userId: string): Promise<RecordingDocument[]> {
  const normalizedUserId = userId.trim();
  const snapshot = await db.collection(RECORDINGS_COLLECTION).where('userId', '==', normalizedUserId).limit(500).get();

  const recordings = snapshot.docs
    .map((doc) => mapRecordingDoc(doc.id, doc.data()))
    .filter((recording): recording is RecordingDocument => Boolean(recording));

  recordings.sort((a, b) => recordingSortTime(b) - recordingSortTime(a));
  return recordings;
}

export async function listClipsByUserId(
  userId: string
): Promise<(ClipsDocument & { recordingStart: any; clipId: string })[]> {
  const normalizedUserId = userId.trim();

  const snapshot = await db.collection(CLIPS_COLLECTION).where('userId', '==', normalizedUserId).limit(500).get();

  const clipsWithDates = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const clipData = doc.data() as ClipsDocument;
      let recordingStart = null;

      if (clipData.recordingId) {
        const recordingDoc = await db.collection('recordings').doc(clipData.recordingId).get();

        if (recordingDoc.exists) {
          const data = recordingDoc.data();
          recordingStart = data?.recordingStart || data?.createdAt || null;
        }
      }

      return {
        clipId: doc.id,
        ...clipData,
        recordingStart
      };
    })
  );

  return clipsWithDates;
}

export async function getClipById(clipId: string) {
  const normalizedClipId = clipId.trim();
  const snapshot = await db.collection(CLIPS_COLLECTION).doc(normalizedClipId).get();

  if (!snapshot.exists) {
    return null;
  }

  return snapshot.data();
}
