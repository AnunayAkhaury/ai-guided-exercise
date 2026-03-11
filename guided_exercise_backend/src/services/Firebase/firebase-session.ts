import { db } from './firebase-service.js';

export type SessionStatus = 'scheduled' | 'live' | 'ended';

export type SessionDocument = {
  sessionId: string;
  sessionCode: string;
  sessionName: string;
  stageArn: string;
  instructorUid: string;
  status: SessionStatus;
  scheduledStartAt: Date | null;
  scheduledEndAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
};

export type SessionParticipantDocument = {
  participantId: string;
  displayName: string;
  role: string | null;
  updatedAt: Date;
};

export type CreateSessionInput = {
  sessionName: string;
  stageArn: string;
  instructorUid: string;
  scheduledStartAt?: Date;
  scheduledEndAt?: Date;
};

const SESSIONS_COLLECTION = 'sessions';
const PARTICIPANTS_SUBCOLLECTION = 'participants';
const SESSION_CODE_LENGTH = 6;
const SESSION_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SESSION_CODE_MAX_RETRIES = 20;

function randomSessionCode(length: number) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += SESSION_CODE_ALPHABET[Math.floor(Math.random() * SESSION_CODE_ALPHABET.length)];
  }
  return code;
}

async function generateUniqueSessionCode(): Promise<string> {
  for (let i = 0; i < SESSION_CODE_MAX_RETRIES; i++) {
    const candidate = randomSessionCode(SESSION_CODE_LENGTH);
    const snapshot = await db.collection(SESSIONS_COLLECTION).where('sessionCode', '==', candidate).limit(1).get();
    if (snapshot.empty) {
      return candidate;
    }
  }
  throw new Error('Unable to generate a unique session code.');
}

function mapSessionDoc(
  id: string,
  data: FirebaseFirestore.DocumentData | undefined
): SessionDocument | null {
  if (!data) {
    return null;
  }
  return {
    sessionId: id,
    sessionCode: data.sessionCode,
    sessionName: data.sessionName,
    stageArn: data.stageArn,
    instructorUid: data.instructorUid,
    status: data.status,
    scheduledStartAt: data.scheduledStartAt?.toDate ? data.scheduledStartAt.toDate() : data.scheduledStartAt ?? null,
    scheduledEndAt: data.scheduledEndAt?.toDate ? data.scheduledEndAt.toDate() : data.scheduledEndAt ?? null,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
    startedAt: data.startedAt?.toDate ? data.startedAt.toDate() : data.startedAt ?? null,
    endedAt: data.endedAt?.toDate ? data.endedAt.toDate() : data.endedAt ?? null
  } as SessionDocument;
}

export async function createSession(input: CreateSessionInput): Promise<SessionDocument> {
  const sessionCode = await generateUniqueSessionCode();
  const now = new Date();
  const ref = db.collection(SESSIONS_COLLECTION).doc();
  const payload: Omit<SessionDocument, 'sessionId'> = {
    sessionCode,
    sessionName: input.sessionName.trim(),
    stageArn: input.stageArn.trim(),
    instructorUid: input.instructorUid.trim(),
    status: 'scheduled',
    scheduledStartAt: input.scheduledStartAt ?? null,
    scheduledEndAt: input.scheduledEndAt ?? null,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    endedAt: null
  };

  await ref.set(payload);

  return {
    sessionId: ref.id,
    ...payload
  };
}

export async function getSessionById(sessionId: string): Promise<SessionDocument | null> {
  const snapshot = await db.collection(SESSIONS_COLLECTION).doc(sessionId).get();
  if (!snapshot.exists) {
    return null;
  }
  return mapSessionDoc(snapshot.id, snapshot.data());
}

export async function getSessionByCode(sessionCode: string): Promise<SessionDocument | null> {
  const normalizedCode = sessionCode.trim().toUpperCase();
  const snapshot = await db
    .collection(SESSIONS_COLLECTION)
    .where('sessionCode', '==', normalizedCode)
    .limit(1)
    .get();
  if (snapshot.empty) {
    return null;
  }
  const doc = snapshot.docs[0];
  if (!doc) {
    return null;
  }
  return mapSessionDoc(doc.id, doc.data());
}

