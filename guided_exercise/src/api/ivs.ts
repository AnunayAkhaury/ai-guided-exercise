type IvsTokenRequest = {
  stageArn?: string;
  userId: string;
  userName?: string;
  publish: boolean;
  subscribe: boolean;
  durationMinutes?: number;
  attributes?: Record<string, string>;
};

export type IvsTelemetryEventName =
  | 'join_attempt'
  | 'token_reused'
  | 'token_refreshed'
  | 'participant_left_marked'
  | 'join_failed'
  | 'token_refresh_failed'
  | 'participant_left_mark_failed';

export type IvsTelemetryPayload = {
  eventName: IvsTelemetryEventName;
  sessionId?: string;
  stageArn?: string;
  userId?: string;
  role?: 'student' | 'instructor' | 'unknown';
  participantId?: string;
  details?: Record<string, unknown>;
};

type IvsTokenResponse = {
  token: string;
  participantId?: string;
  expirationTime?: string;
};

export type IvsTokenResult = {
  token: string;
  participantId: string;
  expirationTime?: string;
};

export type IvsSession = {
  sessionId: string;
  sessionCode: string;
  sessionName: string;
  stageArn: string;
  instructorUid: string;
  coachName: string;
  status: 'scheduled' | 'live' | 'ended';
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  endedAt: string | null;
  deleted?: boolean;
};

export type IvsSessionParticipant = {
  participantId: string;
  userId?: string | null;
  displayName: string;
  role?: string | null;
  active?: boolean;
  joinedAt?: string;
  leftAt?: string | null;
  lastSeenAt?: string;
  updatedAt?: string;
};

type CreateSessionRequest = {
  sessionName: string;
  instructorUid: string;
  coachName?: string;
  stageArn?: string;
  scheduledStartAt?: string;
  scheduledEndAt?: string;
};

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;
const TOKEN_REUSE_BUFFER_MS = 90 * 1000;

type CachedToken = {
  sessionId: string;
  stageArn: string;
  userId: string;
  role: 'student' | 'instructor';
  token: string;
  participantId: string;
  expirationTimeMs?: number;
};

type CachedTokenLookup = {
  sessionId: string;
  stageArn: string;
  userId: string;
  role: 'student' | 'instructor';
};

const tokenCache = new Map<string, CachedToken>();

function tokenCacheKey(input: CachedTokenLookup): string {
  return `${input.sessionId}:${input.userId}:${input.role}`;
}

function getApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error('EXPO_PUBLIC_API_URL is not set.');
  }
  return API_BASE_URL;
}

async function buildApiError(response: Response, fallback: string): Promise<Error> {
  const requestIdHeader = response.headers.get('x-request-id');

  try {
    const payload = (await response.json()) as { message?: string; requestId?: string };
    const requestId = payload?.requestId || requestIdHeader || 'unknown';
    const message = payload?.message || fallback;
    return new Error(`${message} (requestId: ${requestId})`);
  } catch {
    const text = await response.text();
    const requestId = requestIdHeader || 'unknown';
    const message = text || fallback;
    return new Error(`${message} (requestId: ${requestId})`);
  }
}

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const base = getApiBaseUrl();
  const endpoint = `${base}${path}`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  } catch {
    throw new Error(`Network request failed to ${endpoint}. Confirm backend is running and reachable from device.`);
  }

  if (!response.ok) {
    throw await buildApiError(response, `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function getJson<T>(path: string): Promise<T> {
  const base = getApiBaseUrl();
  const endpoint = `${base}${path}`;

  let response: Response;
  try {
    response = await fetch(endpoint);
  } catch {
    throw new Error(`Network request failed to ${endpoint}. Confirm backend is running and reachable from device.`);
  }

  if (!response.ok) {
    throw await buildApiError(response, `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getIvsToken(request: IvsTokenRequest): Promise<IvsTokenResult> {
  const base = getApiBaseUrl();

  const endpoint = `${base}/api/ivs/token`;
  console.log('[IVS][Client] token request ->', endpoint, {
    userId: request.userId,
    userName: request.userName,
    stageArnProvided: Boolean(request.stageArn),
    publish: request.publish,
    subscribe: request.subscribe,
    durationMinutes: request.durationMinutes
  });

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });
  } catch (err: any) {
    console.log('[IVS][Client] network error', err);
    throw new Error(`Network request failed to ${endpoint}. Confirm backend is running and reachable from device.`);
  }

  if (!response.ok) {
    const message = await buildApiError(response, 'Failed to fetch IVS token.');
    console.log('[IVS][Client] token request failed', response.status, message);
    throw message;
  }

  const data = (await response.json()) as IvsTokenResponse;
  if (!data.token) {
    throw new Error('IVS token missing from response.');
  }
  if (!data.participantId) {
    throw new Error('IVS participantId missing from response.');
  }

  return {
    token: data.token,
    participantId: data.participantId,
    expirationTime: data.expirationTime
  };
}

