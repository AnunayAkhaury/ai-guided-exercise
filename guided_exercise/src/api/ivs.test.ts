import { afterEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return {
    ok: init.status ? init.status >= 200 && init.status < 300 : true,
    status: init.status ?? 200,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body))
  } as unknown as Response;
}

async function importIvsApi(apiUrl = 'https://api.example.com/') {
  vi.stubEnv('EXPO_PUBLIC_API_URL', apiUrl);
  vi.resetModules();
  return import('./ivs');
}

describe('IVS API client', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('throws when EXPO_PUBLIC_API_URL is missing', async () => {
    vi.stubEnv('EXPO_PUBLIC_API_URL', '');
    vi.resetModules();
    const { listIvsSessions } = await import('./ivs');

    await expect(listIvsSessions()).rejects.toThrow('EXPO_PUBLIC_API_URL is not set.');
  });

  it('creates IVS tokens and trims trailing slashes from the API base URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ token: 'token-1', participantId: 'participant-1' }));
    vi.stubGlobal('fetch', fetchMock);
    const { getIvsToken } = await importIvsApi('https://api.example.com///');

    const response = await getIvsToken({
      userId: 'user-1',
      userName: 'Student',
      publish: true,
      subscribe: true,
      durationMinutes: 60
    });

    expect(response).toEqual({ token: 'token-1', participantId: 'participant-1' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/ivs/token',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'user-1',
          userName: 'Student',
          publish: true,
          subscribe: true,
          durationMinutes: 60
        })
      })
    );
  });

  it('rejects IVS token responses without a token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ participantId: 'participant-1' })));
    const { getIvsToken } = await importIvsApi();

    await expect(
      getIvsToken({
        userId: 'user-1',
        publish: true,
        subscribe: true
      })
    ).rejects.toThrow('IVS token missing from response.');
  });

  it('surfaces backend error text and network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse('Only the session creator can start this class.', { status: 403 })));
    const { startIvsSession } = await importIvsApi();

    await expect(startIvsSession('session-1', 'user-1')).rejects.toThrow('Only the session creator can start this class.');

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const reimported = await importIvsApi();

    await expect(reimported.listIvsSessions()).rejects.toThrow(
      'Network request failed to https://api.example.com/api/ivs/sessions.'
    );
  });

  it('builds GET and POST endpoints for session, recording, clip, and participant APIs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);
    const {
      createIvsSession,
      endIvsSession,
      getIvsClipPlayback,
      getIvsClipsByUserId,
      getIvsRecordingPlayback,
      heartbeatIvsSessionParticipant,
      joinIvsSessionByCode,
      listIvsRecordingsByUser,
      listIvsSessionParticipants,
      listIvsSessions,
      markIvsSessionParticipantLeft,
      startIvsRecordingProcessing,
      upsertIvsSessionParticipant
    } = await importIvsApi();

    await listIvsSessions(['live', 'scheduled']);
    await createIvsSession({ sessionName: 'Class', instructorUid: 'coach-1' });
    await joinIvsSessionByCode('ABC123');
    await endIvsSession('session-1', 'coach-1');
    await listIvsSessionParticipants('session 1');
    await upsertIvsSessionParticipant({ sessionId: 'session-1', participantId: 'participant-1', displayName: 'Student' });
    await markIvsSessionParticipantLeft({ sessionId: 'session-1', participantId: 'participant-1' });
    await heartbeatIvsSessionParticipant({ sessionId: 'session-1', participantId: 'participant-1' });
    await listIvsRecordingsByUser('user 1');
    await getIvsClipsByUserId('user 1');
    await getIvsRecordingPlayback('recording 1');
    await getIvsClipPlayback('clip 1');
    await startIvsRecordingProcessing('recording 1');

    const calledUrls = fetchMock.mock.calls.map(([url]) => url);
    expect(calledUrls).toContain('https://api.example.com/api/ivs/sessions?status=live%2Cscheduled');
    expect(calledUrls).toContain('https://api.example.com/api/ivs/sessions/create');
    expect(calledUrls).toContain('https://api.example.com/api/ivs/sessions/join');
    expect(calledUrls).toContain('https://api.example.com/api/ivs/sessions/end');
    expect(calledUrls).toContain('https://api.example.com/api/ivs/sessions/session%201/participants');
    expect(calledUrls).toContain('https://api.example.com/api/ivs/sessions/participants/upsert');
    expect(calledUrls).toContain('https://api.example.com/api/ivs/sessions/participants/leave');
    expect(calledUrls).toContain('https://api.example.com/api/ivs/sessions/participants/heartbeat');
    expect(calledUrls).toContain('https://api.example.com/api/recordings/user/user%201');
    expect(calledUrls).toContain('https://api.example.com/api/clips/user/user%201');
    expect(calledUrls).toContain('https://api.example.com/api/recordings/recording%201/playback');
    expect(calledUrls).toContain('https://api.example.com/api/clip/clip%201/playback');
    expect(calledUrls).toContain('https://api.example.com/api/recordings/recording%201/process');
  });

  it('sends telemetry with a generated timestamp and swallows failures', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true }));
    vi.stubGlobal('fetch', fetchMock);
    const { sendIvsTelemetry } = await importIvsApi();

    await expect(sendIvsTelemetry({ eventName: 'join_attempt', sessionId: 'session-1' })).resolves.toBeUndefined();
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual(
      expect.objectContaining({
        eventName: 'join_attempt',
        sessionId: 'session-1',
        clientTimestamp: expect.any(String)
      })
    );

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const reimported = await importIvsApi();

    await expect(reimported.sendIvsTelemetry({ eventName: 'join_failed' })).resolves.toBeUndefined();
  });
});
