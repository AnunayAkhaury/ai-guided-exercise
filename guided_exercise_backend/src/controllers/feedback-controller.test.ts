import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addClipController,
  addExerciseTimestampController,
  addFeedbackController,
  getFeedbackFromIdController,
  getFeedbackFromUserIdController
} from './feedback-controller.js';
import {
  addClip,
  addExerciseTimestamp,
  addFeedback,
  getFeedbackFromRef,
  getFeedbackFromUserId
} from '@/services/Firebase/firebase-feedback.js';

vi.mock('@/services/Firebase/firebase-feedback.js', () => ({
  addClip: vi.fn(),
  addExerciseTimestamp: vi.fn(),
  addFeedback: vi.fn(),
  getFeedbackFromRef: vi.fn(),
  getFeedbackFromUserId: vi.fn()
}));

function createFeedbackTestApp() {
  const app = express();
  app.use(express.json());
  app.post('/firebase/addTimestamp', addExerciseTimestampController);
  app.post('/firebase/addClip', addClipController);
  app.post('/firebase/addFeedback', addFeedbackController);
  app.get('/firebase/feedback/:feedbackRef', getFeedbackFromIdController);
  app.get('/firebase/feedback/user/:userId', getFeedbackFromUserIdController);
  return app;
}

describe('feedback routes', () => {
  const app = createFeedbackTestApp();

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('adds exercise timestamps', async () => {
    vi.mocked(addExerciseTimestamp).mockResolvedValue(undefined);

    const response = await request(app)
      .post('/firebase/addTimestamp')
      .send({ sessionId: 'session-1', exercise: 'pushup', starttime: 10, endtime: 20 });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Timestamp added.');
    expect(addExerciseTimestamp).toHaveBeenCalledWith('session-1', 'pushup', 10, 20);
  });

  it('protects worker clip callbacks with the worker secret', async () => {
    vi.stubEnv('WORKER_SHARED_SECRET', 'worker-secret');

    const response = await request(app).post('/firebase/addClip').send({ clipUrl: 's3://bucket/key.mp4' });

    expect(response.status).toBe(401);
    expect(addClip).not.toHaveBeenCalled();
  });

  it('requires worker secret configuration for worker callbacks', async () => {
    vi.stubEnv('WORKER_SHARED_SECRET', '');

    const clipResponse = await request(app).post('/firebase/addClip').send({ clipUrl: 's3://bucket/key.mp4' });
    expect(clipResponse.status).toBe(500);

    const feedbackResponse = await request(app).post('/firebase/addFeedback').send({ clipId: 'clip-1' });
    expect(feedbackResponse.status).toBe(500);
  });

  it('adds clips from an authorized worker callback', async () => {
    vi.stubEnv('WORKER_SHARED_SECRET', 'worker-secret');
    vi.mocked(addClip).mockResolvedValue('clip-1');

    const response = await request(app)
      .post('/firebase/addClip')
      .set('x-worker-secret', 'worker-secret')
      .send({
        clipUrl: 's3://bucket/key.mp4',
        exercise: 'pushup',
        userId: 'user-1',
        duration: 12,
        starttime: 100,
        recordingId: 'recording-1',
        sessionId: 'session-1',
        sessionName: 'Class'
      });

    expect(response.status).toBe(200);
    expect(response.body.clipId).toBe('clip-1');
  });

  it('adds feedback from an authorized worker callback', async () => {
    vi.stubEnv('WORKER_SHARED_SECRET', 'worker-secret');
    vi.mocked(addFeedback).mockResolvedValue('feedback-1');

    const response = await request(app)
      .post('/firebase/addFeedback')
      .set('x-worker-secret', 'worker-secret')
      .send({
        clipId: 'clip-1',
        exercise: 'pushup',
        feedbackJson: { reps: 10 },
        starttime: 100,
        userId: 'user-1'
      });

    expect(response.status).toBe(200);
    expect(response.body.feedback_id).toBe('feedback-1');
  });

  it('fetches feedback by id and by user id', async () => {
    const feedback = {
      userId: 'user-1',
      summary: 'Good form',
      starttime: 100,
      score: 90,
      feedbackJson: '{}',
      exercise: 'pushup',
      data: []
    };
    vi.mocked(getFeedbackFromRef).mockResolvedValue(feedback);
    vi.mocked(getFeedbackFromUserId).mockResolvedValue([feedback]);

    const byIdResponse = await request(app).get('/firebase/feedback/feedback-1');
    expect(byIdResponse.status).toBe(200);
    expect(byIdResponse.body.score).toBe(90);

    const byUserResponse = await request(app).get('/firebase/feedback/user/user-1');
    expect(byUserResponse.status).toBe(200);
    expect(byUserResponse.body[0].score).toBe(90);
  });
});
