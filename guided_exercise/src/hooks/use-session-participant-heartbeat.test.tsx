import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { heartbeatIvsSessionParticipant } from '@/src/api/ivs';
import { useSessionParticipantHeartbeat } from './use-session-participant-heartbeat';

vi.mock('@/src/api/ivs', () => ({
  heartbeatIvsSessionParticipant: vi.fn()
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type HarnessProps = {
  enabled: boolean;
  sessionId?: string;
  participantId?: string;
  logPrefix?: string;
};

function HeartbeatHarness({
  enabled,
  sessionId,
  participantId,
  logPrefix = '[test]'
}: HarnessProps) {
  useSessionParticipantHeartbeat({
    enabled,
    sessionId,
    participantId,
    logPrefix
  });
  return null;
}

async function mountHarness(props: HarnessProps) {
  let renderer: ReactTestRenderer | null = null;
  await act(async () => {
    renderer = create(<HeartbeatHarness {...props} />);
  });
  return renderer!;
}

describe('useSessionParticipantHeartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(heartbeatIvsSessionParticipant).mockResolvedValue({
      success: true,
      sessionId: 'session-1',
      participantId: 'participant-1',
      active: true,
      lastSeenAt: '2026-05-27T10:00:00.000Z'
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('does nothing when disabled or missing required ids', async () => {
    const disabledRenderer = await mountHarness({
      enabled: false,
      sessionId: 'session-1',
      participantId: 'participant-1'
    });
    const missingSessionRenderer = await mountHarness({
      enabled: true,
      participantId: 'participant-1'
    });
    const missingParticipantRenderer = await mountHarness({
      enabled: true,
      sessionId: 'session-1'
    });

    expect(heartbeatIvsSessionParticipant).not.toHaveBeenCalled();

    await act(async () => {
      disabledRenderer.unmount();
      missingSessionRenderer.unmount();
      missingParticipantRenderer.unmount();
    });
  });

  it('sends an immediate heartbeat and repeats on the interval', async () => {
    const renderer = await mountHarness({
      enabled: true,
      sessionId: ' session-1 ',
      participantId: ' participant-1 '
    });

    expect(heartbeatIvsSessionParticipant).toHaveBeenCalledTimes(1);
    expect(heartbeatIvsSessionParticipant).toHaveBeenCalledWith({
      sessionId: 'session-1',
      participantId: 'participant-1'
    });

    await act(async () => {
      vi.advanceTimersByTime(25_000);
    });

    expect(heartbeatIvsSessionParticipant).toHaveBeenCalledTimes(2);

    await act(async () => {
      renderer.unmount();
    });
  });

  it('cleans up the interval on unmount', async () => {
    const renderer = await mountHarness({
      enabled: true,
      sessionId: 'session-1',
      participantId: 'participant-1'
    });

    await act(async () => {
      renderer.unmount();
    });
    vi.advanceTimersByTime(50_000);

    expect(heartbeatIvsSessionParticipant).toHaveBeenCalledTimes(1);
  });

  it('logs heartbeat errors while mounted but not after cleanup', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(heartbeatIvsSessionParticipant).mockRejectedValue(new Error('offline'));

    const renderer = await mountHarness({
      enabled: true,
      sessionId: 'session-1',
      participantId: 'participant-1',
      logPrefix: '[heartbeat]'
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(logSpy).toHaveBeenCalledWith('[heartbeat] participant heartbeat error', expect.any(Error));

    logSpy.mockClear();
    await act(async () => {
      renderer.unmount();
    });
    vi.advanceTimersByTime(25_000);
    await Promise.resolve();

    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
