export type IvsTokenRequest = {
  stageArn?: string;
  userId: string;
  userName?: string;
  publish: boolean;
  subscribe: boolean;
  durationMinutes?: number;
  attributes?: Record<string, string>;
};

export type IvsTokenResponse = {
  token: string;
  participantId?: string;
  expirationTime?: string;
};

export type IvsSessionStatus = 'scheduled' | 'live' | 'ended';

export type IvsSession = {
  sessionId: string;
  ivsSessionId: string | null;
  sessionCode: string;
  sessionName: string;
  stageArn: string;
  instructorUid: string;
  coachName: string;
  status: IvsSessionStatus;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  endedAt: string | null;
};

export type IvsSessionParticipant = {
  participantId: string;
  userId: string | null;
  displayName: string;
  role: string | null;
  active: boolean;
  joinedAt: string;
  leftAt: string | null;
  lastSeenAt: string;
  updatedAt: string;
};

export type IvsRecordingStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type IvsRecording = {
  recordingId: string;
  sessionId: string;
  participantId: string;
  userId: string | null;
  rawS3Prefix: string;
  recordingStart: string | null;
  recordingEnd: string | null;
  durationMs: number | null;
  status: IvsRecordingStatus;
  processedVideoUrl: string | null;
  feedbackJsonUrl: string | null;
  error: string | null;
  source: 'manual' | 'eventbridge' | 'worker';
  createdAt: string;
  updatedAt: string;
};

import { ExerciseType } from '../components/session/exercise-sheet';
export type IvsClipWithDate = {
  duration: string;
  exercise: ExerciseType;
  feedback: string;
  processedVideoUrl: string;
  recordingId: string;
  userId: string;
  recordingStart: string;
};

export type IvsRecordingPlayback = {
  recordingId: string;
  sessionId: string;
  participantId: string;
  playbackUrl: string;
  expiresInSeconds: number;
  source?: 'processed' | 'raw_hls';
  objectKey?: string;
};

type CreateSessionRequest = {
  sessionName: string;
  instructorUid: string;
  coachName?: string;
  stageArn?: string;
  scheduledStartAt?: string;
  scheduledEndAt?: string;
};

type SessionParticipantUpsertRequest = {
  sessionId: string;
  participantId?: string;
  userId?: string;
  displayName: string;
  role?: string;
};

type SessionParticipantLeaveRequest = {
  sessionId: string;
  participantId: string;
};

type SessionTokenCacheKey = {
  sessionId: string;
  stageArn: string;
  userId: string;
  role: 'student' | 'instructor';
};

type TelemetryEventName =
  | 'join_attempt'
  | 'token_reused'
  | 'token_refreshed'
  | 'participant_left_marked'
  | 'join_failed'
  | 'token_refresh_failed'
  | 'participant_left_mark_failed';

type TelemetryRequest = {
  eventName: TelemetryEventName;
  sessionId?: string;
  stageArn?: string;
  userId?: string;
  role?: 'student' | 'instructor';
  participantId?: string;
  details?: Record<string, unknown>;
  clientTimestamp?: string;
};

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;
const DEFAULT_TOKEN_CACHE_TTL_MS = 55 * 60 * 1000;
const TOKEN_REFRESH_BUFFER_MS = 60 * 1000;
const tokenCache = new Map<string, IvsTokenResponse>();

function getApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error('EXPO_PUBLIC_API_URL is not set.');
  }
  return API_BASE_URL.replace(/\/+$/, '');
}

function buildUrl(path: string): string {
  return `${getApiBaseUrl()}${path}`;
}

function buildTokenCacheKey(input: SessionTokenCacheKey): string {
  return [input.sessionId, input.stageArn, input.userId, input.role].join(':');
}