export function getReusableIvsToken(input: CachedTokenLookup): IvsTokenResult | null {
  const key = tokenCacheKey(input);
  const entry = tokenCache.get(key);
  if (!entry) return null;
  if (entry.stageArn !== input.stageArn) {
    tokenCache.delete(key);
    return null;
  }
  if (entry.expirationTimeMs && entry.expirationTimeMs <= Date.now() + TOKEN_REUSE_BUFFER_MS) {
    tokenCache.delete(key);
    return null;
  }
  return {
    token: entry.token,
    participantId: entry.participantId,
    expirationTime: entry.expirationTimeMs ? new Date(entry.expirationTimeMs).toISOString() : undefined
  };
}

export function cacheIvsToken(input: CachedTokenLookup, tokenResult: IvsTokenResult): void {
  tokenCache.set(tokenCacheKey(input), {
    ...input,
    token: tokenResult.token,
    participantId: tokenResult.participantId,
    expirationTimeMs: tokenResult.expirationTime ? Date.parse(tokenResult.expirationTime) : undefined
  });
}

export function clearIvsTokenCacheForSession(sessionId: string, userId: string, role: 'student' | 'instructor'): void {
  tokenCache.delete(`${sessionId}:${userId}:${role}`);
}

export function createIvsSession(request: CreateSessionRequest): Promise<IvsSession> {
  return postJson<IvsSession>('/api/ivs/sessions/create', request);
}

export function startIvsSession(sessionId: string): Promise<IvsSession> {
  return postJson<IvsSession>('/api/ivs/sessions/start', { sessionId });
}

export function joinIvsSessionByCode(sessionCode: string): Promise<IvsSession> {
  return postJson<IvsSession>('/api/ivs/sessions/join', { sessionCode });
}

export function listIvsSessions(statuses: ('scheduled' | 'live')[] = ['live', 'scheduled']): Promise<IvsSession[]> {
  const query = encodeURIComponent(statuses.join(','));
  return getJson<IvsSession[]>(`/api/ivs/sessions?status=${query}`);
}

export function endIvsSession(sessionId: string): Promise<IvsSession> {
  return postJson<IvsSession>('/api/ivs/sessions/end', { sessionId });
}

export function getIvsSessionById(sessionId: string): Promise<IvsSession> {
  return getJson<IvsSession>(`/api/ivs/sessions/${encodeURIComponent(sessionId)}`);
}

export function upsertIvsSessionParticipant(request: {
  sessionId: string;
  participantId: string;
  userId?: string;
  displayName: string;
  role?: 'student' | 'instructor';
}): Promise<IvsSessionParticipant> {
  return postJson<IvsSessionParticipant>('/api/ivs/sessions/participants/upsert', request);
}

export function listIvsSessionParticipants(sessionId: string): Promise<IvsSessionParticipant[]> {
  return getJson<IvsSessionParticipant[]>(`/api/ivs/sessions/${encodeURIComponent(sessionId)}/participants`);
}

export function markIvsSessionParticipantLeft(request: {
  sessionId: string;
  participantId: string;
}): Promise<{ success: true; participantId: string; sessionId: string }> {
  return postJson<{ success: true; participantId: string; sessionId: string }>(
    '/api/ivs/sessions/participants/leave',
    request
  );
}

export async function sendIvsTelemetry(payload: IvsTelemetryPayload): Promise<void> {
  try {
    await postJson<{ success: boolean; telemetryId: string }>(
      '/api/ivs/telemetry',
      {
        ...payload,
        clientTimestamp: new Date().toISOString()
      }
    );
  } catch (error) {
    console.log('[IVS][Client] telemetry send failed', {
      eventName: payload.eventName,
      error
    });
  }
}
