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

export type IvsSession = {
  sessionId: string;
  sessionCode: string;
  sessionName: string;
  stageArn: string;
  instructorUid: string;
  status: 'scheduled' | 'live' | 'ended';
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  endedAt: string | null;
};

type CreateSessionRequest = {
  sessionName: string;
  instructorUid: string;
  stageArn?: string;
};

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

function getApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error('EXPO_PUBLIC_API_URL is not set.');
  }
  return API_BASE_URL;
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
  } catch (_err) {
    throw new Error(`Network request failed to ${endpoint}. Confirm backend is running and reachable from device.`);
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

async function getJson<T>(path: string): Promise<T> {
  const base = getApiBaseUrl();
  const endpoint = `${base}${path}`;

  let response: Response;
  try {
    response = await fetch(endpoint);
  } catch (_err) {
    throw new Error(`Network request failed to ${endpoint}. Confirm backend is running and reachable from device.`);
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getIvsToken(request: IvsTokenRequest): Promise<string> {
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
    const message = await response.text();
    console.log('[IVS][Client] token request failed', response.status, message);
    throw new Error(message || 'Failed to fetch IVS token.');
  }

  const data = (await response.json()) as IvsTokenResponse;
  if (!data.token) {
    throw new Error('IVS token missing from response.');
  }

  return data.token;
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

export function listIvsSessions(statuses: Array<'scheduled' | 'live'> = ['live', 'scheduled']): Promise<IvsSession[]> {
  const query = encodeURIComponent(statuses.join(','));
  return getJson<IvsSession[]>(`/api/ivs/sessions?status=${query}`);
}
