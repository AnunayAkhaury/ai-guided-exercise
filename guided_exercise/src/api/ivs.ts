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

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export async function getIvsToken(request: IvsTokenRequest): Promise<string> {
  if (!API_BASE_URL) {
    throw new Error('EXPO_PUBLIC_API_URL is not set.');
  }

  const endpoint = `${API_BASE_URL}/api/ivs/token`;
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