export async function updateSessionStatus(sessionId: string, status: SessionStatus): Promise<void> {
  const now = new Date();
  const payload: Record<string, unknown> = {
    status,
    updatedAt: now
  };
  if (status === 'live') {
    payload.startedAt = now;
  }
  if (status === 'ended') {
    payload.endedAt = now;
  }
  await db.collection(SESSIONS_COLLECTION).doc(sessionId).update(payload);
}

export async function listSessions(statuses?: SessionStatus[]): Promise<SessionDocument[]> {
  let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection(SESSIONS_COLLECTION);

  if (statuses && statuses.length > 0) {
    const uniqueStatuses = Array.from(new Set(statuses));
    if (uniqueStatuses.length === 1) {
      query = query.where('status', '==', uniqueStatuses[0]);
    } else {
      query = query.where('status', 'in', uniqueStatuses);
    }
  }

  const snapshot = await query.limit(100).get();
  const sessions = snapshot.docs
    .map((doc) => mapSessionDoc(doc.id, doc.data()))
    .filter((session): session is SessionDocument => Boolean(session));

  sessions.sort((a, b) => {
    const aTime = (a.startedAt ?? a.scheduledStartAt ?? a.createdAt).getTime();
    const bTime = (b.startedAt ?? b.scheduledStartAt ?? b.createdAt).getTime();
    return bTime - aTime;
  });

  return sessions;
}

export async function endOtherLiveSessions(currentSessionId: string): Promise<number> {
  const snapshot = await db
    .collection(SESSIONS_COLLECTION)
    .where('status', '==', 'live')
    .get();

  const now = new Date();
  const docsToEnd = snapshot.docs.filter((doc) => doc.id !== currentSessionId);
  if (docsToEnd.length === 0) {
    return 0;
  }

  const batch = db.batch();
  docsToEnd.forEach((doc) => {
    batch.update(doc.ref, {
      status: 'ended',
      endedAt: now,
      updatedAt: now
    });
  });
  await batch.commit();
  return docsToEnd.length;
}

export async function deleteSessionById(sessionId: string): Promise<void> {
  const sessionRef = db.collection(SESSIONS_COLLECTION).doc(sessionId);
  const participantsSnapshot = await sessionRef.collection(PARTICIPANTS_SUBCOLLECTION).get();

  const batch = db.batch();
  participantsSnapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  batch.delete(sessionRef);

  await batch.commit();
}

export async function upsertSessionParticipant(
  sessionId: string,
  participantId: string,
  displayName: string,
  role?: string
): Promise<SessionParticipantDocument> {
  const now = new Date();
  const normalizedParticipantId = participantId.trim();
  const normalizedDisplayName = displayName.trim();
  const participantRef = db
    .collection(SESSIONS_COLLECTION)
    .doc(sessionId)
    .collection(PARTICIPANTS_SUBCOLLECTION)
    .doc(normalizedParticipantId);

  await participantRef.set(
    {
      participantId: normalizedParticipantId,
      displayName: normalizedDisplayName,
      role: role?.trim() || null,
      updatedAt: now
    },
    { merge: true }
  );

  return {
    participantId: normalizedParticipantId,
    displayName: normalizedDisplayName,
    role: role?.trim() || null,
    updatedAt: now
  };
}

export async function listSessionParticipants(sessionId: string): Promise<SessionParticipantDocument[]> {
  const snapshot = await db
    .collection(SESSIONS_COLLECTION)
    .doc(sessionId)
    .collection(PARTICIPANTS_SUBCOLLECTION)
    .limit(200)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      participantId: data.participantId,
      displayName: data.displayName,
      role: data.role ?? null,
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt
    } as SessionParticipantDocument;
  });
}
