import { db } from './firebase-service.js';
const RECORDINGS_COLLECTION = 'recordings_v2';
function normalizePrefix(prefix) {
    return prefix.trim().replace(/^s3:\/\//, '');
}
function toRecordingIdFromPrefix(prefix) {
    const normalized = normalizePrefix(prefix);
    return Buffer.from(normalized).toString('base64url');
}
function mapRecordingDoc(id, data) {
    if (!data)
        return null;
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
    };
}
export function toRecordingId(input) {
    if (input.recordingId?.trim())
        return input.recordingId.trim();
    return toRecordingIdFromPrefix(input.rawS3Prefix);
}
export async function upsertRecording(input) {
    const now = new Date();
    const recordingId = toRecordingId({ recordingId: input.recordingId, rawS3Prefix: input.rawS3Prefix });
    const ref = db.collection(RECORDINGS_COLLECTION).doc(recordingId);
    const existingSnapshot = await ref.get();
    const existing = existingSnapshot.data();
    const createdAt = existing?.createdAt?.toDate ? existing.createdAt.toDate() : existing?.createdAt ?? now;
    await ref.set({
        recordingId,
        sessionId: input.sessionId.trim(),
        participantId: input.participantId.trim(),
        userId: input.userId?.trim() || null,
        rawS3Prefix: normalizePrefix(input.rawS3Prefix),
        recordingStart: input.recordingStart ?? null,
        recordingEnd: input.recordingEnd ?? null,
        durationMs: typeof input.durationMs === 'number' ? input.durationMs : null,
        status: input.status ?? existing?.status ?? 'queued',
        processedVideoUrl: input.processedVideoUrl ?? existing?.processedVideoUrl ?? null,
        feedbackJsonUrl: input.feedbackJsonUrl ?? existing?.feedbackJsonUrl ?? null,
        error: input.error ?? existing?.error ?? null,
        source: input.source ?? existing?.source ?? 'manual',
        createdAt,
        updatedAt: now
    }, { merge: true });
    const updatedSnapshot = await ref.get();
    const mapped = mapRecordingDoc(updatedSnapshot.id, updatedSnapshot.data());
    if (!mapped) {
        throw new Error('Failed to read recording after upsert.');
    }
    return mapped;
}
function recordingSortTime(recording) {
    const primary = recording.recordingStart ?? recording.createdAt;
    return primary.getTime();
}
export async function listRecordingsBySessionId(sessionId) {
    const normalizedSessionId = sessionId.trim();
    const snapshot = await db
        .collection(RECORDINGS_COLLECTION)
        .where('sessionId', '==', normalizedSessionId)
        .limit(500)
        .get();
    const recordings = snapshot.docs
        .map((doc) => mapRecordingDoc(doc.id, doc.data()))
        .filter((recording) => Boolean(recording));
    recordings.sort((a, b) => recordingSortTime(b) - recordingSortTime(a));
    return recordings;
}
export async function listRecordingsByUserId(userId) {
    const normalizedUserId = userId.trim();
    const snapshot = await db
        .collection(RECORDINGS_COLLECTION)
        .where('userId', '==', normalizedUserId)
        .limit(500)
        .get();
    const recordings = snapshot.docs
        .map((doc) => mapRecordingDoc(doc.id, doc.data()))
        .filter((recording) => Boolean(recording));
    recordings.sort((a, b) => recordingSortTime(b) - recordingSortTime(a));
    return recordings;
}
//# sourceMappingURL=firebase-recordings-v2.js.map