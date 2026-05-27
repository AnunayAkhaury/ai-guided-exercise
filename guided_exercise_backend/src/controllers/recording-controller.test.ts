import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  completeRecordingProcessingController,
  getClipPlaybackController,
  getClipsByUserController,
  getRecordingPlaybackController,
  listRecordingsBySessionController,
  listRecordingsByUserController,
  startRecordingProcessingController,
  upsertRecordingController
} from './recording-controller.js';
import {
  claimRecordingForProcessing,
  getClipById,
  getClipsByUserId,
  getRecordingById,
  listRecordingsBySessionId,
  listRecordingsByUserId,
  toRecordingId,
  updateRecordingById,
  upsertRecording
} from '@/services/Firebase/firebase-recordings-v2.js';
import {
  findLatestSessionByParticipantId,
  getSessionById,
  getSessionByIvsSessionId,
  getSessionParticipantById,
  updateSessionIvsSessionId
} from '@/services/Firebase/firebase-session.js';
import { startRecordingWorkerTask } from '@/services/AWS/ecs.js';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

vi.mock('@aws-sdk/client-s3', () => ({
  GetObjectCommand: vi.fn(function GetObjectCommand(input) {
    return { input };
  }),
  S3Client: vi.fn(function S3Client() {
    return {};
  })
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn()
}));

vi.mock('@/services/Firebase/firebase-recordings-v2.js', () => ({
  claimRecordingForProcessing: vi.fn(),
  getClipById: vi.fn(),
  getClipsByUserId: vi.fn(),
  getRecordingById: vi.fn(),
  listRecordingsBySessionId: vi.fn(),
  listRecordingsByUserId: vi.fn(),
  toRecordingId: vi.fn(),
  updateRecordingById: vi.fn(),
  upsertRecording: vi.fn()
}));

vi.mock('@/services/Firebase/firebase-session.js', () => ({
  findLatestSessionByParticipantId: vi.fn(),
  getSessionById: vi.fn(),
  getSessionByIvsSessionId: vi.fn(),
  getSessionParticipantById: vi.fn(),
  updateSessionIvsSessionId: vi.fn()
}));

vi.mock('@/services/Firebase/firebase-feedback.js', () => ({
  getTimestamps: vi.fn().mockResolvedValue({ recordingStartMs: null, timestamps: [] })
}));

vi.mock('@/services/AWS/ecs.js', () => ({
  startRecordingWorkerTask: vi.fn()
}));

vi.mock('@/services/notification-service.js', () => ({
  sendNotificationToUsers: vi.fn()
}));

const now = new Date('2026-05-27T10:00:00.000Z');

function session() {
  return {
    sessionId: 'session-1',
    ivsSessionId: 'st-1',
    sessionCode: 'ABC123',
    sessionName: 'Recovery Strength',
    stageArn: 'stage-arn',
    instructorUid: 'instructor-1',
    coachName: 'Coach',
    status: 'ended' as const,
    scheduledStartAt: null,
    scheduledEndAt: null,
    createdAt: now,
    updatedAt: now,
    startedAt: now,
    endedAt: now,
    reminderSentAt: null
  };
}

