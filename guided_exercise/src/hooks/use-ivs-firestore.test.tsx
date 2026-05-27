import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IvsSession, IvsSessionParticipant, IvsSessionStatus } from '@/src/api/ivs';
import {
  getIvsSessionById,
  listIvsSessionParticipants,
  listIvsSessions
} from '@/src/api/ivs';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where
} from 'firebase/firestore';
import {
  useFirestoreSession,
  useFirestoreSessionParticipants,
  useFirestoreSessions
} from './use-ivs-firestore';

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn((...path: unknown[]) => ({ type: 'collection', path })),
  doc: vi.fn((...path: unknown[]) => ({ type: 'doc', path })),
  onSnapshot: vi.fn(),
  query: vi.fn((base: unknown, ...constraints: unknown[]) => ({ type: 'query', base, constraints })),
  where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value }))
}));

vi.mock('firebase/firestore', () => ({
  collection: firestoreMocks.collection,
  doc: firestoreMocks.doc,
  onSnapshot: firestoreMocks.onSnapshot,
  query: firestoreMocks.query,
  where: firestoreMocks.where
}));

vi.mock('@/src/api/Firebase/firebase-config', () => ({
  db: { app: 'test-db' }
}));

vi.mock('@/src/api/ivs', () => ({
  getIvsSessionById: vi.fn(),
  listIvsSessionParticipants: vi.fn(),
  listIvsSessions: vi.fn()
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type ListenerState<T> = {
  data: T;
  loading: boolean;
  error: Error | null;
};

function timestamp(value: string) {
  const date = new Date(value);
  return {
    toDate: () => date
  };
}

function session(overrides: Partial<IvsSession> = {}): IvsSession {
  return {
    sessionId: 'session-1',
    ivsSessionId: null,
    sessionCode: 'ABC123',
    sessionName: 'Recovery Strength',
    stageArn: 'stage-arn',
    instructorUid: 'instructor-1',
    coachName: 'Coach',
    status: 'scheduled',
    scheduledStartAt: null,
    scheduledEndAt: null,
    createdAt: '2026-05-27T10:00:00.000Z',
    updatedAt: '2026-05-27T10:00:00.000Z',
    startedAt: null,
    endedAt: null,
    ...overrides
  };
}

function participant(overrides: Partial<IvsSessionParticipant> = {}): IvsSessionParticipant {
  return {
    participantId: 'participant-1',
    userId: 'user-1',
    displayName: 'Student',
    role: 'student',
    active: true,
    joinedAt: '2026-05-27T10:00:00.000Z',
    leftAt: null,
    lastSeenAt: '2026-05-27T10:00:00.000Z',
    updatedAt: '2026-05-27T10:00:00.000Z',
    ...overrides
  };
}

function snapshotDoc(id: string, data: Record<string, unknown>) {
  return {
    id,
    data: () => data
  };
}

function querySnapshot(docs: Array<{ id: string; data: () => Record<string, unknown> }>) {
  return { docs };
}

function docSnapshot(id: string, data: Record<string, unknown> | null) {
  return {
    id,
    exists: () => Boolean(data),
    data: () => data ?? {}
  };
}

function SessionsHarness({
  enabled = true,
  statuses,
  onState
}: {
  enabled?: boolean;
  statuses?: IvsSessionStatus[];
  onState: (state: ListenerState<IvsSession[]>) => void;
}) {
  onState(useFirestoreSessions(statuses, enabled));
  return null;
}

function SessionHarness({
  enabled = true,
  sessionId,
  onState
}: {
  enabled?: boolean;
  sessionId?: string;
  onState: (state: ListenerState<IvsSession | null>) => void;
}) {
  onState(useFirestoreSession(sessionId, enabled));
  return null;
}

function ParticipantsHarness({
  enabled = true,
  sessionId,
  onState
}: {
  enabled?: boolean;
  sessionId?: string;
  onState: (state: ListenerState<IvsSessionParticipant[]>) => void;
}) {
  onState(useFirestoreSessionParticipants(sessionId, enabled));
  return null;
}

async function mount(element: React.ReactElement) {
  let renderer: ReactTestRenderer | null = null;
  await act(async () => {
    renderer = create(element);
  });
  return renderer!;
}

describe('use-ivs-firestore hooks', () => {
  const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-27T10:00:00.000Z'));
    vi.mocked(onSnapshot).mockImplementation(() => vi.fn());
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockClear();
  });

  it('does not subscribe to sessions when disabled', async () => {
    let latest: ListenerState<IvsSession[]> | null = null;
    const renderer = await mount(<SessionsHarness enabled={false} onState={(state) => { latest = state; }} />);

    expect(latest).toEqual({ data: [], loading: false, error: null });
    expect(onSnapshot).not.toHaveBeenCalled();

    await act(async () => {
      renderer.unmount();
    });
  });

  it('maps and sorts session Firestore snapshots', async () => {
    let latest: ListenerState<IvsSession[]> | null = null;
    const renderer = await mount(
      <SessionsHarness statuses={['live', 'scheduled']} onState={(state) => { latest = state; }} />
    );

    expect(collection).toHaveBeenCalledWith({ app: 'test-db' }, 'sessions');
    expect(where).toHaveBeenCalledWith('status', 'in', ['live', 'scheduled']);
    expect(query).toHaveBeenCalled();

    await act(async () => {
      const next = vi.mocked(onSnapshot).mock.calls[0]?.[1] as (snapshot: unknown) => void;
      next(querySnapshot([
        snapshotDoc('old-session', {
          sessionName: 'Old Class',
          status: 'scheduled',
          createdAt: timestamp('2026-05-27T09:00:00.000Z')
        }),
        snapshotDoc('new-session', {
          sessionName: 'New Class',
          status: 'live',
          startedAt: timestamp('2026-05-27T10:30:00.000Z'),
          createdAt: timestamp('2026-05-27T10:00:00.000Z')
        })
      ]));
    });

    expect(latest?.loading).toBe(false);
    expect(latest?.data.map((item) => item.sessionId)).toEqual(['new-session', 'old-session']);
    expect(latest?.data[0]?.sessionName).toBe('New Class');

    await act(async () => {
      renderer.unmount();
    });
  });

  it('falls back to REST polling when the sessions listener fails', async () => {
    let latest: ListenerState<IvsSession[]> | null = null;
    vi.mocked(listIvsSessions).mockResolvedValue([session({ sessionId: 'fallback-session', status: 'live' })]);
    const unsubscribe = vi.fn();
    vi.mocked(onSnapshot).mockReturnValue(unsubscribe);

    const renderer = await mount(<SessionsHarness statuses={['live']} onState={(state) => { latest = state; }} />);

    await act(async () => {
      const error = vi.mocked(onSnapshot).mock.calls[0]?.[2] as (error: unknown) => void;
      error(new Error('permission denied'));
      await Promise.resolve();
    });

    expect(listIvsSessions).toHaveBeenCalledWith(['live']);
    expect(latest?.data[0]?.sessionId).toBe('fallback-session');

    await act(async () => {
      vi.advanceTimersByTime(15_000);
      await Promise.resolve();
    });

    expect(listIvsSessions).toHaveBeenCalledTimes(2);

    await act(async () => {
      renderer.unmount();
    });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('maps existing and missing single session snapshots', async () => {
    let latest: ListenerState<IvsSession | null> | null = null;
    const renderer = await mount(<SessionHarness sessionId=" session-1 " onState={(state) => { latest = state; }} />);

    expect(doc).toHaveBeenCalledWith({ app: 'test-db' }, 'sessions', 'session-1');

    await act(async () => {
      const next = vi.mocked(onSnapshot).mock.calls[0]?.[1] as (snapshot: unknown) => void;
      next(docSnapshot('session-1', {
        sessionName: 'Mapped Session',
        status: 'live',
        createdAt: timestamp('2026-05-27T10:00:00.000Z')
      }));
    });

    expect(latest?.data?.sessionName).toBe('Mapped Session');
    expect(latest?.loading).toBe(false);

    await act(async () => {
      const next = vi.mocked(onSnapshot).mock.calls[0]?.[1] as (snapshot: unknown) => void;
      next(docSnapshot('session-1', null));
    });

    expect(latest?.data).toBeNull();

    await act(async () => {
      renderer.unmount();
    });
  });

  it('falls back to REST polling for a single session listener failure', async () => {
    let latest: ListenerState<IvsSession | null> | null = null;
    vi.mocked(getIvsSessionById).mockResolvedValue(session({ sessionId: 'session-1', status: 'live' }));

    const renderer = await mount(<SessionHarness sessionId="session-1" onState={(state) => { latest = state; }} />);

    await act(async () => {
      const error = vi.mocked(onSnapshot).mock.calls[0]?.[2] as (error: unknown) => void;
      error(new Error('permission denied'));
      await Promise.resolve();
    });

    expect(getIvsSessionById).toHaveBeenCalledWith('session-1');
    expect(latest?.data?.status).toBe('live');

    await act(async () => {
      vi.advanceTimersByTime(3_000);
      await Promise.resolve();
    });

    expect(getIvsSessionById).toHaveBeenCalledTimes(2);

    await act(async () => {
      renderer.unmount();
    });
  });

  it('maps, filters, and sorts active fresh participants', async () => {
    let latest: ListenerState<IvsSessionParticipant[]> | null = null;
    const renderer = await mount(
      <ParticipantsHarness sessionId=" session-1 " onState={(state) => { latest = state; }} />
    );

    expect(collection).toHaveBeenCalledWith({ app: 'test-db' }, 'sessions', 'session-1', 'participants');
    expect(where).toHaveBeenCalledWith('active', '==', true);

    await act(async () => {
      const next = vi.mocked(onSnapshot).mock.calls[0]?.[1] as (snapshot: unknown) => void;
      next(querySnapshot([
        snapshotDoc('student-b', {
          participantId: 'student-b',
          displayName: 'Beta',
          role: 'student',
          active: true,
          lastSeenAt: timestamp('2026-05-27T09:59:30.000Z'),
          joinedAt: timestamp('2026-05-27T09:50:00.000Z'),
          updatedAt: timestamp('2026-05-27T09:59:30.000Z')
        }),
        snapshotDoc('instructor', {
          participantId: 'instructor',
          displayName: 'Coach',
          role: 'instructor',
          active: true,
          lastSeenAt: timestamp('2026-05-27T09:59:30.000Z'),
          joinedAt: timestamp('2026-05-27T09:50:00.000Z'),
          updatedAt: timestamp('2026-05-27T09:59:30.000Z')
        }),
        snapshotDoc('stale', {
          participantId: 'stale',
          displayName: 'Stale',
          role: 'student',
          active: true,
          lastSeenAt: timestamp('2026-05-27T09:57:00.000Z'),
          joinedAt: timestamp('2026-05-27T09:50:00.000Z'),
          updatedAt: timestamp('2026-05-27T09:57:00.000Z')
        }),
        snapshotDoc('inactive', {
          participantId: 'inactive',
          displayName: 'Inactive',
          role: 'student',
          active: false,
          lastSeenAt: timestamp('2026-05-27T09:59:30.000Z'),
          joinedAt: timestamp('2026-05-27T09:50:00.000Z'),
          updatedAt: timestamp('2026-05-27T09:59:30.000Z')
        })
      ]));
    });

    expect(latest?.data.map((item) => item.participantId)).toEqual(['instructor', 'student-b']);

    await act(async () => {
      vi.setSystemTime(new Date('2026-05-27T10:02:00.000Z'));
      vi.advanceTimersByTime(15_000);
    });

    expect(latest?.data).toEqual([]);

    await act(async () => {
      renderer.unmount();
    });
  });

  it('falls back to REST polling for participant listener failures', async () => {
    let latest: ListenerState<IvsSessionParticipant[]> | null = null;
    vi.mocked(listIvsSessionParticipants).mockResolvedValue([
      participant({ participantId: 'participant-1', lastSeenAt: '2026-05-27T09:59:30.000Z' })
    ]);

    const renderer = await mount(<ParticipantsHarness sessionId="session-1" onState={(state) => { latest = state; }} />);

    await act(async () => {
      const error = vi.mocked(onSnapshot).mock.calls[0]?.[2] as (error: unknown) => void;
      error(new Error('permission denied'));
      await Promise.resolve();
    });

    expect(listIvsSessionParticipants).toHaveBeenCalledWith('session-1');
    expect(latest?.data[0]?.participantId).toBe('participant-1');

    await act(async () => {
      vi.advanceTimersByTime(3_000);
      await Promise.resolve();
    });

    expect(listIvsSessionParticipants).toHaveBeenCalledTimes(2);

    await act(async () => {
      renderer.unmount();
    });
  });
});
