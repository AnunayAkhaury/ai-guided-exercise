import type { NextFunction, Request, Response } from 'express';
import {
  createSession,
  getSessionByCode,
  getSessionById,
  listSessionParticipants,
  listSessions,
  upsertSessionParticipant,
  updateSessionStatus
} from '@/services/Firebase/firebase-session.js';
import type { SessionStatus } from '@/services/Firebase/firebase-session.js';

type CreateSessionRequest = {
  sessionName?: string;
  instructorUid?: string;
  stageArn?: string;
};

type SessionCodeRequest = {
  sessionCode?: string;
};

type SessionIdRequest = {
  sessionId?: string;
};

type UpsertParticipantRequest = {
  sessionId?: string;
  participantId?: string;
  displayName?: string;
  role?: string;
};

const VALID_STATUSES: SessionStatus[] = ['scheduled', 'live', 'ended'];

export async function createSessionController(req: Request, res: Response, next: NextFunction) {
  try {
    const { sessionName, instructorUid, stageArn } = req.body as CreateSessionRequest;
    const effectiveStageArn = stageArn ?? process.env.IVS_STAGE_ARN;

    if (!sessionName?.trim()) {
      return res.status(400).json({ message: 'sessionName is required.' });
    }
    if (!instructorUid?.trim()) {
      return res.status(400).json({ message: 'instructorUid is required.' });
    }
    if (!effectiveStageArn?.trim()) {
      return res.status(400).json({ message: 'stageArn is required (or set IVS_STAGE_ARN).' });
    }

    const session = await createSession({
      sessionName,
      instructorUid,
      stageArn: effectiveStageArn
    });

    return res.status(200).json(session);
  } catch (err: any) {
    next(err);
    return res.status(500).json({ message: err.message || 'Failed to create session.' });
  }
}

export async function joinSessionByCodeController(req: Request, res: Response, next: NextFunction) {
  try {
    const { sessionCode } = req.body as SessionCodeRequest;
    if (!sessionCode?.trim()) {
      return res.status(400).json({ message: 'sessionCode is required.' });
    }

    const session = await getSessionByCode(sessionCode);
    if (!session) {
      return res.status(404).json({ message: 'Session not found.' });
    }
    if (session.status === 'ended') {
      return res.status(410).json({ message: 'Session has ended.' });
    }

    return res.status(200).json(session);
  } catch (err: any) {
    next(err);
    return res.status(500).json({ message: err.message || 'Failed to join session.' });
  }
}

export async function getSessionByIdController(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
    if (!sessionId?.trim()) {
      return res.status(400).json({ message: 'sessionId is required.' });
    }

    const session = await getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found.' });
    }

    return res.status(200).json(session);
  } catch (err: any) {
    next(err);
    return res.status(500).json({ message: err.message || 'Failed to fetch session.' });
  }
}

export async function listSessionsController(req: Request, res: Response, next: NextFunction) {
  try {
    const rawStatus = Array.isArray(req.query.status) ? req.query.status.join(',') : req.query.status;
    let statuses: SessionStatus[] | undefined;

    if (typeof rawStatus === 'string' && rawStatus.trim().length > 0) {
      const parsed = rawStatus
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter((value): value is SessionStatus => VALID_STATUSES.includes(value as SessionStatus));

      if (parsed.length === 0) {
        return res.status(400).json({ message: 'status must be one or more of: scheduled, live, ended.' });
      }
      statuses = Array.from(new Set(parsed));
    }

    const sessions = await listSessions(statuses);
    return res.status(200).json(sessions);
  } catch (err: any) {
    next(err);
    return res.status(500).json({ message: err.message || 'Failed to list sessions.' });
  }
}

export async function startSessionController(req: Request, res: Response, next: NextFunction) {
  try {
    const { sessionId } = req.body as SessionIdRequest;
    if (!sessionId?.trim()) {
      return res.status(400).json({ message: 'sessionId is required.' });
    }

    const existing = await getSessionById(sessionId);
    if (!existing) {
      return res.status(404).json({ message: 'Session not found.' });
    }
    if (existing.status === 'ended') {
      return res.status(409).json({ message: 'Cannot start an ended session.' });
    }

    await updateSessionStatus(sessionId, 'live');
    const updated = await getSessionById(sessionId);
    return res.status(200).json(updated);
  } catch (err: any) {
    next(err);
    return res.status(500).json({ message: err.message || 'Failed to start session.' });
  }
}

export async function endSessionController(req: Request, res: Response, next: NextFunction) {
  try {
    const { sessionId } = req.body as SessionIdRequest;
    if (!sessionId?.trim()) {
      return res.status(400).json({ message: 'sessionId is required.' });
    }

    const existing = await getSessionById(sessionId);
    if (!existing) {
      return res.status(404).json({ message: 'Session not found.' });
    }
    if (existing.status === 'ended') {
      return res.status(200).json(existing);
    }

    await updateSessionStatus(sessionId, 'ended');
    const updated = await getSessionById(sessionId);
    return res.status(200).json(updated);
  } catch (err: any) {
    next(err);
    return res.status(500).json({ message: err.message || 'Failed to end session.' });
  }
}

export async function upsertSessionParticipantController(req: Request, res: Response, next: NextFunction) {
  try {
    const { sessionId, participantId, displayName, role } = req.body as UpsertParticipantRequest;
    if (!sessionId?.trim()) {
      return res.status(400).json({ message: 'sessionId is required.' });
    }
    if (!participantId?.trim()) {
      return res.status(400).json({ message: 'participantId is required.' });
    }
    if (!displayName?.trim()) {
      return res.status(400).json({ message: 'displayName is required.' });
    }

    const existing = await getSessionById(sessionId);
    if (!existing) {
      return res.status(404).json({ message: 'Session not found.' });
    }

    const participant = await upsertSessionParticipant(sessionId, participantId, displayName, role);
    return res.status(200).json(participant);
  } catch (err: any) {
    next(err);
    return res.status(500).json({ message: err.message || 'Failed to upsert session participant.' });
  }
}

export async function listSessionParticipantsController(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
    if (!sessionId?.trim()) {
      return res.status(400).json({ message: 'sessionId is required.' });
    }

    const existing = await getSessionById(sessionId);
    if (!existing) {
      return res.status(404).json({ message: 'Session not found.' });
    }

    const participants = await listSessionParticipants(sessionId);
    return res.status(200).json(participants);
  } catch (err: any) {
    next(err);
    return res.status(500).json({ message: err.message || 'Failed to list session participants.' });
  }
}
