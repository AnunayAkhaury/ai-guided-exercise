import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_TOKEN_CACHE_TTL_MS,
  TOKEN_REFRESH_BUFFER_MS,
  buildTokenCacheKey,
  cacheToken,
  getReusableToken,
  isReusableToken,
  type IvsTokenCacheKey
} from './ivs-token-cache';

describe('IVS token cache utils', () => {
  const key: IvsTokenCacheKey = {
    sessionId: 'session-1',
    stageArn: 'arn:aws:ivs:us-west-2:123456789012:stage/example',
    userId: 'user-1',
    role: 'instructor'
  };

  describe('buildTokenCacheKey', () => {
    it('separates cache entries by session, stage, user, and role', () => {
      expect(buildTokenCacheKey(key)).toBe(
        'session-1:arn:aws:ivs:us-west-2:123456789012:stage/example:user-1:instructor'
      );
      expect(buildTokenCacheKey({ ...key, role: 'student' })).not.toBe(buildTokenCacheKey(key));
    });
  });

  describe('isReusableToken', () => {
    const nowMs = new Date('2026-05-20T16:00:00.000Z').getTime();

    it('rejects empty tokens', () => {
      expect(isReusableToken({ token: '' }, nowMs)).toBe(false);
    });

    it('reuses tokens that expire after the refresh buffer', () => {
      expect(
        isReusableToken(
          {
            token: 'token-1',
            expirationTime: new Date(nowMs + TOKEN_REFRESH_BUFFER_MS + 1).toISOString()
          },
          nowMs
        )
      ).toBe(true);
    });

    it('rejects tokens that are expired or inside the refresh buffer', () => {
      expect(
        isReusableToken(
          {
            token: 'token-1',
            expirationTime: new Date(nowMs + TOKEN_REFRESH_BUFFER_MS).toISOString()
          },
          nowMs
        )
      ).toBe(false);

      expect(
        isReusableToken(
          {
            token: 'token-1',
            expirationTime: new Date(nowMs - 1).toISOString()
          },
          nowMs
        )
      ).toBe(false);
    });

    it('reuses tokens with missing or invalid expiration times', () => {
      expect(isReusableToken({ token: 'token-1' }, nowMs)).toBe(true);
      expect(isReusableToken({ token: 'token-1', expirationTime: 'not-a-date' }, nowMs)).toBe(true);
    });
  });

  describe('cacheToken and getReusableToken', () => {
    it('does not store invalid empty tokens', () => {
      const cache = new Map();

      cacheToken(cache, key, { token: '' });

      expect(cache.size).toBe(0);
      expect(getReusableToken(cache, key)).toBeNull();
    });

    it('returns cached reusable tokens', () => {
      const cache = new Map();
      const token = {
        token: 'token-1',
        participantId: 'participant-1',
        expirationTime: new Date('2026-05-20T16:10:00.000Z').toISOString()
      };

      cacheToken(cache, key, token);

      expect(getReusableToken(cache, key, { nowMs: new Date('2026-05-20T16:00:00.000Z').getTime() })).toBe(token);
    });

    it('deletes stale cached tokens when read', () => {
      const cache = new Map();

      cacheToken(cache, key, {
        token: 'token-1',
        expirationTime: new Date('2026-05-20T16:00:30.000Z').toISOString()
      });

      expect(getReusableToken(cache, key, { nowMs: new Date('2026-05-20T16:00:00.000Z').getTime() })).toBeNull();
      expect(cache.size).toBe(0);
    });

    it('schedules fallback expiry for tokens without server expiration', () => {
      vi.useFakeTimers();
      const cache = new Map();
      const scheduleExpiry = vi.fn((callback: () => void, delayMs: number) => {
        setTimeout(callback, delayMs);
      });

      cacheToken(cache, key, { token: 'token-1' });

      expect(getReusableToken(cache, key, { scheduleExpiry })).toEqual({ token: 'token-1' });
      expect(scheduleExpiry).toHaveBeenCalledWith(expect.any(Function), DEFAULT_TOKEN_CACHE_TTL_MS);

      vi.advanceTimersByTime(DEFAULT_TOKEN_CACHE_TTL_MS);

      expect(getReusableToken(cache, key)).toBeNull();
      vi.useRealTimers();
    });

    it('does not let an old fallback timer remove a newer token', () => {
      vi.useFakeTimers();
      const cache = new Map();
      const scheduleExpiry = (callback: () => void, delayMs: number) => {
        setTimeout(callback, delayMs);
      };

      cacheToken(cache, key, { token: 'old-token' });
      getReusableToken(cache, key, { scheduleExpiry });
      cacheToken(cache, key, { token: 'new-token' });

      vi.advanceTimersByTime(DEFAULT_TOKEN_CACHE_TTL_MS);

      expect(getReusableToken(cache, key)).toEqual({ token: 'new-token' });
      vi.useRealTimers();
    });
  });
});
