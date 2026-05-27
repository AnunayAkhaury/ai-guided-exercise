import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createAndStartSessionController,
  createSessionController,
  endSessionController,
  getSessionByIdController,
  heartbeatSessionParticipantController,
  joinSessionByCodeController,
  leaveSessionParticipantController,
  listSessionParticipantsController,
  listSessionsController,
  startSessionController,
  upsertSessionParticipantController
} from './session-controller.js';
import {
  createSession,
  endOtherLiveSessions,
  getSessionByCode,
  getSessionById,
  heartbeatSessionParticipant,
  listSessionParticipants,
  listSessions,
  markSessionParticipantLeft,
  upsertSessionParticipant,
  updateSessionStatus
} from '@/services/Firebase/firebase-session.js';

vi.mock('@aws-sdk/client-ivs-realtime', () => ({
  DisconnectParticipantCommand: vi.fn(function DisconnectParticipantCommand(input) {
    return { input };
  }),
  IVSRealTimeClient: vi.fn(function IVSRealTimeClient() {
    return {
      send: vi.fn().mockResolvedValue({})
    };
  })
}));

vi.mock('@/services/Firebase/firebase-session.js', () => ({
  createSession: vi.fn(),
  endOtherLiveSessions: vi.fn(),
  getSessionByCode: vi.fn(),
  getSessionById: vi.fn(),
  heartbeatSessionParticipant: vi.fn(),
  listSessionParticipants: vi.fn(),
  listSessions: vi.fn(),
  markSessionParticipantLeft: vi.fn(),
  upsertSessionParticipant: vi.fn(),
  updateSessionStatus: vi.fn()
}));

vi.mock('@/services/notification-service.js', () => ({
  sendNotificationToRole: vi.fn()
}));

const now = new Date('2026-05-27T10:00:00.000Z');

function session(overrides: Partial<Awaited<ReturnType<typeof getSessionById>>> = {}) {
  return {
    sessionId: 'session-1',
    ivsSessionId: null,
    sessionCode: 'ABC123',
    sessionName: 'Recovery Strength',
    stageArn: 'stage-arn',
    instructorUid: 'instructor-1',
    coachName: 'Coach',
    status: 'scheduled' as const,
    scheduledStartAt: null,
    scheduledEndAt: null,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    endedAt: null,
    reminderSentAt: null,
    ...overrides
  };
}

function participant(overrides = {}) {
  return {
    participantId: 'participant-1',
    userId: 'user-1',
    displayName: 'Student',
    role: 'student',
    active: true,
    joinedAt: now,
    leftAt: null,
    lastSeenAt: now,
    updatedAt: now,
    ...overrides
  };
}

function createSessionTestApp() {
  const app = express();
  app.use(express.json());
  app.post('/sessions', createSessionController);
  app.post('/sessions/create-and-start', createAndStartSessionController);
  app.post('/sessions/join', joinSessionByCodeController);
  app.get('/sessions', listSessionsController);
  app.get('/sessions/:sessionId', getSessionByIdController);
  app.post('/sessions/start', startSessionController);
  app.post('/sessions/end', endSessionController);
  app.post('/sessions/participants/upsert', upsertSessionParticipantController);
  app.get('/sessions/:sessionId/participants', listSessionParticipantsController);
  app.post('/sessions/participants/leave', leaveSessionParticipantController);
  app.post('/sessions/participants/heartbeat', heartbeatSessionParticipantController);
  return app;
}

