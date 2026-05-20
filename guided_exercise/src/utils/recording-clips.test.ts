import { describe, expect, it, vi } from 'vitest';
import type { IvsClip } from '@/src/api/ivs';
import {
  buildSessionGroups,
  formatClipTimeRange,
  formatDate,
  formatDuration,
  formatExercise,
  formatTime,
  toTimestamp
} from './recording-clips';

function clip(overrides: Partial<IvsClip> = {}): IvsClip {
  return {
    id: 'clip-1',
    clipUrl: 's3://bucket/key.mp4',
    duration: '30000',
    exercise: 'pushup',
    feedbackRef: null,
    starttime: '1779230000000',
    recordingId: 'recording-1',
    sessionId: 'session-1',
    sessionName: 'Morning Strength',
    userId: 'user-1',
    ...overrides
  };
}

describe('recording clip utils', () => {
  describe('toTimestamp', () => {
    it('normalizes numeric timestamp strings and rejects invalid values', () => {
      expect(toTimestamp('1779230000000')).toBe(1779230000000);
      expect(toTimestamp('not-a-number')).toBe(0);
      expect(toTimestamp(null)).toBe(0);
    });
  });

  describe('formatting helpers', () => {
    it('formats durations', () => {
      expect(formatDuration('999')).toBe('0s');
      expect(formatDuration('30000')).toBe('30s');
      expect(formatDuration('90000')).toBe('1m 30s');
      expect(formatDuration('bad')).toBe('0s');
    });

    it('formats dates and times using the user locale', () => {
      const dateSpy = vi.spyOn(Date.prototype, 'toLocaleString').mockReturnValue('May 19, 2026, 3:33 PM');
      const timeSpy = vi.spyOn(Date.prototype, 'toLocaleTimeString').mockReturnValue('3:33 PM');

      expect(formatDate('1779230000000')).toBe('May 19, 2026, 3:33 PM');
      expect(formatTime('1779230000000')).toBe('3:33 PM');

      dateSpy.mockRestore();
      timeSpy.mockRestore();
    });

    it('returns unknown labels for invalid date values', () => {
      expect(formatDate('bad')).toBe('Unknown date');
      expect(formatTime('bad')).toBe('Unknown time');
    });

    it('formats clip time ranges from start and duration', () => {
      const timeSpy = vi
        .spyOn(Date.prototype, 'toLocaleTimeString')
        .mockReturnValueOnce('3:33 PM')
        .mockReturnValueOnce('3:34 PM');

      expect(formatClipTimeRange(clip({ starttime: '1779230000000', duration: '60000' }))).toBe('3:33 PM - 3:34 PM');
      timeSpy.mockRestore();
    });

    it('falls back to start time when duration is invalid', () => {
      const timeSpy = vi.spyOn(Date.prototype, 'toLocaleTimeString').mockReturnValue('3:33 PM');
      expect(formatClipTimeRange(clip({ duration: 'bad' }))).toBe('3:33 PM');
      timeSpy.mockRestore();
    });

    it('maps exercise keys to display names', () => {
      expect(formatExercise('pushup')).toBe('Pushups');
      expect(formatExercise('unknown_exercise')).toBe('unknown_exercise');
    });
  });

  describe('buildSessionGroups', () => {
    it('groups clips by session id and uses the session name as the title', () => {
      const groups = buildSessionGroups([
        clip({ id: 'clip-1', exercise: 'pushup', starttime: '1000' }),
        clip({ id: 'clip-2', exercise: 'lunge', starttime: '2000' })
      ]);

      expect(groups).toHaveLength(1);
      expect(groups[0]).toMatchObject({
        key: 'session-1',
        title: 'Morning Strength',
        latestStart: 2000,
        exercises: ['Lunges', 'Pushups']
      });
      expect(groups[0]!.items.map((item) => item.id)).toEqual(['clip-2', 'clip-1']);
    });

    it('falls back to recording id when session id is missing', () => {
      const groups = buildSessionGroups([
        clip({ id: 'clip-1', sessionId: null, sessionName: null, recordingId: 'recording-1' })
      ]);

      expect(groups).toHaveLength(1);
      expect(groups[0]).toMatchObject({
        key: 'recording-1',
        title: 'Legacy clips'
      });
    });

    it('falls back to legacy clips when session and recording ids are missing', () => {
      const groups = buildSessionGroups([
        clip({ id: 'clip-1', sessionId: null, sessionName: null, recordingId: null })
      ]);

      expect(groups).toHaveLength(1);
      expect(groups[0]).toMatchObject({
        key: 'legacy-clips',
        title: 'Legacy clips'
      });
    });

    it('uses untitled session when session id exists without a session name', () => {
      const groups = buildSessionGroups([
        clip({ id: 'clip-1', sessionId: 'session-2', sessionName: null })
      ]);

      expect(groups[0]).toMatchObject({
        key: 'session-2',
        title: 'Untitled session'
      });
    });

    it('updates untitled groups when another clip has the session name', () => {
      const groups = buildSessionGroups([
        clip({ id: 'clip-1', sessionId: 'session-2', sessionName: null, starttime: '1000' }),
        clip({ id: 'clip-2', sessionId: 'session-2', sessionName: 'Named Session', starttime: '2000' })
      ]);

      expect(groups[0]?.title).toBe('Named Session');
    });

    it('sorts session groups newest first', () => {
      const groups = buildSessionGroups([
        clip({ id: 'old', sessionId: 'old-session', sessionName: 'Old', starttime: '1000' }),
        clip({ id: 'new', sessionId: 'new-session', sessionName: 'New', starttime: '3000' })
      ]);

      expect(groups.map((group) => group.key)).toEqual(['new-session', 'old-session']);
    });
  });
});