function isReusableToken(token: IvsTokenResponse): boolean {
  if (!token.token) return false;

  if (token.expirationTime) {
    const expiry = new Date(token.expirationTime).getTime();
    if (Number.isFinite(expiry)) {
      return expiry - TOKEN_REFRESH_BUFFER_MS > Date.now();
    }
  }

  return true;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const endpoint = buildUrl(path);

  let response: Response;
  try {
    response = await fetch(endpoint, init);
  } catch {
    throw new Error(`Network request failed to ${endpoint}. Confirm backend is running and reachable from device.`);
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
}

async function getJson<T>(path: string): Promise<T> {
  return request<T>(path, {
    method: 'GET'
  });
}

export async function getIvsToken(request: IvsTokenRequest): Promise<IvsTokenResponse> {
  const endpoint = buildUrl('/api/ivs/token');
  console.log('[IVS][Client] token request ->', endpoint, {
    userId: request.userId,
    userName: request.userName,
    stageArnProvided: Boolean(request.stageArn),
    publish: request.publish,
    subscribe: request.subscribe,
    durationMinutes: request.durationMinutes
  });

  const data = await postJson<IvsTokenResponse>('/api/ivs/token', request);
  if (!data.token) {
    throw new Error('IVS token missing from response.');
  }
  return data;
}

export function cacheIvsToken(key: SessionTokenCacheKey, value: IvsTokenResponse) {
  if (!value.token) {
    return;
  }

  tokenCache.set(buildTokenCacheKey(key), value);
}

export function getReusableIvsToken(key: SessionTokenCacheKey): IvsTokenResponse | null {
  const cacheKey = buildTokenCacheKey(key);
  const cached = tokenCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (!isReusableToken(cached)) {
    tokenCache.delete(cacheKey);
    return null;
  }

  if (!cached.expirationTime) {
    // Keep local reuse bounded even if server does not return an expiration.
    setTimeout(() => {
      if (tokenCache.get(cacheKey)?.token === cached.token) {
        tokenCache.delete(cacheKey);
      }
    }, DEFAULT_TOKEN_CACHE_TTL_MS);
  }

  return cached;
}

export async function sendIvsTelemetry(payload: TelemetryRequest): Promise<void> {
  try {
    await postJson('/api/ivs/telemetry', {
      ...payload,
      clientTimestamp: payload.clientTimestamp ?? new Date().toISOString()
    });
  } catch (error) {
    console.log('[IVS][Client] telemetry request failed', error);
  }
}

export function createIvsSession(request: CreateSessionRequest): Promise<IvsSession> {
  return postJson<IvsSession>('/api/ivs/sessions/create', request);
}

export function startIvsSession(sessionId: string): Promise<IvsSession> {
  return postJson<IvsSession>('/api/ivs/sessions/start', { sessionId });
}

export function endIvsSession(sessionId: string): Promise<IvsSession> {
  return postJson<IvsSession>('/api/ivs/sessions/end', { sessionId });
}

export function joinIvsSessionByCode(sessionCode: string): Promise<IvsSession> {
  return postJson<IvsSession>('/api/ivs/sessions/join', { sessionCode });
}

export function listIvsSessions(statuses?: IvsSessionStatus[]): Promise<IvsSession[]> {
  const query = statuses && statuses.length > 0 ? `?status=${encodeURIComponent(statuses.join(','))}` : '';
  return getJson<IvsSession[]>(`/api/ivs/sessions${query}`);
}

export function getIvsSessionById(sessionId: string): Promise<IvsSession> {
  return getJson<IvsSession>(`/api/ivs/sessions/${encodeURIComponent(sessionId)}`);
}

export function upsertIvsSessionParticipant(request: SessionParticipantUpsertRequest): Promise<IvsSessionParticipant> {
  return postJson<IvsSessionParticipant>('/api/ivs/sessions/participants/upsert', request as Record<string, unknown>);
}

export function markIvsSessionParticipantLeft(
  request: SessionParticipantLeaveRequest
): Promise<{ success: boolean; sessionId: string; participantId: string }> {
  return postJson('/api/ivs/sessions/participants/leave', request as Record<string, unknown>);
}

export function listIvsSessionParticipants(sessionId: string): Promise<IvsSessionParticipant[]> {
  return getJson<IvsSessionParticipant[]>(`/api/ivs/sessions/${encodeURIComponent(sessionId)}/participants`);
}

export function listIvsRecordingsBySession(sessionId: string): Promise<IvsRecording[]> {
  return getJson<IvsRecording[]>(`/api/recordings/session/${encodeURIComponent(sessionId)}`);
}

export function listIvsRecordingsByUser(userId: string): Promise<IvsRecording[]> {
  return getJson<IvsRecording[]>(`/api/recordings/user/${encodeURIComponent(userId)}`);
}

export function listIvsClipsByUser(userId: string): Promise<IvsClipWithDate[]> {
  return getJson<IvsClipWithDate[]>(`/api/clips/user/${encodeURIComponent(userId)}`);
}

export function getIvsRecordingPlayback(recordingId: string): Promise<IvsRecordingPlayback> {
  return getJson<IvsRecordingPlayback>(`/api/recordings/${encodeURIComponent(recordingId)}/playback`);
}

export function getIvsClipsPlayback(clipId: string): Promise<IvsRecordingPlayback> {
  return getJson<IvsRecordingPlayback>(`/api/recordings/${encodeURIComponent(clipId)}/playback`);
}