describe('session controller routes', () => {
  const app = createSessionTestApp();

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('validates required fields when creating a session', async () => {
    const response = await request(app).post('/sessions').send({ instructorUid: 'instructor-1' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('sessionName is required.');
    expect(createSession).not.toHaveBeenCalled();
  });

  it('creates a scheduled session with the default stage ARN', async () => {
    vi.stubEnv('IVS_STAGE_ARN', 'stage-from-env');
    vi.mocked(createSession).mockResolvedValue(session());

    const response = await request(app)
      .post('/sessions')
      .send({ sessionName: 'Recovery Strength', instructorUid: 'instructor-1', coachName: 'Coach' });

    expect(response.status).toBe(200);
    expect(response.body.sessionId).toBe('session-1');
    expect(createSession).toHaveBeenCalledWith({
      sessionName: 'Recovery Strength',
      instructorUid: 'instructor-1',
      coachName: 'Coach',
      stageArn: 'stage-from-env'
    });
  });

  it('rejects invalid schedule ranges', async () => {
    vi.stubEnv('IVS_STAGE_ARN', 'stage-from-env');

    const response = await request(app).post('/sessions').send({
      sessionName: 'Recovery Strength',
      instructorUid: 'instructor-1',
      scheduledStartAt: '2026-05-27T11:00:00.000Z',
      scheduledEndAt: '2026-05-27T10:00:00.000Z'
    });

    expect(response.status).toBe(400);
    expect(createSession).not.toHaveBeenCalled();
  });

  it('creates and starts an immediate session', async () => {
    vi.stubEnv('IVS_STAGE_ARN', 'stage-from-env');
    vi.mocked(createSession).mockResolvedValue(session());
    vi.mocked(getSessionById)
      .mockResolvedValueOnce(session())
      .mockResolvedValueOnce(session({ status: 'live' }));
    vi.mocked(listSessions).mockResolvedValue([]);

    const response = await request(app)
      .post('/sessions/create-and-start')
      .send({ sessionName: 'Recovery Strength', instructorUid: 'instructor-1' });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('live');
    expect(updateSessionStatus).toHaveBeenCalledWith('session-1', 'live');
  });

  it('rejects joining scheduled sessions by code', async () => {
    vi.mocked(getSessionByCode).mockResolvedValue(session());

    const response = await request(app).post('/sessions/join').send({ sessionCode: 'abc123' });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('Session is not live yet.');
  });

  it('returns not found and ended states when joining by code', async () => {
    vi.mocked(getSessionByCode).mockResolvedValueOnce(null);

    const missingResponse = await request(app).post('/sessions/join').send({ sessionCode: 'missing' });
    expect(missingResponse.status).toBe(404);

    vi.mocked(getSessionByCode).mockResolvedValueOnce(session({ status: 'ended' }));
    const endedResponse = await request(app).post('/sessions/join').send({ sessionCode: 'ended' });
    expect(endedResponse.status).toBe(410);
  });

  it('returns a live session when joining by code', async () => {
    vi.mocked(getSessionByCode).mockResolvedValue(session({ status: 'live' }));

    const response = await request(app).post('/sessions/join').send({ sessionCode: 'abc123' });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('live');
  });

  it('lists sessions with parsed statuses', async () => {
    vi.mocked(listSessions).mockResolvedValue([session({ status: 'live' })]);

    const response = await request(app).get('/sessions?status=live,scheduled');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(listSessions).toHaveBeenCalledWith(['live', 'scheduled']);
  });

  it('rejects invalid list session statuses and fetches sessions by id', async () => {
    const invalidStatusResponse = await request(app).get('/sessions?status=paused');
    expect(invalidStatusResponse.status).toBe(400);

    vi.mocked(getSessionById).mockResolvedValueOnce(session());
    const getResponse = await request(app).get('/sessions/session-1');
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.sessionId).toBe('session-1');

    vi.mocked(getSessionById).mockResolvedValueOnce(null);
    const missingResponse = await request(app).get('/sessions/missing');
    expect(missingResponse.status).toBe(404);
  });

  it('starts only sessions owned by the requester', async () => {
    vi.mocked(getSessionById)
      .mockResolvedValueOnce(session({ scheduledStartAt: new Date(Date.now() - 60_000) }))
      .mockResolvedValueOnce(session({ status: 'live' }));
    vi.mocked(listSessions).mockResolvedValue([]);

    const response = await request(app)
      .post('/sessions/start')
      .send({ sessionId: 'session-1', requesterUid: 'instructor-1' });

    expect(response.status).toBe(200);
    expect(endOtherLiveSessions).toHaveBeenCalledWith('session-1');
    expect(updateSessionStatus).toHaveBeenCalledWith('session-1', 'live');
  });

  it('rejects start requests with missing requester or wrong owner', async () => {
    const missingRequesterResponse = await request(app).post('/sessions/start').send({ sessionId: 'session-1' });
    expect(missingRequesterResponse.status).toBe(403);

    vi.mocked(getSessionById).mockResolvedValue(session({ instructorUid: 'instructor-1' }));
    const wrongOwnerResponse = await request(app)
      .post('/sessions/start')
      .send({ sessionId: 'session-1', requesterUid: 'other-instructor' });
    expect(wrongOwnerResponse.status).toBe(403);
  });

  it('blocks non-owners from ending a session', async () => {
    vi.mocked(getSessionById).mockResolvedValue(session());

    const response = await request(app)
      .post('/sessions/end')
      .send({ sessionId: 'session-1', requesterUid: 'other-instructor' });

    expect(response.status).toBe(403);
    expect(updateSessionStatus).not.toHaveBeenCalled();
  });

  it('ends a session for its creator', async () => {
    vi.mocked(getSessionById)
      .mockResolvedValueOnce(session())
      .mockResolvedValueOnce(session({ status: 'ended' }));

    const response = await request(app)
      .post('/sessions/end')
      .send({ sessionId: 'session-1', requesterUid: 'instructor-1' });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ended');
    expect(updateSessionStatus).toHaveBeenCalledWith('session-1', 'ended');
  });

  it('disconnects known participants when ending a live session', async () => {
    vi.mocked(getSessionById)
      .mockResolvedValueOnce(session({ status: 'live' }))
      .mockResolvedValueOnce(session({ status: 'ended' }));
    vi.mocked(listSessionParticipants).mockResolvedValue([participant()]);

    const response = await request(app)
      .post('/sessions/end')
      .send({ sessionId: 'session-1', requesterUid: 'instructor-1' });

    expect(response.status).toBe(200);
    expect(listSessionParticipants).toHaveBeenCalledWith('session-1');
  });

  it('returns participant not found for leave and heartbeat misses', async () => {
    vi.mocked(getSessionById).mockResolvedValue(session({ status: 'live' }));
    vi.mocked(markSessionParticipantLeft).mockResolvedValue(null);
    vi.mocked(heartbeatSessionParticipant).mockResolvedValue(null);

    const leaveResponse = await request(app)
      .post('/sessions/participants/leave')
      .send({ sessionId: 'session-1', participantId: 'missing' });
    expect(leaveResponse.status).toBe(404);

    const heartbeatResponse = await request(app)
      .post('/sessions/participants/heartbeat')
      .send({ sessionId: 'session-1', participantId: 'missing' });
    expect(heartbeatResponse.status).toBe(404);
  });

  it('upserts, lists, leaves, and heartbeats participants', async () => {
    vi.mocked(getSessionById).mockResolvedValue(session({ status: 'live' }));
    vi.mocked(upsertSessionParticipant).mockResolvedValue(participant());
    vi.mocked(listSessionParticipants).mockResolvedValue([participant()]);
    vi.mocked(markSessionParticipantLeft).mockResolvedValue(participant({ active: false, leftAt: now }));
    vi.mocked(heartbeatSessionParticipant).mockResolvedValue(participant());

    const upsertResponse = await request(app)
      .post('/sessions/participants/upsert')
      .send({ sessionId: 'session-1', participantId: 'participant-1', displayName: 'Student' });
    expect(upsertResponse.status).toBe(200);

    const listResponse = await request(app).get('/sessions/session-1/participants');
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toHaveLength(1);

    const leaveResponse = await request(app)
      .post('/sessions/participants/leave')
      .send({ sessionId: 'session-1', participantId: 'participant-1' });
    expect(leaveResponse.status).toBe(200);
    expect(leaveResponse.body.success).toBe(true);

    const heartbeatResponse = await request(app)
      .post('/sessions/participants/heartbeat')
      .send({ sessionId: 'session-1', participantId: 'participant-1' });
    expect(heartbeatResponse.status).toBe(200);
    expect(heartbeatResponse.body.active).toBe(true);
  });
});
