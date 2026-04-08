import { addIvsTelemetryEvent } from '@/services/Firebase/firebase-telemetry.js';
import { getRequestId, logControllerError, sendErrorResponse } from '@/utils/request-logging.js';
const ALLOWED_EVENT_NAMES = new Set([
    'join_attempt',
    'token_reused',
    'token_refreshed',
    'participant_left_marked',
    'join_failed',
    'token_refresh_failed',
    'participant_left_mark_failed'
]);
function normalizeRole(role) {
    if (role === 'student' || role === 'instructor')
        return role;
    return 'unknown';
}
export async function addIvsTelemetryController(req, res) {
    try {
        const body = req.body;
        if (!body?.eventName || !ALLOWED_EVENT_NAMES.has(body.eventName)) {
            return sendErrorResponse(req, res, 400, 'eventName is required and must be a supported telemetry event.');
        }
        const requestId = getRequestId(req);
        const telemetryPayload = {
            eventName: body.eventName,
            role: normalizeRole(body.role),
            requestId
        };
        if (typeof body.sessionId === 'string')
            telemetryPayload.sessionId = body.sessionId;
        if (typeof body.stageArn === 'string')
            telemetryPayload.stageArn = body.stageArn;
        if (typeof body.userId === 'string')
            telemetryPayload.userId = body.userId;
        if (typeof body.participantId === 'string')
            telemetryPayload.participantId = body.participantId;
        if (body.details && typeof body.details === 'object')
            telemetryPayload.details = body.details;
        if (typeof body.clientTimestamp === 'string')
            telemetryPayload.clientTimestamp = body.clientTimestamp;
        const event = await addIvsTelemetryEvent(telemetryPayload);
        console.info(`[${requestId}] [ivs-telemetry]`, {
            eventName: body.eventName,
            sessionId: body.sessionId ?? null,
            userId: body.userId ?? null,
            role: normalizeRole(body.role),
            participantId: body.participantId ?? null
        });
        return res.status(200).json({
            success: true,
            requestId,
            telemetryId: event.id
        });
    }
    catch (err) {
        logControllerError(req, err, 'addIvsTelemetryController failed');
        return sendErrorResponse(req, res, 500, err?.message || 'Failed to store telemetry event.');
    }
}
//# sourceMappingURL=telemetry-controller.js.map