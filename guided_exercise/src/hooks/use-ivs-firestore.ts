import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where, type DocumentData, type Query } from 'firebase/firestore';
import { db } from '@/src/api/Firebase/firebase-config';
import {
  getIvsSessionById,
  listIvsSessionParticipants,
  listIvsSessions,
  type IvsSession,
  type IvsSessionParticipant,
  type IvsSessionStatus
} from '@/src/api/ivs';

const SESSIONS_COLLECTION = 'sessions';
const PARTICIPANTS_SUBCOLLECTION = 'participants';
const EPOCH_ISO = new Date(0).toISOString();
const CLASS_LIST_FALLBACK_POLL_MS = 15000;
const SESSION_DETAIL_FALLBACK_POLL_MS = 3000;
const PARTICIPANTS_FALLBACK_POLL_MS = 3000;
const PARTICIPANT_STALE_MS = 90 * 1000;
const PARTICIPANT_STALENESS_RECHECK_MS = 15 * 1000;

type ListenerState<T> = {
  data: T;
  loading: boolean;
  error: Error | null;
};

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as any).toDate === 'function') {
    return (value as any).toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return null;
}

function rolePriority(role: string | null) {
  if (role === 'instructor') return 0;
  if (role === 'student') return 1;
  return 2;
}

function isParticipantFresh(lastSeenAtIso: string | null) {
  if (!lastSeenAtIso) {
    return false;
  }
  const lastSeenAtMs = new Date(lastSeenAtIso).getTime();
  if (!Number.isFinite(lastSeenAtMs)) {
    return false;
  }
  return Date.now() - lastSeenAtMs <= PARTICIPANT_STALE_MS;
}

function mapSessionDoc(id: string, data: DocumentData): IvsSession {
  return {
    sessionId: id,
    ivsSessionId: data.ivsSessionId ?? null,
    sessionCode: data.sessionCode ?? '',
    sessionName: data.sessionName ?? '',
    stageArn: data.stageArn ?? '',
    instructorUid: data.instructorUid ?? '',
    coachName: data.coachName ?? data.instructorUid ?? 'Coach',
    status: data.status ?? 'scheduled',
    scheduledStartAt: toIso(data.scheduledStartAt),
    scheduledEndAt: toIso(data.scheduledEndAt),
    createdAt: toIso(data.createdAt) ?? EPOCH_ISO,
    updatedAt: toIso(data.updatedAt) ?? EPOCH_ISO,
    startedAt: toIso(data.startedAt),
    endedAt: toIso(data.endedAt)
  } as IvsSession;
}

function mapParticipantDoc(id: string, data: DocumentData): IvsSessionParticipant {
  return {
    participantId: data.participantId ?? id,
    userId: data.userId ?? null,
    displayName: data.displayName ?? '',
    role: data.role ?? null,
    active: data.active === true,
    joinedAt: toIso(data.joinedAt) ?? EPOCH_ISO,
    leftAt: toIso(data.leftAt),
    lastSeenAt: toIso(data.lastSeenAt) ?? EPOCH_ISO,
    updatedAt: toIso(data.updatedAt) ?? EPOCH_ISO
  } as IvsSessionParticipant;
}

function sortSessions(sessions: IvsSession[]) {
  return [...sessions].sort((a, b) => {
    const aTime = new Date(a.startedAt ?? a.scheduledStartAt ?? a.createdAt).getTime();
    const bTime = new Date(b.startedAt ?? b.scheduledStartAt ?? b.createdAt).getTime();
    return bTime - aTime;
  });
}

function sortParticipants(participants: IvsSessionParticipant[]) {
  return [...participants]
    .filter((participant) => participant.active && isParticipantFresh(participant.lastSeenAt))
    .sort((a, b) => {
      const roleDelta = rolePriority(a.role) - rolePriority(b.role);
      if (roleDelta !== 0) return roleDelta;
      const nameDelta = a.displayName.localeCompare(b.displayName);
      if (nameDelta !== 0) return nameDelta;
      return a.participantId.localeCompare(b.participantId);
    });
}

function toLogMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function useFirestoreSessions(statuses?: IvsSessionStatus[], enabled = true): ListenerState<IvsSession[]> {
  const [state, setState] = useState<ListenerState<IvsSession[]>>({ data: [], loading: enabled, error: null });

  const normalizedStatusesKey = useMemo(() => {
    if (!statuses || statuses.length === 0) return '';
    return Array.from(new Set(statuses)).join(',');
  }, [statuses]);

  useEffect(() => {
    if (!enabled) {
      setState({ data: [], loading: false, error: null });
      return;
    }

    let cancelled = false;
    let fallbackStarted = false;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    const normalizedStatuses = normalizedStatusesKey
      ? (normalizedStatusesKey.split(',') as IvsSessionStatus[])
      : [];

    const loadFallbackSessions = async () => {
      try {
        const sessions = sortSessions(await listIvsSessions(normalizedStatuses));
        console.log('[useFirestoreSessions] REST fallback success', {
          statuses: normalizedStatuses,
          count: sessions.length
        });
        if (!cancelled) {
          setState({ data: sessions, loading: false, error: null });
        }
      } catch (error) {
        console.log('[useFirestoreSessions] REST fallback failed', {
          statuses: normalizedStatuses,
          message: toLogMessage(error)
        });
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: error instanceof Error ? error : new Error(String(error))
          }));
        }
      }
    };

    const startFallback = (error: unknown) => {
      if (fallbackStarted) return;
      fallbackStarted = true;
      console.log('[useFirestoreSessions] Firestore listener failed, starting REST fallback', {
        statuses: normalizedStatuses,
        message: toLogMessage(error)
      });
      if (!cancelled) {
        setState((prev) => ({
          ...prev,
          loading: true,
          error: error instanceof Error ? error : new Error(String(error))
        }));
      }
      void loadFallbackSessions();
      fallbackInterval = setInterval(() => {
        void loadFallbackSessions();
      }, CLASS_LIST_FALLBACK_POLL_MS);
    };

    let sessionsQuery: Query<DocumentData> = collection(db, SESSIONS_COLLECTION);
    if (normalizedStatuses.length === 1) {
      sessionsQuery = query(sessionsQuery, where('status', '==', normalizedStatuses[0]));
    } else if (normalizedStatuses.length > 1) {
      sessionsQuery = query(sessionsQuery, where('status', 'in', normalizedStatuses));
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    console.log('[useFirestoreSessions] starting Firestore listener', {
      statuses: normalizedStatuses
    });

    const unsubscribe = onSnapshot(
      sessionsQuery,
      (snapshot) => {
        const sessions = sortSessions(snapshot.docs.map((sessionDoc) => mapSessionDoc(sessionDoc.id, sessionDoc.data())));
        console.log('[useFirestoreSessions] Firestore listener success', {
          statuses: normalizedStatuses,
          count: sessions.length
        });
        setState({ data: sessions, loading: false, error: null });
      },
      (error) => {
        startFallback(error);
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
    };
  }, [enabled, normalizedStatusesKey]);

  return state;
}

export function useFirestoreSession(sessionId?: string, enabled = true): ListenerState<IvsSession | null> {
  const [state, setState] = useState<ListenerState<IvsSession | null>>({ data: null, loading: enabled && Boolean(sessionId), error: null });

  useEffect(() => {
    if (!enabled || !sessionId?.trim()) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    const normalizedSessionId = sessionId.trim();
    let cancelled = false;
    let fallbackStarted = false;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    const loadFallbackSession = async () => {
      try {
        const session = await getIvsSessionById(normalizedSessionId);
        console.log('[useFirestoreSession] REST fallback success', {
          sessionId: normalizedSessionId,
          status: session.status
        });
        if (!cancelled) {
          setState({ data: session, loading: false, error: null });
        }
      } catch (error) {
        console.log('[useFirestoreSession] REST fallback failed', {
          sessionId: normalizedSessionId,
          message: toLogMessage(error)
        });
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: error instanceof Error ? error : new Error(String(error))
          }));
        }
      }
    };

    const startFallback = (error: unknown) => {
      if (fallbackStarted) return;
      fallbackStarted = true;
      console.log('[useFirestoreSession] Firestore listener failed, starting REST fallback', {
        sessionId: normalizedSessionId,
        message: toLogMessage(error)
      });
      if (!cancelled) {
        setState((prev) => ({
          ...prev,
          loading: true,
          error: error instanceof Error ? error : new Error(String(error))
        }));
      }
      void loadFallbackSession();
      fallbackInterval = setInterval(() => {
        void loadFallbackSession();
      }, SESSION_DETAIL_FALLBACK_POLL_MS);
    };

    setState((prev) => ({ ...prev, loading: true, error: null }));
    console.log('[useFirestoreSession] starting Firestore listener', {
      sessionId: normalizedSessionId
    });

    const unsubscribe = onSnapshot(
      doc(db, SESSIONS_COLLECTION, normalizedSessionId),
      (snapshot) => {
        if (!snapshot.exists()) {
          console.log('[useFirestoreSession] Firestore listener success (missing doc)', {
            sessionId: normalizedSessionId
          });
          setState({ data: null, loading: false, error: null });
          return;
        }
        const session = mapSessionDoc(snapshot.id, snapshot.data());
        console.log('[useFirestoreSession] Firestore listener success', {
          sessionId: normalizedSessionId,
          status: session.status
        });
        setState({ data: session, loading: false, error: null });
      },
      (error) => {
        startFallback(error);
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
    };
  }, [enabled, sessionId]);

  return state;
}

