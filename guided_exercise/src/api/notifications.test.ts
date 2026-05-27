import { afterEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return {
    ok: init.status ? init.status >= 200 && init.status < 300 : true,
    status: init.status ?? 200,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body))
  } as unknown as Response;
}

async function importNotificationsApi(apiUrl = 'https://api.example.com/') {
  vi.stubEnv('EXPO_PUBLIC_API_URL', apiUrl);
  vi.resetModules();
  return import('./notifications');
}

describe('notification API client', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('registers push tokens against the backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        tokenId: 'token-doc-1',
        type: 'expo',
        platform: 'ios'
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    const { registerPushToken } = await importNotificationsApi('https://api.example.com///');

    const response = await registerPushToken({
      uid: 'user-1',
      token: 'ExpoPushToken[test]',
      type: 'expo',
      platform: 'ios',
      deviceName: 'iPhone'
    });

    expect(response.tokenId).toBe('token-doc-1');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/notifications/register-token',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: 'user-1',
          token: 'ExpoPushToken[test]',
          type: 'expo',
          platform: 'ios',
          deviceName: 'iPhone'
        })
      })
    );
  });

  it('unregisters push tokens against the backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true }));
    vi.stubGlobal('fetch', fetchMock);
    const { unregisterPushToken } = await importNotificationsApi();

    const response = await unregisterPushToken({ uid: 'user-1', token: 'token-1' });

    expect(response).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/notifications/unregister-token',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ uid: 'user-1', token: 'token-1' })
      })
    );
  });

  it('throws when the API URL is missing or the backend rejects the request', async () => {
    vi.stubEnv('EXPO_PUBLIC_API_URL', '');
    vi.resetModules();
    const missingEnvApi = await import('./notifications');

    await expect(
      missingEnvApi.registerPushToken({
        uid: 'user-1',
        token: 'token-1',
        type: 'expo',
        platform: 'ios'
      })
    ).rejects.toThrow('EXPO_PUBLIC_API_URL is not set.');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse('uid is required.', { status: 400 })));
    const api = await importNotificationsApi();

    await expect(api.unregisterPushToken({ uid: '', token: 'token-1' })).rejects.toThrow('uid is required.');
  });
});
