import { db } from './firebase-service.js';

export type IvsTelemetryEventName =
  | 'join_attempt'
  | 'token_reused'
  | 'token_refreshed'
  | 'participant_left_marked'
  | 'join_failed'
  | 'token_refresh_failed'
  | 'participant_left_mark_failed';

export type IvsTelemetryPayload = {
  eventName: IvsTelemetryEventName;
  sessionId?: string;
  stageArn?: string;
  userId?: string;
  role?: 'student' | 'instructor' | 'unknown';
  participantId?: string;
  requestId?: string;
  details?: Record<string, unknown>;
  clientTimestamp?: string;
};

const TELEMETRY_COLLECTION = 'ivs_telemetry';

export async function addIvsTelemetryEvent(payload: IvsTelemetryPayload) {
  const now = new Date();
  const ref = db.collection(TELEMETRY_COLLECTION).doc();

  await ref.set({
    eventName: payload.eventName,
    sessionId: payload.sessionId ?? null,
    stageArn: payload.stageArn ?? null,
    userId: payload.userId ?? null,
    role: payload.role ?? 'unknown',
    participantId: payload.participantId ?? null,
    requestId: payload.requestId ?? null,
    details: payload.details ?? null,
    clientTimestamp: payload.clientTimestamp ?? null,
    createdAt: now
  });

  return { id: ref.id, createdAt: now };
}