export function useFirestoreSessionParticipants(sessionId?: string, enabled = true): ListenerState<IvsSessionParticipant[]> {
  const [state, setState] = useState<ListenerState<IvsSessionParticipant[]>>({ data: [], loading: enabled && Boolean(sessionId), error: null });

  useEffect(() => {
    if (!enabled || !sessionId?.trim()) {
      return;
    }

    const interval = setInterval(() => {
      setState((prev) => {
        if (prev.data.length === 0) {
          return prev;
        }
        const nextParticipants = sortParticipants(prev.data);
        const unchanged =
          nextParticipants.length === prev.data.length &&
          nextParticipants.every((participant, index) => participant.participantId === prev.data[index]?.participantId);
        if (unchanged) {
          return prev;
        }
        return {
          ...prev,
          data: nextParticipants
        };
      });
    }, PARTICIPANT_STALENESS_RECHECK_MS);

    return () => {
      clearInterval(interval);
    };
  }, [enabled, sessionId]);

  useEffect(() => {
    if (!enabled || !sessionId?.trim()) {
      setState({ data: [], loading: false, error: null });
      return;
    }

    const normalizedSessionId = sessionId.trim();
    let cancelled = false;
    let fallbackStarted = false;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    const loadFallbackParticipants = async () => {
      try {
        const participants = sortParticipants(await listIvsSessionParticipants(normalizedSessionId));
        console.log('[useFirestoreSessionParticipants] REST fallback success', {
          sessionId: normalizedSessionId,
          count: participants.length
        });
        if (!cancelled) {
          setState({ data: participants, loading: false, error: null });
        }
      } catch (error) {
        console.log('[useFirestoreSessionParticipants] REST fallback failed', {
          sessionId: normalizedSessionId,
          message: toLogMessage(error)
        });
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: error instanceof Error ? error : new Error(String(error))
          }));
        }
      }
    };

    const startFallback = (error: unknown) => {
      if (fallbackStarted) return;
      fallbackStarted = true;
      console.log('[useFirestoreSessionParticipants] Firestore listener failed, starting REST fallback', {
        sessionId: normalizedSessionId,
        message: toLogMessage(error)
      });
      if (!cancelled) {
        setState((prev) => ({
          ...prev,
          loading: true,
          error: error instanceof Error ? error : new Error(String(error))
        }));
      }
      void loadFallbackParticipants();
      fallbackInterval = setInterval(() => {
        void loadFallbackParticipants();
      }, PARTICIPANTS_FALLBACK_POLL_MS);
    };

    const participantsQuery = query(
      collection(db, SESSIONS_COLLECTION, normalizedSessionId, PARTICIPANTS_SUBCOLLECTION),
      where('active', '==', true)
    );

    setState((prev) => ({ ...prev, loading: true, error: null }));
    console.log('[useFirestoreSessionParticipants] starting Firestore listener', {
      sessionId: normalizedSessionId
    });

    const unsubscribe = onSnapshot(
      participantsQuery,
      (snapshot) => {
        const participants = sortParticipants(snapshot.docs.map((participantDoc) => mapParticipantDoc(participantDoc.id, participantDoc.data())));
        console.log('[useFirestoreSessionParticipants] Firestore listener success', {
          sessionId: normalizedSessionId,
          count: participants.length
        });
        setState({ data: participants, loading: false, error: null });
      },
      (error) => {
        startFallback(error);
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
    };
  }, [enabled, sessionId]);

  return state;
}
