import { describe, expect, it } from 'vitest';
import {
  getSessionParticipantRole,
  getSessionStartEligibility,
  parseOptionalDate,
  resolveSessionScopedTokenAttributes,
  validateScheduleRange
} from './session-utils.js';

describe('session utils', () => {
  describe('parseOptionalDate', () => {
    it('returns undefined for absent values', () => {
      expect(parseOptionalDate(undefined, 'scheduledStartAt')).toBeUndefined();
    });

    it('parses valid ISO date strings', () => {
      const parsed = parseOptionalDate('2026-05-20T16:00:00.000Z', 'scheduledStartAt');
      expect(parsed).toBeInstanceOf(Date);
      expect((parsed as Date).toISOString()).toBe('2026-05-20T16:00:00.000Z');
    });

    it('returns a field-specific error for invalid dates', () => {
      expect(parseOptionalDate('bad-date', 'scheduledEndAt')).toEqual({
        error: 'scheduledEndAt must be a valid ISO date string.'
      });
    });
  });

  describe('validateScheduleRange', () => {
    it('accepts missing dates and forward ranges', () => {
      expect(validateScheduleRange(undefined, undefined)).toBeNull();
      expect(
        validateScheduleRange(
          new Date('2026-05-20T16:00:00.000Z'),
          new Date('2026-05-20T17:00:00.000Z')
        )
      ).toBeNull();
    });

    it('rejects end dates that are not after start dates', () => {
      expect(
        validateScheduleRange(
          new Date('2026-05-20T16:00:00.000Z'),
          new Date('2026-05-20T16:00:00.000Z')
        )
      ).toBe('scheduledEndAt must be after scheduledStartAt.');
      expect(
        validateScheduleRange(
          new Date('2026-05-20T16:00:00.000Z'),
          new Date('2026-05-20T15:59:59.000Z')
        )
      ).toBe('scheduledEndAt must be after scheduledStartAt.');
    });
  });

  describe('getSessionStartEligibility', () => {
    const nowMs = new Date('2026-05-20T15:56:00.000Z').getTime();

    it('allows the creator to start a live or scheduled session in the start window', () => {
      expect(
        getSessionStartEligibility({
          session: {
            instructorUid: 'creator-1',
            status: 'scheduled',
            scheduledStartAt: new Date('2026-05-20T16:00:00.000Z')
          },
          requesterUid: 'creator-1',
          nowMs,
          startWindowMinutes: 5
        })
      ).toEqual({ allowed: true });
    });

    it('rejects non-creators', () => {
      expect(
        getSessionStartEligibility({
          session: {
            instructorUid: 'creator-1',
            status: 'scheduled',
            scheduledStartAt: null
          },
          requesterUid: 'other-instructor',
          nowMs,
          startWindowMinutes: 5
        })
      ).toEqual({
        allowed: false,
        status: 403,
        message: 'Only the session creator can start this class.'
      });
    });

    it('rejects ended sessions', () => {
      expect(
        getSessionStartEligibility({
          session: {
            instructorUid: 'creator-1',
            status: 'ended',
            scheduledStartAt: null
          },
          requesterUid: ' creator-1 ',
          nowMs,
          startWindowMinutes: 5
        })
      ).toEqual({
        allowed: false,
        status: 409,
        message: 'Cannot start an ended session.'
      });
    });

    it('rejects scheduled classes before the start window', () => {
      expect(
        getSessionStartEligibility({
          session: {
            instructorUid: 'creator-1',
            status: 'scheduled',
            scheduledStartAt: new Date('2026-05-20T16:02:00.000Z')
          },
          requesterUid: 'creator-1',
          nowMs,
          startWindowMinutes: 5
        })
      ).toEqual({
        allowed: false,
        status: 409,
        message: 'This class can only be started 5 minutes before the scheduled time.'
      });
    });
  });

  describe('getSessionParticipantRole', () => {
    it('marks only the session creator as instructor', () => {
      expect(
        getSessionParticipantRole({
          sessionInstructorUid: 'creator-uid',
          userId: 'creator-uid'
        })
      ).toBe('instructor');
    });

    it('marks other users, missing users, and missing session owners as students', () => {
      expect(
        getSessionParticipantRole({
          sessionInstructorUid: 'creator-uid',
          userId: 'other-instructor-uid'
        })
      ).toBe('student');
      expect(
        getSessionParticipantRole({
          sessionInstructorUid: 'creator-uid',
          userId: null
        })
      ).toBe('student');
      expect(
        getSessionParticipantRole({
          sessionInstructorUid: null,
          userId: 'creator-uid'
        })
      ).toBe('student');
    });

    it('trims ids before comparing role ownership', () => {
      expect(
        getSessionParticipantRole({
          sessionInstructorUid: ' creator-uid ',
          userId: 'creator-uid'
        })
      ).toBe('instructor');
    });
  });

  describe('resolveSessionScopedTokenAttributes', () => {
    it('sets instructor role and normalized userId for the session creator', () => {
      expect(
        resolveSessionScopedTokenAttributes({
          attributes: {
            sessionId: 'session-1',
            displayName: 'Coach'
          },
          sessionInstructorUid: 'creator-uid',
          userId: ' creator-uid '
        })
      ).toEqual({
        sessionId: 'session-1',
        displayName: 'Coach',
        role: 'instructor',
        userId: 'creator-uid'
      });
    });

    it('overrides client-provided instructor role when the user is not the session creator', () => {
      expect(
        resolveSessionScopedTokenAttributes({
          attributes: {
            sessionId: 'session-1',
            userId: 'other-instructor-uid',
            role: 'instructor'
          },
          sessionInstructorUid: 'creator-uid'
        })
      ).toEqual({
        sessionId: 'session-1',
        userId: 'other-instructor-uid',
        role: 'student'
      });
    });

    it('leaves attributes unchanged when no user id is available', () => {
      expect(
        resolveSessionScopedTokenAttributes({
          attributes: {
            sessionId: 'session-1',
            role: 'instructor'
          },
          sessionInstructorUid: 'creator-uid'
        })
      ).toEqual({
        sessionId: 'session-1',
        role: 'instructor'
      });
    });
  });
});
