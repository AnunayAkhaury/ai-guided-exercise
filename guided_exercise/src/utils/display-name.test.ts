import { describe, expect, it } from 'vitest';
import { isPlaceholderProfileName, resolvePreferredDisplayName } from './display-name';

describe('display-name utils', () => {
  describe('isPlaceholderProfileName', () => {
    it('detects default profile names regardless of casing and spacing', () => {
      expect(isPlaceholderProfileName('New Instructor')).toBe(true);
      expect(isPlaceholderProfileName(' new student ')).toBe(true);
      expect(isPlaceholderProfileName('INSTRUCTOR')).toBe(true);
      expect(isPlaceholderProfileName('student')).toBe(true);
    });

    it('does not treat real names or missing values as placeholders', () => {
      expect(isPlaceholderProfileName('Anunay')).toBe(false);
      expect(isPlaceholderProfileName('Coach Anunay')).toBe(false);
      expect(isPlaceholderProfileName('')).toBe(false);
      expect(isPlaceholderProfileName(null)).toBe(false);
      expect(isPlaceholderProfileName(undefined)).toBe(false);
    });
  });

  describe('resolvePreferredDisplayName', () => {
    it('prefers a non-placeholder full name over username and fallback', () => {
      expect(
        resolvePreferredDisplayName({
          fullname: ' Anunay Akhaury ',
          username: 'anunay',
          fallback: 'User'
        })
      ).toBe('Anunay Akhaury');
    });

    it('uses username when the full name is a placeholder', () => {
      expect(
        resolvePreferredDisplayName({
          fullname: 'New Instructor',
          username: ' coach-anunay ',
          fallback: 'Instructor'
        })
      ).toBe('coach-anunay');
    });

    it('uses username when full name is blank or missing', () => {
      expect(
        resolvePreferredDisplayName({
          fullname: '   ',
          username: 'student-one',
          fallback: 'Student'
        })
      ).toBe('student-one');

      expect(
        resolvePreferredDisplayName({
          username: 'student-two',
          fallback: 'Student'
        })
      ).toBe('student-two');
    });

    it('keeps a placeholder full name when there is no username', () => {
      expect(
        resolvePreferredDisplayName({
          fullname: 'New Student',
          username: '',
          fallback: 'Student'
        })
      ).toBe('New Student');
    });

    it('falls back when both profile names are missing or blank', () => {
      expect(
        resolvePreferredDisplayName({
          fullname: null,
          username: '   ',
          fallback: 'Unknown user'
        })
      ).toBe('Unknown user');
    });
  });
});
