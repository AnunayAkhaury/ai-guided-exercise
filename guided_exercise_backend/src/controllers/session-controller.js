import { DisconnectParticipantCommand, IVSRealTimeClient } from '@aws-sdk/client-ivs-realtime';
import { createSession, endOtherLiveSessions, getSessionByCode, getSessionById, listSessionParticipants, listSessions, markSessionParticipantLeft, upsertSessionParticipant, updateSessionStatus } from '@/services/Firebase/firebase-session.js';
import { logControllerError, sendErrorResponse } from '@/utils/request-logging.js';
const VALID_STATUSES = ['scheduled', 'live', 'ended'];
const DEFAULT_REGION = process.env.AWS_REGION || 'us-west-2';
const START_WINDOW_MINUTES = 5;
async function disconnectKnownParticipantsForSession(session) {
    const participants = await listSessionParticipants(session.sessionId);
    if (participants.length === 0) {
        return;
    }
    const client = new IVSRealTimeClient({ region: DEFAULT_REGION });
    await Promise.allSettled(participants.map((participant) => client.send(new DisconnectParticipantCommand({
        stageArn: session.stageArn,
        participantId: participant.participantId,
        reason: `Session ${session.sessionId} ended`
    }))));
}
export async function createSessionController(req, res) {
    try {
        const { sessionName, instructorUid, coachName, stageArn, scheduledStartAt, scheduledEndAt } = req.body;
        const effectiveStageArn = stageArn ?? process.env.IVS_STAGE_ARN;
        if (!sessionName?.trim()) {
            return sendErrorResponse(req, res, 400, 'sessionName is required.');
        }
        if (!instructorUid?.trim()) {
            return sendErrorResponse(req, res, 400, 'instructorUid is required.');
        }
        if (!effectiveStageArn?.trim()) {
            return sendErrorResponse(req, res, 400, 'stageArn is required (or set IVS_STAGE_ARN).');
        }
        let parsedScheduledStartAt;
        let parsedScheduledEndAt;
        if (scheduledStartAt) {
            const value = new Date(scheduledStartAt);
            if (Number.isNaN(value.getTime())) {
                return sendErrorResponse(req, res, 400, 'scheduledStartAt must be a valid ISO date string.');
            }
            parsedScheduledStartAt = value;
        }
        if (scheduledEndAt) {
            const value = new Date(scheduledEndAt);
            if (Number.isNaN(value.getTime())) {
                return sendErrorResponse(req, res, 400, 'scheduledEndAt must be a valid ISO date string.');
            }
            parsedScheduledEndAt = value;
        }
        if (parsedScheduledStartAt && parsedScheduledEndAt && parsedScheduledEndAt <= parsedScheduledStartAt) {
            return sendErrorResponse(req, res, 400, 'scheduledEndAt must be after scheduledStartAt.');
        }
        const session = await createSession({
            sessionName,
            instructorUid,
            ...(coachName?.trim() ? { coachName } : {}),
            stageArn: effectiveStageArn,
            ...(parsedScheduledStartAt ? { scheduledStartAt: parsedScheduledStartAt } : {}),
            ...(parsedScheduledEndAt ? { scheduledEndAt: parsedScheduledEndAt } : {})
        });
        return res.status(200).json(session);
    }
    catch (err) {
        logControllerError(req, err, 'createSessionController failed');
        return sendErrorResponse(req, res, 500, err?.message || 'Failed to create session.');
    }
}
export async function joinSessionByCodeController(req, res) {
    try {
        const { sessionCode } = req.body;
        if (!sessionCode?.trim()) {
            return sendErrorResponse(req, res, 400, 'sessionCode is required.');
        }
        const session = await getSessionByCode(sessionCode);
        if (!session) {
            return sendErrorResponse(req, res, 404, 'Session not found.');
        }
        if (session.status === 'scheduled') {
            return sendErrorResponse(req, res, 409, 'Session is not live yet.');
        }
        if (session.status === 'ended') {
            return sendErrorResponse(req, res, 410, 'Session has ended.');
        }
        return res.status(200).json(session);
    }
    catch (err) {
        logControllerError(req, err, 'joinSessionByCodeController failed');
        return sendErrorResponse(req, res, 500, err?.message || 'Failed to join session.');
    }
}
export async function getSessionByIdController(req, res) {
    try {
        const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
        if (!sessionId?.trim()) {
            return sendErrorResponse(req, res, 400, 'sessionId is required.');
        }
        const session = await getSessionById(sessionId);
        if (!session) {
            return sendErrorResponse(req, res, 404, 'Session not found.');
        }
        return res.status(200).json(session);
    }
    catch (err) {
        logControllerError(req, err, 'getSessionByIdController failed');
        return sendErrorResponse(req, res, 500, err?.message || 'Failed to fetch session.');
    }
}
export async function listSessionsController(req, res) {
    try {
        const rawStatus = Array.isArray(req.query.status) ? req.query.status.join(',') : req.query.status;
        let statuses;
        if (typeof rawStatus === 'string' && rawStatus.trim().length > 0) {
            const parsed = rawStatus
                .split(',')
                .map((value) => value.trim().toLowerCase())
                .filter((value) => VALID_STATUSES.includes(value));
            if (parsed.length === 0) {
                return sendErrorResponse(req, res, 400, 'status must be one or more of: scheduled, live, ended.');
            }
            statuses = Array.from(new Set(parsed));
        }
        const sessions = await listSessions(statuses);
        return res.status(200).json(sessions);
    }
    catch (err) {
        logControllerError(req, err, 'listSessionsController failed');
        return sendErrorResponse(req, res, 500, err?.message || 'Failed to list sessions.');
    }
}
export async function startSessionController(req, res) {
    try {
        const { sessionId } = req.body;
        if (!sessionId?.trim()) {
            return sendErrorResponse(req, res, 400, 'sessionId is required.');
        }
        const existing = await getSessionById(sessionId);
        if (!existing) {
            return sendErrorResponse(req, res, 404, 'Session not found.');
        }
        if (existing.status === 'ended') {
            return sendErrorResponse(req, res, 409, 'Cannot start an ended session.');
        }
        if (existing.scheduledStartAt) {
            const earliestStart = existing.scheduledStartAt.getTime() - START_WINDOW_MINUTES * 60 * 1000;
            if (Date.now() < earliestStart) {
                return sendErrorResponse(req, res, 409, `This class can only be started ${START_WINDOW_MINUTES} minutes before the scheduled time.`);
            }
        }
        const currentlyLiveSessions = await listSessions(['live']);
        const otherLiveSessions = currentlyLiveSessions.filter((session) => session.sessionId !== sessionId);
        await Promise.allSettled(otherLiveSessions.map((session) => disconnectKnownParticipantsForSession(session)));
        await endOtherLiveSessions(sessionId);
        await updateSessionStatus(sessionId, 'live');
        const updated = await getSessionById(sessionId);
        return res.status(200).json(updated);
    }
    catch (err) {
        logControllerError(req, err, 'startSessionController failed');
        return sendErrorResponse(req, res, 500, err?.message || 'Failed to start session.');
    }
}
export async function endSessionController(req, res) {
    try {
        const { sessionId } = req.body;
        if (!sessionId?.trim()) {
            return sendErrorResponse(req, res, 400, 'sessionId is required.');
        }
        const existing = await getSessionById(sessionId);
        if (!existing) {
            return sendErrorResponse(req, res, 404, 'Session not found.');
        }
        if (existing.status === 'live') {
            await disconnectKnownParticipantsForSession(existing);
        }
        await updateSessionStatus(sessionId, 'ended');
        const updated = await getSessionById(sessionId);
        return res.status(200).json(updated ?? { ...existing, status: 'ended' });
    }
    catch (err) {
        logControllerError(req, err, 'endSessionController failed');
        return sendErrorResponse(req, res, 500, err?.message || 'Failed to end session.');
    }
}
export async function upsertSessionParticipantController(req, res) {
    try {
        const { sessionId, participantId, userId, displayName, role } = req.body;
        if (!sessionId?.trim()) {
            return sendErrorResponse(req, res, 400, 'sessionId is required.');
        }
        if (!participantId?.trim()) {
            return sendErrorResponse(req, res, 400, 'participantId is required.');
        }
        if (!displayName?.trim()) {
            return sendErrorResponse(req, res, 400, 'displayName is required.');
        }
        const existing = await getSessionById(sessionId);
        if (!existing) {
            return sendErrorResponse(req, res, 404, 'Session not found.');
        }
        const participant = await upsertSessionParticipant(sessionId, participantId, displayName, role, userId);
        return res.status(200).json(participant);
    }
    catch (err) {
        logControllerError(req, err, 'upsertSessionParticipantController failed');
        return sendErrorResponse(req, res, 500, err?.message || 'Failed to upsert session participant.');
    }
}
export async function listSessionParticipantsController(req, res) {
    try {
        const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
        if (!sessionId?.trim()) {
            return sendErrorResponse(req, res, 400, 'sessionId is required.');
        }
        const existing = await getSessionById(sessionId);
        if (!existing) {
            return sendErrorResponse(req, res, 404, 'Session not found.');
        }
        const participants = await listSessionParticipants(sessionId);
        return res.status(200).json(participants);
    }
    catch (err) {
        logControllerError(req, err, 'listSessionParticipantsController failed');
        return sendErrorResponse(req, res, 500, err?.message || 'Failed to list session participants.');
    }
}
export async function leaveSessionParticipantController(req, res) {
    try {
        const { sessionId, participantId } = req.body;
        if (!sessionId?.trim()) {
            return sendErrorResponse(req, res, 400, 'sessionId is required.');
        }
        if (!participantId?.trim()) {
            return sendErrorResponse(req, res, 400, 'participantId is required.');
        }
        const existing = await getSessionById(sessionId);
        if (!existing) {
            return sendErrorResponse(req, res, 404, 'Session not found.');
        }
        const participant = await markSessionParticipantLeft(sessionId, participantId);
        if (!participant) {
            return sendErrorResponse(req, res, 404, 'Participant not found.');
        }
        return res.status(200).json({
            success: true,
            sessionId,
            participantId: participant.participantId
        });
    }
    catch (err) {
        logControllerError(req, err, 'leaveSessionParticipantController failed');
        return sendErrorResponse(req, res, 500, err?.message || 'Failed to mark participant as left.');
    }
}
//# sourceMappingURL=session-controller.js.map