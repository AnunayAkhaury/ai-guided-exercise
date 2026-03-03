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

  const response = await fetch(`${API_BASE_URL}/api/ivs/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to fetch IVS token.');
  }

  const data = (await response.json()) as IvsTokenResponse;
  if (!data.token) {
    throw new Error('IVS token missing from response.');
  }

  return data.token;
}
