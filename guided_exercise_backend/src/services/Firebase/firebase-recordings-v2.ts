import { db } from './firebase-service.js';

export type RecordingStatus = 'queued' | 'processing' | 'completed' | 'failed';

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

const RECORDINGS_COLLECTION = 'recordings_v2';

function normalizePrefix(prefix: string): string {
  return prefix.trim().replace(/^s3:\/\//, '');
}

function toRecordingIdFromPrefix(prefix: string): string {
  const normalized = normalizePrefix(prefix);
  return Buffer.from(normalized).toString('base64url');
}

function mapRecordingDoc(
  id: string,
  data: FirebaseFirestore.DocumentData | undefined
): RecordingDocument | null {
  if (!data) return null;
  return {
    recordingId: id,
    sessionId: data.sessionId,
    participantId: data.participantId,
    userId: data.userId ?? null,
    rawS3Prefix: data.rawS3Prefix,
    recordingStart: data.recordingStart?.toDate ? data.recordingStart.toDate() : data.recordingStart ?? null,
    recordingEnd: data.recordingEnd?.toDate ? data.recordingEnd.toDate() : data.recordingEnd ?? null,
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
  const now = new Date();
  const recordingId = toRecordingId({ recordingId: input.recordingId, rawS3Prefix: input.rawS3Prefix });
  const ref = db.collection(RECORDINGS_COLLECTION).doc(recordingId);
  const existingSnapshot = await ref.get();
  const existing = existingSnapshot.data();
  const createdAt = existing?.createdAt?.toDate ? existing.createdAt.toDate() : existing?.createdAt ?? now;

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
