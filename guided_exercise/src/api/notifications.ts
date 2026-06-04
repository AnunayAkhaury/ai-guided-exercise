export type PushTokenPlatform = 'ios' | 'android' | 'web';
export type PushTokenType = 'expo' | 'fcm_web';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

function getApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error('EXPO_PUBLIC_API_URL is not set.');
  }
  return API_BASE_URL.replace(/\/+$/, '');
}

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const endpoint = `${getApiBaseUrl()}${path}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export function registerPushToken(input: {
  uid: string;
  token: string;
  type: PushTokenType;
  platform: PushTokenPlatform;
  deviceName?: string | null;
}): Promise<{ success: boolean; tokenId: string; type: PushTokenType; platform: PushTokenPlatform }> {
  return postJson('/api/notifications/register-token', input);
}

export function unregisterPushToken(input: { uid: string; token: string }): Promise<{ success: boolean }> {
  return postJson('/api/notifications/unregister-token', input);
}
