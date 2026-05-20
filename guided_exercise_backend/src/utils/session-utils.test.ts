import { describe, expect, it } from 'vitest';
import { getSessionStartEligibility, parseOptionalDate, validateScheduleRange } from './session-utils.js';

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
});
