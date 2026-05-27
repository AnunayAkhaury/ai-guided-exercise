import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addRecordingController,
  createProfileController,
  getProfileController,
  getUserAchievementsController,
  getUserRecordingsController,
  helloWorldController,
  listProfilesController,
  updateProfileController
} from './firebase-controller.js';
import { createProfile, getProfile, listProfilesByRole, updateProfile } from '@/services/Firebase/firebase-auth.js';
import { addRecording, getUserRecordings } from '@/services/Firebase/firebase-recording.js';
import { getAchievements } from '@/services/Firebase/firebase-user.js';

vi.mock('@/services/Firebase/firebase-auth.js', () => ({
  createProfile: vi.fn(),
  getProfile: vi.fn(),
  listProfilesByRole: vi.fn(),
  updateProfile: vi.fn()
}));

vi.mock('@/services/Firebase/firebase-recording.js', () => ({
  addRecording: vi.fn(),
  getUserRecordings: vi.fn()
}));

vi.mock('@/services/Firebase/firebase-user.js', () => ({
  getAchievements: vi.fn()
}));

function createFirebaseTestApp() {
  const app = express();
  app.use(express.json());
  app.get('/', helloWorldController);
  app.post('/firebase/createProfile', createProfileController);
  app.post('/firebase/getProfile', getProfileController);
  app.get('/firebase/profiles', listProfilesController);
  app.post('/firebase/updateProfile', updateProfileController);
  app.post('/firebase/addRecording', addRecordingController);
  app.post('/firebase/getRecordings', getUserRecordingsController);
  app.post('/firebase/achievements', getUserAchievementsController);
  return app;
}

describe('firebase controller routes', () => {
  const app = createFirebaseTestApp();
  const now = new Date('2026-05-27T10:00:00.000Z');

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns a health response', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('OK');
    expect(response.body.requestId).toBeDefined();
  });

  it('creates, fetches, lists, and updates profiles', async () => {
    vi.mocked(createProfile).mockResolvedValue({
      role: 'student',
      username: 'student',
      fullname: 'Student User',
      email: 'student@example.com',
      createdAt: now,
      updatedAt: now
    });
    vi.mocked(getProfile).mockResolvedValue({
      role: 'student',
      username: 'student',
      fullname: 'Student User',
      email: 'student@example.com',
      createdAt: now,
      updatedAt: now
    });
    vi.mocked(listProfilesByRole).mockResolvedValue([
      {
        uid: 'user-1',
        role: 'student',
        username: 'student',
        fullname: 'Student User',
        email: 'student@example.com',
        createdAt: now,
        updatedAt: now
      }
    ]);
    vi.mocked(updateProfile).mockResolvedValue({
      uid: 'user-1',
      role: 'student',
      username: 'new-name',
      fullname: 'Student User',
      email: 'student@example.com',
      createdAt: now,
      updatedAt: now
    });

    const createResponse = await request(app)
      .post('/firebase/createProfile')
      .send({ uid: 'user-1', role: 'student', username: 'student', fullname: 'Student User', email: 'student@example.com' });
    expect(createResponse.status).toBe(200);
    expect(createResponse.body.uid).toBe('user-1');

    const getResponse = await request(app).post('/firebase/getProfile').send({ uid: 'user-1' });
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.username).toBe('student');

    const listResponse = await request(app).get('/firebase/profiles?role=student');
    expect(listResponse.status).toBe(200);
    expect(listProfilesByRole).toHaveBeenCalledWith('student');

    const updateResponse = await request(app)
      .post('/firebase/updateProfile')
      .send({ uid: 'user-1', username: 'new-name', fullname: 'Student User' });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.username).toBe('new-name');
  });

  it('returns 404 when a profile is missing', async () => {
    vi.mocked(getProfile).mockResolvedValue(null);

    const response = await request(app).post('/firebase/getProfile').send({ uid: 'missing-user' });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('User not found');
  });

  it('validates uid before updating a profile', async () => {
    const response = await request(app).post('/firebase/updateProfile').send({ username: 'new-name' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('uid is required.');
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('returns 404 when updating a missing profile', async () => {
    vi.mocked(updateProfile).mockResolvedValue(null);

    const response = await request(app)
      .post('/firebase/updateProfile')
      .send({ uid: 'missing-user', username: 'new-name', fullname: 'Missing User' });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('User not found');
  });

  it('returns validation errors from profile updates', async () => {
    vi.mocked(updateProfile).mockRejectedValue(new Error('username is required'));

    const response = await request(app)
      .post('/firebase/updateProfile')
      .send({ uid: 'user-1', fullname: 'Student User' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('username is required');
  });

  it('adds and lists recordings plus achievements', async () => {
    vi.mocked(addRecording).mockResolvedValue(undefined);
    vi.mocked(getUserRecordings).mockResolvedValue([
      { id: 'recording-1', link: 'https://example.com/video.mp4', exercise: 'pushup', date: now }
    ]);
    vi.mocked(getAchievements).mockResolvedValue([{ id: 'achievement-1' }]);

    const addResponse = await request(app)
      .post('/firebase/addRecording')
      .send({ uid: 'user-1', url: 'https://example.com/video.mp4', exercise: 'pushup' });
    expect(addResponse.status).toBe(200);

    const recordingsResponse = await request(app).post('/firebase/getRecordings').send({ uid: 'user-1' });
    expect(recordingsResponse.status).toBe(200);
    expect(recordingsResponse.body).toHaveLength(1);

    const achievementsResponse = await request(app).post('/firebase/achievements').send({ uid: 'user-1' });
    expect(achievementsResponse.status).toBe(200);
    expect(achievementsResponse.body).toHaveLength(1);
  });
});
