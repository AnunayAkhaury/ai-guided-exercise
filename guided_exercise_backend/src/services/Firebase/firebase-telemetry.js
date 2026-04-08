import { db } from './firebase-service.js';
const TELEMETRY_COLLECTION = 'ivs_telemetry';
export async function addIvsTelemetryEvent(payload) {
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
//# sourceMappingURL=firebase-telemetry.js.map