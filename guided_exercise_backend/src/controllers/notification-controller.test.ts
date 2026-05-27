import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  registerPushTokenController,
  sendDueClassRemindersController,
  unregisterPushTokenController
} from './notification-controller.js';
import { registerPushToken, disablePushToken } from '@/services/Firebase/firebase-push-tokens.js';
import { listSessions, markSessionReminderSent } from '@/services/Firebase/firebase-session.js';
import { sendNotificationToRole } from '@/services/notification-service.js';

vi.mock('@/services/Firebase/firebase-push-tokens.js', () => ({
  registerPushToken: vi.fn(),
  disablePushToken: vi.fn()
}));

vi.mock('@/services/Firebase/firebase-session.js', () => ({
  listSessions: vi.fn(),
  markSessionReminderSent: vi.fn()
}));

vi.mock('@/services/notification-service.js', () => ({
  sendNotificationToRole: vi.fn()
}));

function createNotificationTestApp() {
  const app = express();
  app.use(express.json());
  app.post('/api/notifications/register-token', registerPushTokenController);
  app.post('/api/notifications/unregister-token', unregisterPushTokenController);
  app.post('/api/notifications/class-reminders/send-due', sendDueClassRemindersController);
  return app;
}

describe('notification routes', () => {
  const app = createNotificationTestApp();

  beforeEach(() => {
    vi.stubEnv('NOTIFICATION_CRON_SECRET', 'test-cron-secret');
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  describe('POST /api/notifications/register-token', () => {
    it('returns 400 when uid is missing', async () => {
      const response = await request(app)
        .post('/api/notifications/register-token')
        .send({
          token: 'ExpoPushToken[test]',
          type: 'expo',
          platform: 'ios'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('uid is required.');
      expect(registerPushToken).not.toHaveBeenCalled();
    });

    it('returns 400 when token type or platform is invalid', async () => {
      const invalidTypeResponse = await request(app)
        .post('/api/notifications/register-token')
        .send({
          uid: 'user-1',
          token: 'ExpoPushToken[test]',
          type: 'apns',
          platform: 'ios'
        });

      expect(invalidTypeResponse.status).toBe(400);
      expect(invalidTypeResponse.body.message).toBe('type must be expo or fcm_web.');

      const invalidPlatformResponse = await request(app)
        .post('/api/notifications/register-token')
        .send({
          uid: 'user-1',
          token: 'ExpoPushToken[test]',
          type: 'expo',
          platform: 'desktop'
        });

      expect(invalidPlatformResponse.status).toBe(400);
      expect(invalidPlatformResponse.body.message).toBe('platform must be ios, android, or web.');
      expect(registerPushToken).not.toHaveBeenCalled();
    });

    it('registers a valid push token', async () => {
      vi.mocked(registerPushToken).mockResolvedValue({
        tokenId: 'token-doc-1',
        uid: 'user-1',
        token: 'ExpoPushToken[test]',
        type: 'expo',
        platform: 'ios',
        deviceName: 'Anunay iPhone',
        enabled: true,
        createdAt: new Date('2026-05-27T10:00:00.000Z'),
        updatedAt: new Date('2026-05-27T10:00:00.000Z'),
        lastError: null
      });

      const response = await request(app)
        .post('/api/notifications/register-token')
        .send({
          uid: ' user-1 ',
          token: ' ExpoPushToken[test] ',
          type: 'expo',
          platform: 'ios',
          deviceName: ' Anunay iPhone '
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        tokenId: 'token-doc-1',
        type: 'expo',
        platform: 'ios'
      });
      expect(registerPushToken).toHaveBeenCalledWith({
        uid: 'user-1',
        token: 'ExpoPushToken[test]',
        type: 'expo',
        platform: 'ios',
        deviceName: 'Anunay iPhone'
      });
    });
  });

  describe('POST /api/notifications/unregister-token', () => {
    it('returns 400 when token is missing', async () => {
      const response = await request(app)
        .post('/api/notifications/unregister-token')
        .send({ uid: 'user-1' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('token is required.');
      expect(disablePushToken).not.toHaveBeenCalled();
    });

    it('unregisters a valid push token', async () => {
      vi.mocked(disablePushToken).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/notifications/unregister-token')
        .send({ uid: ' user-1 ', token: ' token-1 ' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(disablePushToken).toHaveBeenCalledWith('user-1', 'token-1');
    });
  });

  describe('POST /api/notifications/class-reminders/send-due', () => {
    it('returns 500 when cron secret is not configured', async () => {
      vi.stubEnv('NOTIFICATION_CRON_SECRET', '');

      const response = await request(app)
        .post('/api/notifications/class-reminders/send-due')
        .set('x-cron-secret', 'test-cron-secret')
        .send();

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Notification cron secret is not configured on server.');
      expect(listSessions).not.toHaveBeenCalled();
    });

    it('returns 401 when cron secret is invalid', async () => {
      const response = await request(app)
        .post('/api/notifications/class-reminders/send-due')
        .set('x-cron-secret', 'wrong-secret')
        .send();

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Unauthorized notification cron request.');
      expect(listSessions).not.toHaveBeenCalled();
    });

    it('returns counts when no scheduled sessions are due', async () => {
      vi.mocked(listSessions).mockResolvedValue([
        {
          sessionId: 'session-1',
          ivsSessionId: null,
          sessionCode: 'ABC123',
          sessionName: 'Recovery Strength',
          stageArn: 'stage-arn',
          instructorUid: 'instructor-1',
          coachName: 'Coach',
          status: 'scheduled',
          scheduledStartAt: new Date(Date.now() + 30 * 60 * 1000),
          scheduledEndAt: null,
          createdAt: new Date('2026-05-27T10:00:00.000Z'),
          updatedAt: new Date('2026-05-27T10:00:00.000Z'),
          startedAt: null,
          endedAt: null,
          reminderSentAt: null
        }
      ]);

      const response = await request(app)
        .post('/api/notifications/class-reminders/send-due')
        .set('x-cron-secret', 'test-cron-secret')
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        checked: 1,
        due: 0,
        sent: 0,
        failed: 0
      });
      expect(sendNotificationToRole).not.toHaveBeenCalled();
      expect(markSessionReminderSent).not.toHaveBeenCalled();
    });
  });
});