function recording(overrides = {}) {
  return {
    recordingId: 'recording-1',
    sessionId: 'session-1',
    participantId: 'participant-1',
    userId: 'user-1',
    rawS3Prefix: 'bucket/raw/session-1/',
    recordingStart: now,
    recordingEnd: now,
    durationMs: 60_000,
    status: 'completed' as const,
    processedVideoUrl: 's3://bucket/processed/recording-1.mp4',
    feedbackJsonUrl: null,
    error: null,
    source: 'manual' as const,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function createRecordingTestApp() {
  const app = express();
  app.use(express.json());
  app.post('/recordings/upsert', upsertRecordingController);
  app.get('/recordings/session/:sessionId', listRecordingsBySessionController);
  app.get('/recordings/user/:userId', listRecordingsByUserController);
  app.get('/clips/user/:userId', getClipsByUserController);
  app.get('/recordings/:recordingId/playback', getRecordingPlaybackController);
  app.get('/clips/:clipId/playback', getClipPlaybackController);
  app.post('/recordings/:recordingId/process', startRecordingProcessingController);
  app.post('/recordings/worker-complete', completeRecordingProcessingController);
  return app;
}

describe('recording controller routes', () => {
  const app = createRecordingTestApp();

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('protects recording ingest with the ingest secret', async () => {
    vi.stubEnv('RECORDING_INGEST_SECRET', 'ingest-secret');

    const response = await request(app).post('/recordings/upsert').send({
      sessionId: 'session-1',
      participantId: 'participant-1',
      rawS3Prefix: 's3://bucket/raw/session-1/'
    });

    expect(response.status).toBe(401);
    expect(upsertRecording).not.toHaveBeenCalled();
  });

  it('validates required recording ingest fields and server secret configuration', async () => {
    vi.stubEnv('RECORDING_INGEST_SECRET', '');
    const missingConfigResponse = await request(app)
      .post('/recordings/upsert')
      .set('x-ingest-secret', 'ingest-secret')
      .send();
    expect(missingConfigResponse.status).toBe(500);

    vi.stubEnv('RECORDING_INGEST_SECRET', 'ingest-secret');
    const missingFieldResponse = await request(app)
      .post('/recordings/upsert')
      .set('x-ingest-secret', 'ingest-secret')
      .send({ sessionId: 'session-1' });
    expect(missingFieldResponse.status).toBe(400);
    expect(missingFieldResponse.body.message).toBe('participantId is required.');
  });

  it('upserts a recording from an authorized ingest request', async () => {
    vi.stubEnv('RECORDING_INGEST_SECRET', 'ingest-secret');
    vi.mocked(getSessionByIvsSessionId).mockResolvedValue(null);
    vi.mocked(getSessionById).mockResolvedValue(session());
    vi.mocked(getSessionParticipantById).mockResolvedValue({
      participantId: 'participant-1',
      userId: 'user-1',
      displayName: 'Student',
      role: 'student',
      active: false,
      joinedAt: now,
      leftAt: now,
      lastSeenAt: now,
      updatedAt: now
    });
    vi.mocked(toRecordingId).mockReturnValue('recording-1');
    vi.mocked(getRecordingById).mockResolvedValue(null);
    vi.mocked(upsertRecording).mockResolvedValue(recording({ status: 'queued', processedVideoUrl: null }));

    const response = await request(app)
      .post('/recordings/upsert')
      .set('x-ingest-secret', 'ingest-secret')
      .send({
        sessionId: 'session-1',
        participantId: 'participant-1',
        rawS3Prefix: 's3://bucket/raw/session-1/',
        status: 'queued',
        source: 'manual'
      });

    expect(response.status).toBe(200);
    expect(response.body.recordingId).toBe('recording-1');
    expect(findLatestSessionByParticipantId).not.toHaveBeenCalled();
    expect(updateSessionIvsSessionId).not.toHaveBeenCalled();
  });

  it('infers app sessions from IVS participant linkage during ingest', async () => {
    vi.stubEnv('RECORDING_INGEST_SECRET', 'ingest-secret');
    vi.mocked(getSessionByIvsSessionId).mockResolvedValue(null);
    vi.mocked(getSessionById).mockResolvedValue(null);
    vi.mocked(findLatestSessionByParticipantId).mockResolvedValue(session());
    vi.mocked(getSessionParticipantById).mockResolvedValue({
      participantId: 'participant-1',
      userId: 'user-1',
      displayName: 'Student',
      role: 'student',
      active: false,
      joinedAt: now,
      leftAt: now,
      lastSeenAt: now,
      updatedAt: now
    });
    vi.mocked(toRecordingId).mockReturnValue('recording-1');
    vi.mocked(getRecordingById).mockResolvedValue(null);
    vi.mocked(upsertRecording).mockResolvedValue(recording({ status: 'queued', processedVideoUrl: null }));

    const response = await request(app)
      .post('/recordings/upsert')
      .set('x-ingest-secret', 'ingest-secret')
      .send({
        sessionId: 'st-123456789',
        participantId: 'participant-1',
        rawS3Prefix: 's3://bucket/raw/session-1/',
        status: 'queued',
        source: 'manual'
      });

    expect(response.status).toBe(200);
    expect(findLatestSessionByParticipantId).toHaveBeenCalledWith('participant-1');
    expect(updateSessionIvsSessionId).toHaveBeenCalledWith('session-1', 'st-123456789');
  });

  it('lists recordings by session and user with session names', async () => {
    vi.mocked(getSessionById).mockResolvedValue(session());
    vi.mocked(listRecordingsBySessionId).mockResolvedValue([recording()]);
    vi.mocked(listRecordingsByUserId).mockResolvedValue([recording()]);

    const bySessionResponse = await request(app).get('/recordings/session/session-1');
    expect(bySessionResponse.status).toBe(200);
    expect(bySessionResponse.body[0].sessionName).toBe('Recovery Strength');

    const byUserResponse = await request(app).get('/recordings/user/user-1');
    expect(byUserResponse.status).toBe(200);
    expect(byUserResponse.body[0].sessionName).toBe('Recovery Strength');
  });

  it('lists clips for a user', async () => {
    vi.mocked(getClipsByUserId).mockResolvedValue([
      {
        id: 'clip-1',
        clipUrl: 's3://bucket/clips/clip-1.mp4',
        duration: '10',
        exercise: 'pushup',
        feedbackRef: null,
        starttime: '100',
        recordingId: 'recording-1',
        sessionId: 'session-1',
        sessionName: 'Recovery Strength',
        userId: 'user-1'
      }
    ]);

    const response = await request(app).get('/clips/user/user-1');

    expect(response.status).toBe(200);
    expect(response.body[0].id).toBe('clip-1');
  });

  it('returns signed playback URLs for recordings and clips', async () => {
    vi.mocked(getRecordingById).mockResolvedValue(recording());
    vi.mocked(getClipById).mockResolvedValue({
      clipUrl: 's3://bucket/clips/clip-1.mp4',
      duration: '10',
      exercise: 'pushup',
      feedbackRef: null,
      starttime: '100',
      userId: 'user-1'
    });
    vi.mocked(getSignedUrl).mockResolvedValue('https://signed.example/video.mp4');

    const recordingResponse = await request(app).get('/recordings/recording-1/playback');
    expect(recordingResponse.status).toBe(200);
    expect(recordingResponse.body.playbackUrl).toBe('https://signed.example/video.mp4');

    const clipResponse = await request(app).get('/clips/clip-1/playback');
    expect(clipResponse.status).toBe(200);
    expect(clipResponse.body.exercise).toBe('pushup');
  });

  it('returns playback errors for missing recordings and clips', async () => {
    vi.mocked(getRecordingById).mockResolvedValue(null);
    const missingRecordingResponse = await request(app).get('/recordings/missing/playback');
    expect(missingRecordingResponse.status).toBe(404);

    vi.mocked(getClipById).mockResolvedValue(null);
    const missingClipResponse = await request(app).get('/clips/missing/playback');
    expect(missingClipResponse.status).toBe(404);
  });

  it('starts recording processing when eligible', async () => {
    vi.mocked(getRecordingById).mockResolvedValue(recording({ status: 'queued', processedVideoUrl: null }));
    vi.mocked(updateRecordingById).mockResolvedValue(recording({ status: 'processing', processedVideoUrl: null }));
    vi.mocked(startRecordingWorkerTask).mockResolvedValue('task-arn');

    const response = await request(app).post('/recordings/recording-1/process').send();

    expect(response.status).toBe(202);
    expect(response.body.taskArn).toBe('task-arn');
    expect(updateRecordingById).toHaveBeenCalledWith('recording-1', {
      status: 'processing',
      error: null
    });
  });

  it('rejects ineligible manual recording processing requests', async () => {
    vi.mocked(getRecordingById).mockResolvedValue(recording({ status: 'processing', processedVideoUrl: null }));

    const response = await request(app).post('/recordings/recording-1/process').send();

    expect(response.status).toBe(409);
    expect(startRecordingWorkerTask).not.toHaveBeenCalled();
  });

  it('marks recordings failed when ECS cannot start', async () => {
    vi.mocked(getRecordingById).mockResolvedValue(recording({ status: 'queued', processedVideoUrl: null }));
    vi.mocked(updateRecordingById)
      .mockResolvedValueOnce(recording({ status: 'processing', processedVideoUrl: null }))
      .mockResolvedValueOnce(recording({ status: 'failed', processedVideoUrl: null, error: 'ECS failed' }));
    vi.mocked(startRecordingWorkerTask).mockRejectedValue(new Error('ECS failed'));

    const response = await request(app).post('/recordings/recording-1/process').send();

    expect(response.status).toBe(500);
    expect(response.body.recording.status).toBe('failed');
  });

  it('handles successful worker completion callbacks', async () => {
    vi.stubEnv('WORKER_SHARED_SECRET', 'worker-secret');
    vi.mocked(getRecordingById).mockResolvedValue(recording({ status: 'processing', processedVideoUrl: null }));
    vi.mocked(updateRecordingById).mockResolvedValue(recording({ processedVideoUrl: 's3://bucket/processed/final.mp4' }));

    const response = await request(app)
      .post('/recordings/worker-complete')
      .set('x-worker-secret', 'worker-secret')
      .send({ recordingId: 'recording-1', processedVideoUrl: 's3://bucket/processed/final.mp4' });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Recording processing completed.');
    expect(claimRecordingForProcessing).not.toHaveBeenCalled();
  });

  it('handles failed and invalid worker completion callbacks', async () => {
    vi.stubEnv('WORKER_SHARED_SECRET', 'worker-secret');

    const unauthorizedResponse = await request(app)
      .post('/recordings/worker-complete')
      .set('x-worker-secret', 'wrong-secret')
      .send({ recordingId: 'recording-1' });
    expect(unauthorizedResponse.status).toBe(401);

    vi.mocked(getRecordingById).mockResolvedValue(recording({ status: 'processing', processedVideoUrl: null }));
    vi.mocked(updateRecordingById).mockResolvedValue(recording({ status: 'failed', processedVideoUrl: null, error: 'bad video' }));

    const failedResponse = await request(app)
      .post('/recordings/worker-complete')
      .set('x-worker-secret', 'worker-secret')
      .send({ recordingId: 'recording-1', status: 'failed', error: 'bad video' });
    expect(failedResponse.status).toBe(200);
    expect(failedResponse.body.recording.status).toBe('failed');

    const missingUrlResponse = await request(app)
      .post('/recordings/worker-complete')
      .set('x-worker-secret', 'worker-secret')
      .send({ recordingId: 'recording-1' });
    expect(missingUrlResponse.status).toBe(400);
  });
});
