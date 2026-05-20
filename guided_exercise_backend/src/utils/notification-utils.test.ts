import { describe, expect, it } from 'vitest';
import {
  getCronSecretStatus,
  getDueReminderSessions,
  isSessionDueForReminder,
  summarizeSettledResults,
  validatePushTokenRegistration,
  validatePushTokenUnregistration
} from './notification-utils.js';

describe('notification utils', () => {
  describe('validatePushTokenRegistration', () => {
    it('requires uid and token', () => {
      expect(
        validatePushTokenRegistration({
          token: 'ExpoPushToken[test]',
          type: 'expo',
          platform: 'ios'
        })
      ).toEqual({ valid: false, message: 'uid is required.' });

      expect(
        validatePushTokenRegistration({
          uid: 'user-1',
          type: 'expo',
          platform: 'ios'
        })
      ).toEqual({ valid: false, message: 'token is required.' });
    });

    it('requires a supported token type and platform', () => {
      expect(
        validatePushTokenRegistration({
          uid: 'user-1',
          token: 'token-1',
          type: 'apns',
          platform: 'ios'
        })
      ).toEqual({ valid: false, message: 'type must be expo or fcm_web.' });

      expect(
        validatePushTokenRegistration({
          uid: 'user-1',
          token: 'token-1',
          type: 'expo',
          platform: 'desktop'
        })
      ).toEqual({ valid: false, message: 'platform must be ios, android, or web.' });
    });

    it('normalizes valid native Expo push token registrations', () => {
      expect(
        validatePushTokenRegistration({
          uid: ' user-1 ',
          token: ' ExpoPushToken[test] ',
          type: 'expo',
          platform: 'ios',
          deviceName: ' Anunay iPhone '
        })
      ).toEqual({
        valid: true,
        uid: 'user-1',
        token: 'ExpoPushToken[test]',
        type: 'expo',
        platform: 'ios',
        deviceName: 'Anunay iPhone'
      });
    });

    it('normalizes valid web FCM token registrations and omits blank device names', () => {
      expect(
        validatePushTokenRegistration({
          uid: 'user-1',
          token: 'web-token-1',
          type: 'fcm_web',
          platform: 'web',
          deviceName: '   '
        })
      ).toEqual({
        valid: true,
        uid: 'user-1',
        token: 'web-token-1',
        type: 'fcm_web',
        platform: 'web'
      });
    });
  });

  describe('validatePushTokenUnregistration', () => {
    it('requires uid and token', () => {
      expect(validatePushTokenUnregistration({ token: 'token-1' })).toEqual({
        valid: false,
        message: 'uid is required.'
      });
      expect(validatePushTokenUnregistration({ uid: 'user-1' })).toEqual({
        valid: false,
        message: 'token is required.'
      });
    });

    it('normalizes valid unregister requests', () => {
      expect(validatePushTokenUnregistration({ uid: ' user-1 ', token: ' token-1 ' })).toEqual({
        valid: true,
        uid: 'user-1',
        token: 'token-1'
      });
    });
  });

  describe('getCronSecretStatus', () => {
    it('requires a configured server secret', () => {
      expect(getCronSecretStatus(undefined, 'provided')).toBe('missing');
      expect(getCronSecretStatus('   ', 'provided')).toBe('missing');
    });

    it('validates the provided cron secret against the trimmed server secret', () => {
      expect(getCronSecretStatus(' secret-value ', 'secret-value')).toBe('valid');
      expect(getCronSecretStatus('secret-value', 'wrong-secret')).toBe('invalid');
      expect(getCronSecretStatus('secret-value', undefined)).toBe('invalid');
    });
  });

  describe('isSessionDueForReminder', () => {
    const nowMs = new Date('2026-05-20T16:00:00.000Z').getTime();
    const leadMs = 5 * 60 * 1000;

    it('returns true for scheduled sessions inside the reminder window', () => {
      expect(
        isSessionDueForReminder(
          {
            scheduledStartAt: new Date('2026-05-20T16:04:59.000Z'),
            reminderSentAt: null
          },
          nowMs,
          leadMs
        )
      ).toBe(true);

      expect(
        isSessionDueForReminder(
          {
            scheduledStartAt: new Date('2026-05-20T16:05:00.000Z'),
            reminderSentAt: null
          },
          nowMs,
          leadMs
        )
      ).toBe(true);
    });

    it('returns false for sessions without a scheduled start', () => {
      expect(
        isSessionDueForReminder(
          {
            scheduledStartAt: null,
            reminderSentAt: null
          },
          nowMs,
          leadMs
        )
      ).toBe(false);
    });

    it('returns false before the reminder window opens', () => {
      expect(
        isSessionDueForReminder(
          {
            scheduledStartAt: new Date('2026-05-20T16:05:01.000Z'),
            reminderSentAt: null
          },
          nowMs,
          leadMs
        )
      ).toBe(false);
    });

    it('returns false for already started or already reminded sessions', () => {
      expect(
        isSessionDueForReminder(
          {
            scheduledStartAt: new Date('2026-05-20T16:00:00.000Z'),
            reminderSentAt: null
          },
          nowMs,
          leadMs
        )
      ).toBe(false);

      expect(
        isSessionDueForReminder(
          {
            scheduledStartAt: new Date('2026-05-20T16:04:00.000Z'),
            reminderSentAt: new Date('2026-05-20T15:59:00.000Z')
          },
          nowMs,
          leadMs
        )
      ).toBe(false);
    });
  });

  describe('getDueReminderSessions', () => {
    it('keeps only sessions that should receive reminders', () => {
      const nowMs = new Date('2026-05-20T16:00:00.000Z').getTime();
      const sessions = [
        {
          sessionId: 'due-1',
          scheduledStartAt: new Date('2026-05-20T16:03:00.000Z'),
          reminderSentAt: null
        },
        {
          sessionId: 'too-late',
          scheduledStartAt: new Date('2026-05-20T16:08:00.000Z'),
          reminderSentAt: null
        },
        {
          sessionId: 'already-sent',
          scheduledStartAt: new Date('2026-05-20T16:04:00.000Z'),
          reminderSentAt: new Date('2026-05-20T15:58:00.000Z')
        }
      ];

      expect(getDueReminderSessions(sessions, nowMs, 5 * 60 * 1000).map((session) => session.sessionId)).toEqual([
        'due-1'
      ]);
    });
  });

  describe('summarizeSettledResults', () => {
    it('counts fulfilled and rejected reminder sends', () => {
      expect(
        summarizeSettledResults([
          { status: 'fulfilled', value: undefined },
          { status: 'rejected', reason: new Error('send failed') },
          { status: 'fulfilled', value: undefined }
        ])
      ).toEqual({ sent: 2, failed: 1 });
    });
  });
});
