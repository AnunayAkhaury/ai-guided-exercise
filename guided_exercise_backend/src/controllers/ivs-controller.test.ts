import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIvsTokenController } from './ivs-controller.js';
import { getSessionById } from '@/services/Firebase/firebase-session.js';

const sendMock = vi.fn();

vi.mock('@aws-sdk/client-ivs-realtime', () => ({
  CreateParticipantTokenCommand: vi.fn(function CreateParticipantTokenCommand(input) {
    return { input };
  }),
  IVSRealTimeClient: vi.fn(function IVSRealTimeClient() {
    return { send: sendMock };
  })
}));

vi.mock('@/services/Firebase/firebase-session.js', () => ({
  getSessionById: vi.fn()
}));

function createIvsTestApp() {
  const app = express();
  app.use(express.json());
  app.post('/ivs/token', createIvsTokenController);
  return app;
}

describe('IVS token route', () => {
  const app = createIvsTestApp();

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('requires a stage ARN', async () => {
    const response = await request(app).post('/ivs/token').send({ userName: 'Student', publish: true });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('stageArn is required (or set IVS_STAGE_ARN).');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('rejects invalid token duration before calling AWS', async () => {
    vi.stubEnv('IVS_STAGE_ARN', 'stage-arn');

    const response = await request(app)
      .post('/ivs/token')
      .send({ userName: 'Student', publish: true, durationMinutes: 721 });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('durationMinutes must be an integer between 1 and 720.');
  });

  it('creates a scoped IVS participant token', async () => {
    vi.stubEnv('IVS_STAGE_ARN', 'stage-arn');
    vi.mocked(getSessionById).mockResolvedValue({
      sessionId: 'session-1',
      ivsSessionId: null,
      sessionCode: 'ABC123',
      sessionName: 'Class',
      stageArn: 'stage-arn',
      instructorUid: 'instructor-1',
      coachName: 'Coach',
      status: 'live',
      scheduledStartAt: null,
      scheduledEndAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      startedAt: new Date(),
      endedAt: null,
      reminderSentAt: null
    });
    sendMock.mockResolvedValue({
      participantToken: {
        participantId: 'participant-1',
        token: 'token-1',
        expirationTime: new Date('2026-05-27T11:00:00.000Z')
      }
    });

    const response = await request(app).post('/ivs/token').send({
      userName: 'Coach',
      userId: 'instructor-1',
      publish: true,
      subscribe: true,
      attributes: { sessionId: 'session-1' },
      durationMinutes: 60
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      participantId: 'participant-1',
      token: 'token-1'
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});
