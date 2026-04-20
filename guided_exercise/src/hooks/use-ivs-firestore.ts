import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where, type DocumentData, type Query } from 'firebase/firestore';
import { db } from '@/src/api/Firebase/firebase-config';
import type { IvsSession, IvsSessionParticipant, IvsSessionStatus } from '@/src/api/ivs';

const SESSIONS_COLLECTION = 'sessions';
const PARTICIPANTS_SUBCOLLECTION = 'participants';
const EPOCH_ISO = new Date(0).toISOString();

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
    .filter((participant) => participant.active)
    .sort((a, b) => {
      const roleDelta = rolePriority(a.role) - rolePriority(b.role);
      if (roleDelta !== 0) return roleDelta;
      const nameDelta = a.displayName.localeCompare(b.displayName);
      if (nameDelta !== 0) return nameDelta;
      return a.participantId.localeCompare(b.participantId);
    });
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

    const normalizedStatuses = normalizedStatusesKey
      ? (normalizedStatusesKey.split(',') as IvsSessionStatus[])
      : [];

    let sessionsQuery: Query<DocumentData> = collection(db, SESSIONS_COLLECTION);
    if (normalizedStatuses.length === 1) {
      sessionsQuery = query(sessionsQuery, where('status', '==', normalizedStatuses[0]));
    } else if (normalizedStatuses.length > 1) {
      sessionsQuery = query(sessionsQuery, where('status', 'in', normalizedStatuses));
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    const unsubscribe = onSnapshot(
      sessionsQuery,
      (snapshot) => {
        const sessions = sortSessions(snapshot.docs.map((sessionDoc) => mapSessionDoc(sessionDoc.id, sessionDoc.data())));
        setState({ data: sessions, loading: false, error: null });
      },
      (error) => {
        setState((prev) => ({ ...prev, loading: false, error }));
      }
    );

    return unsubscribe;
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

    setState((prev) => ({ ...prev, loading: true, error: null }));

    const unsubscribe = onSnapshot(
      doc(db, SESSIONS_COLLECTION, sessionId.trim()),
      (snapshot) => {
        if (!snapshot.exists()) {
          setState({ data: null, loading: false, error: null });
          return;
        }
        setState({ data: mapSessionDoc(snapshot.id, snapshot.data()), loading: false, error: null });
      },
      (error) => {
        setState((prev) => ({ ...prev, loading: false, error }));
      }
    );

    return unsubscribe;
  }, [enabled, sessionId]);

  return state;
}

export function useFirestoreSessionParticipants(sessionId?: string, enabled = true): ListenerState<IvsSessionParticipant[]> {
  const [state, setState] = useState<ListenerState<IvsSessionParticipant[]>>({ data: [], loading: enabled && Boolean(sessionId), error: null });

  useEffect(() => {
    if (!enabled || !sessionId?.trim()) {
      setState({ data: [], loading: false, error: null });
      return;
    }

    const participantsQuery = query(
      collection(db, SESSIONS_COLLECTION, sessionId.trim(), PARTICIPANTS_SUBCOLLECTION),
      where('active', '==', true)
    );

    setState((prev) => ({ ...prev, loading: true, error: null }));

    const unsubscribe = onSnapshot(
      participantsQuery,
      (snapshot) => {
        const participants = sortParticipants(snapshot.docs.map((participantDoc) => mapParticipantDoc(participantDoc.id, participantDoc.data())));
        setState({ data: participants, loading: false, error: null });
      },
      (error) => {
        setState((prev) => ({ ...prev, loading: false, error }));
      }
    );

    return unsubscribe;
  }, [enabled, sessionId]);

  return state;
}
