import type { IvsTokenResponse } from '@/src/api/ivs';

export type IvsTokenCacheKey = {
  sessionId: string;
  stageArn: string;
  userId: string;
  role: 'student' | 'instructor';
};

export const DEFAULT_TOKEN_CACHE_TTL_MS = 55 * 60 * 1000;
export const TOKEN_REFRESH_BUFFER_MS = 60 * 1000;

export function buildTokenCacheKey(input: IvsTokenCacheKey): string {
  return [input.sessionId, input.stageArn, input.userId, input.role].join(':');
}

export function isReusableToken(token: IvsTokenResponse, nowMs = Date.now()): boolean {
  if (!token.token) return false;

  if (token.expirationTime) {
    const expiry = new Date(token.expirationTime).getTime();
    if (Number.isFinite(expiry)) {
      return expiry - TOKEN_REFRESH_BUFFER_MS > nowMs;
    }
  }

  return true;
}

export function cacheToken(
  cache: Map<string, IvsTokenResponse>,
  key: IvsTokenCacheKey,
  value: IvsTokenResponse
) {
  if (!value.token) {
    return;
  }

  cache.set(buildTokenCacheKey(key), value);
}

export function getReusableToken(
  cache: Map<string, IvsTokenResponse>,
  key: IvsTokenCacheKey,
  options: {
    nowMs?: number;
    fallbackTtlMs?: number;
    scheduleExpiry?: (callback: () => void, delayMs: number) => void;
  } = {}
): IvsTokenResponse | null {
  const cacheKey = buildTokenCacheKey(key);
  const cached = cache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (!isReusableToken(cached, options.nowMs)) {
    cache.delete(cacheKey);
    return null;
  }

  if (!cached.expirationTime) {
    const fallbackTtlMs = options.fallbackTtlMs ?? DEFAULT_TOKEN_CACHE_TTL_MS;
    options.scheduleExpiry?.(() => {
      if (cache.get(cacheKey)?.token === cached.token) {
        cache.delete(cacheKey);
      }
    }, fallbackTtlMs);
  }

  return cached;
}
