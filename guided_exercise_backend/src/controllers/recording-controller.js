import { findLatestSessionByParticipantId, getSessionById, getSessionByIvsSessionId, getSessionParticipantById, updateSessionIvsSessionId } from '@/services/Firebase/firebase-session.js';
import { listRecordingsBySessionId, listRecordingsByUserId, upsertRecording } from '@/services/Firebase/firebase-recordings-v2.js';
import { logControllerError, sendErrorResponse } from '@/utils/request-logging.js';
function isLikelyIvsSessionId(value) {
    return value.startsWith('st-');
}
export async function upsertRecordingController(req, res) {
    try {
        const expectedIngestSecret = process.env.RECORDING_INGEST_SECRET;
        if (!expectedIngestSecret) {
            return sendErrorResponse(req, res, 500, 'Recording ingest secret is not configured on server.');
        }
        const providedIngestSecret = req.header('x-ingest-secret');
        if (!providedIngestSecret || providedIngestSecret !== expectedIngestSecret) {
            return sendErrorResponse(req, res, 401, 'Unauthorized recording ingest request.');
        }
        const body = req.body;
        if (!body.sessionId?.trim()) {
            return sendErrorResponse(req, res, 400, 'sessionId is required.');
        }
        if (!body.participantId?.trim()) {
            return sendErrorResponse(req, res, 400, 'participantId is required.');
        }
        if (!body.rawS3Prefix?.trim()) {
            return sendErrorResponse(req, res, 400, 'rawS3Prefix is required.');
        }
        const sessionId = body.sessionId.trim();
        const participantId = body.participantId.trim();
        const rawS3Prefix = body.rawS3Prefix.trim();
        // Ingest first tries IVS session linkage, then app session id.
        let session = await getSessionByIvsSessionId(sessionId);
        if (!session) {
            session = await getSessionById(sessionId);
        }
        let effectiveSessionId = session?.sessionId ?? sessionId;
        if (!session) {
            // Fall back to resolving by participant linkage captured at join/rejoin.
            const inferredSession = await findLatestSessionByParticipantId(participantId);
            if (inferredSession) {
                session = inferredSession;
                effectiveSessionId = inferredSession.sessionId;
                // Backfill IVS session id mapping so subsequent events resolve directly.
                if (isLikelyIvsSessionId(sessionId) && inferredSession.ivsSessionId !== sessionId) {
                    await updateSessionIvsSessionId(inferredSession.sessionId, sessionId);
                }
            }
        }
        if (!session) {
            return sendErrorResponse(req, res, 404, 'Session not found for provided sessionId/participantId.');
        }
        const participant = await getSessionParticipantById(effectiveSessionId, participantId);
        const userId = participant?.userId ?? null;
        const recordingStart = body.recordingStart ? new Date(body.recordingStart) : null;
        const recordingEnd = body.recordingEnd ? new Date(body.recordingEnd) : null;
        if (recordingStart && Number.isNaN(recordingStart.getTime())) {
            return sendErrorResponse(req, res, 400, 'recordingStart must be a valid ISO date string.');
        }
        if (recordingEnd && Number.isNaN(recordingEnd.getTime())) {
            return sendErrorResponse(req, res, 400, 'recordingEnd must be a valid ISO date string.');
        }
        const payload = {
            sessionId: effectiveSessionId,
            participantId,
            userId,
            rawS3Prefix,
            recordingStart,
            recordingEnd,
            source: body.source ?? 'manual',
            ...(body.recordingId ? { recordingId: body.recordingId } : {}),
            ...(typeof body.durationMs === 'number' ? { durationMs: body.durationMs } : {}),
            ...(body.status ? { status: body.status } : {}),
            ...(body.processedVideoUrl ? { processedVideoUrl: body.processedVideoUrl } : {}),
            ...(body.feedbackJsonUrl ? { feedbackJsonUrl: body.feedbackJsonUrl } : {}),
            ...(body.error ? { error: body.error } : {})
        };
        const recording = await upsertRecording(payload);
        return res.status(200).json(recording);
    }
    catch (err) {
        logControllerError(req, err, 'upsertRecordingController failed');
        return sendErrorResponse(req, res, 500, err?.message || 'Failed to upsert recording.');
    }
}
export async function listRecordingsBySessionController(req, res) {
    try {
        const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
        if (!sessionId?.trim()) {
            return sendErrorResponse(req, res, 400, 'sessionId is required.');
        }
        const session = await getSessionById(sessionId);
        if (!session) {
            return sendErrorResponse(req, res, 404, 'Session not found.');
        }
        const recordings = await listRecordingsBySessionId(sessionId);
        return res.status(200).json(recordings);
    }
    catch (err) {
        logControllerError(req, err, 'listRecordingsBySessionController failed');
        return sendErrorResponse(req, res, 500, err?.message || 'Failed to list recordings by session.');
    }
}
export async function listRecordingsByUserController(req, res) {
    try {
        const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
        if (!userId?.trim()) {
            return sendErrorResponse(req, res, 400, 'userId is required.');
        }
        const recordings = await listRecordingsByUserId(userId);
        return res.status(200).json(recordings);
    }
    catch (err) {
        logControllerError(req, err, 'listRecordingsByUserController failed');
        return sendErrorResponse(req, res, 500, err?.message || 'Failed to list recordings by user.');
    }
}
//# sourceMappingURL=recording-controller.js.map