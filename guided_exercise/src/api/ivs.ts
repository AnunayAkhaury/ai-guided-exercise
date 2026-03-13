type IvsTokenRequest = {
  stageArn?: string;
  userId: string;
  userName?: string;
  publish: boolean;
  subscribe: boolean;
  durationMinutes?: number;
  attributes?: Record<string, string>;
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
  displayName: string;
  role?: string | null;
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
  displayName: string;
  role?: 'student' | 'instructor';
}): Promise<IvsSessionParticipant> {
  return postJson<IvsSessionParticipant>('/api/ivs/sessions/participants/upsert', request);
}

export function listIvsSessionParticipants(sessionId: string): Promise<IvsSessionParticipant[]> {
  return getJson<IvsSessionParticipant[]>(`/api/ivs/sessions/${encodeURIComponent(sessionId)}/participants`);
}
