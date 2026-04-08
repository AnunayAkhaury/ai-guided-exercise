import { db } from './firebase-service.js';
const SESSIONS_COLLECTION = 'sessions';
const PARTICIPANTS_SUBCOLLECTION = 'participants';
const SESSION_CODE_LENGTH = 6;
const SESSION_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SESSION_CODE_MAX_RETRIES = 20;
function randomSessionCode(length) {
    let code = '';
    for (let i = 0; i < length; i++) {
        code += SESSION_CODE_ALPHABET[Math.floor(Math.random() * SESSION_CODE_ALPHABET.length)];
    }
    return code;
}
async function generateUniqueSessionCode() {
    for (let i = 0; i < SESSION_CODE_MAX_RETRIES; i++) {
        const candidate = randomSessionCode(SESSION_CODE_LENGTH);
        const snapshot = await db.collection(SESSIONS_COLLECTION).where('sessionCode', '==', candidate).limit(1).get();
        if (snapshot.empty) {
            return candidate;
        }
    }
    throw new Error('Unable to generate a unique session code.');
}
function mapSessionDoc(id, data) {
    if (!data) {
        return null;
    }
    return {
        sessionId: id,
        ivsSessionId: data.ivsSessionId ?? null,
        sessionCode: data.sessionCode,
        sessionName: data.sessionName,
        stageArn: data.stageArn,
        instructorUid: data.instructorUid,
        coachName: data.coachName ?? data.instructorUid ?? 'Coach',
        status: data.status,
        scheduledStartAt: data.scheduledStartAt?.toDate ? data.scheduledStartAt.toDate() : data.scheduledStartAt ?? null,
        scheduledEndAt: data.scheduledEndAt?.toDate ? data.scheduledEndAt.toDate() : data.scheduledEndAt ?? null,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
        startedAt: data.startedAt?.toDate ? data.startedAt.toDate() : data.startedAt ?? null,
        endedAt: data.endedAt?.toDate ? data.endedAt.toDate() : data.endedAt ?? null
    };
}
export async function createSession(input) {
    const sessionCode = await generateUniqueSessionCode();
    const now = new Date();
    const ref = db.collection(SESSIONS_COLLECTION).doc();
    const payload = {
        ivsSessionId: null,
        sessionCode,
        sessionName: input.sessionName.trim(),
        stageArn: input.stageArn.trim(),
        instructorUid: input.instructorUid.trim(),
        coachName: input.coachName?.trim() || input.instructorUid.trim(),
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
export async function getSessionById(sessionId) {
    const snapshot = await db.collection(SESSIONS_COLLECTION).doc(sessionId).get();
    if (!snapshot.exists) {
        return null;
    }
    return mapSessionDoc(snapshot.id, snapshot.data());
}
export async function getSessionByCode(sessionCode) {
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
export async function getSessionByIvsSessionId(ivsSessionId) {
    const normalizedIvsSessionId = ivsSessionId.trim();
    if (!normalizedIvsSessionId) {
        return null;
    }
    const snapshot = await db
        .collection(SESSIONS_COLLECTION)
        .where('ivsSessionId', '==', normalizedIvsSessionId)
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
export async function updateSessionIvsSessionId(sessionId, ivsSessionId) {
    const normalizedIvsSessionId = ivsSessionId.trim();
    if (!normalizedIvsSessionId) {
        return;
    }
    await db.collection(SESSIONS_COLLECTION).doc(sessionId).set({
        ivsSessionId: normalizedIvsSessionId,
        updatedAt: new Date()
    }, { merge: true });
}
export async function updateSessionStatus(sessionId, status) {
    const now = new Date();
    const payload = {
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
export async function listSessions(statuses) {
    let query = db.collection(SESSIONS_COLLECTION);
    if (statuses && statuses.length > 0) {
        const uniqueStatuses = Array.from(new Set(statuses));
        if (uniqueStatuses.length === 1) {
            query = query.where('status', '==', uniqueStatuses[0]);
        }
        else {
            query = query.where('status', 'in', uniqueStatuses);
        }
    }
    const snapshot = await query.limit(100).get();
    const sessions = snapshot.docs
        .map((doc) => mapSessionDoc(doc.id, doc.data()))
        .filter((session) => Boolean(session));
    sessions.sort((a, b) => {
        const aTime = (a.startedAt ?? a.scheduledStartAt ?? a.createdAt).getTime();
        const bTime = (b.startedAt ?? b.scheduledStartAt ?? b.createdAt).getTime();
        return bTime - aTime;
    });
    return sessions;
}
export async function endOtherLiveSessions(currentSessionId) {
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
export async function deleteSessionById(sessionId) {
    const sessionRef = db.collection(SESSIONS_COLLECTION).doc(sessionId);
    const participantsSnapshot = await sessionRef.collection(PARTICIPANTS_SUBCOLLECTION).get();
    const batch = db.batch();
    participantsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    batch.delete(sessionRef);
    await batch.commit();
}
export async function upsertSessionParticipant(sessionId, participantId, displayName, role, userId) {
    const now = new Date();
    const normalizedParticipantId = participantId.trim();
    const normalizedDisplayName = displayName.trim();
    const normalizedUserId = userId?.trim() || null;
    const participantRef = db
        .collection(SESSIONS_COLLECTION)
        .doc(sessionId)
        .collection(PARTICIPANTS_SUBCOLLECTION)
        .doc(normalizedParticipantId);
    const participantsCollectionRef = db.collection(SESSIONS_COLLECTION).doc(sessionId).collection(PARTICIPANTS_SUBCOLLECTION);
    const existing = await participantRef.get();
    const existingData = existing.data();
    const existingJoinedAt = existingData?.joinedAt?.toDate ? existingData.joinedAt.toDate() : existingData?.joinedAt ?? now;
    const batch = db.batch();
    if (normalizedUserId) {
        const activeEntriesForUser = await participantsCollectionRef
            .where('userId', '==', normalizedUserId)
            .where('active', '==', true)
            .get();
        activeEntriesForUser.docs
            .filter((doc) => doc.id !== normalizedParticipantId)
            .forEach((doc) => {
            batch.set(doc.ref, {
                active: false,
                leftAt: now,
                updatedAt: now,
                lastSeenAt: now
            }, { merge: true });
        });
    }
    batch.set(participantRef, {
        participantId: normalizedParticipantId,
        userId: normalizedUserId,
        displayName: normalizedDisplayName,
        role: role?.trim() || null,
        active: true,
        joinedAt: existingJoinedAt,
        leftAt: null,
        lastSeenAt: now,
        updatedAt: now
    }, { merge: true });
    await batch.commit();
    return {
        participantId: normalizedParticipantId,
        userId: normalizedUserId,
        displayName: normalizedDisplayName,
        role: role?.trim() || null,
        active: true,
        joinedAt: existingJoinedAt,
        leftAt: null,
        lastSeenAt: now,
        updatedAt: now
    };
}
export async function listSessionParticipants(sessionId) {
    const snapshot = await db
        .collection(SESSIONS_COLLECTION)
        .doc(sessionId)
        .collection(PARTICIPANTS_SUBCOLLECTION)
        .limit(200)
        .get();
    const participants = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
            participantId: data.participantId,
            userId: data.userId ?? null,
            displayName: data.displayName,
            role: data.role ?? null,
            active: data.active === true,
            joinedAt: data.joinedAt?.toDate ? data.joinedAt.toDate() : data.joinedAt,
            leftAt: data.leftAt?.toDate ? data.leftAt.toDate() : data.leftAt ?? null,
            lastSeenAt: data.lastSeenAt?.toDate ? data.lastSeenAt.toDate() : data.lastSeenAt,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt
        };
    });
    const rolePriority = (role) => {
        if (role === 'instructor')
            return 0;
        if (role === 'student')
            return 1;
        return 2;
    };
    return participants
        .filter((participant) => participant.active)
        .sort((a, b) => {
        const roleDelta = rolePriority(a.role) - rolePriority(b.role);
        if (roleDelta !== 0)
            return roleDelta;
        const nameDelta = a.displayName.localeCompare(b.displayName);
        if (nameDelta !== 0)
            return nameDelta;
        return a.participantId.localeCompare(b.participantId);
    });
}
export async function getSessionParticipantById(sessionId, participantId) {
    const normalizedParticipantId = participantId.trim();
    const snapshot = await db
        .collection(SESSIONS_COLLECTION)
        .doc(sessionId)
        .collection(PARTICIPANTS_SUBCOLLECTION)
        .doc(normalizedParticipantId)
        .get();
    if (!snapshot.exists) {
        return null;
    }
    const data = snapshot.data();
    if (!data) {
        return null;
    }
    return {
        participantId: data.participantId ?? normalizedParticipantId,
        userId: data.userId ?? null,
        displayName: data.displayName ?? '',
        role: data.role ?? null,
        active: data.active === true,
        joinedAt: data.joinedAt?.toDate ? data.joinedAt.toDate() : data.joinedAt,
        leftAt: data.leftAt?.toDate ? data.leftAt.toDate() : data.leftAt ?? null,
        lastSeenAt: data.lastSeenAt?.toDate ? data.lastSeenAt.toDate() : data.lastSeenAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt
    };
}
export async function findLatestSessionByParticipantId(participantId) {
    const normalizedParticipantId = participantId.trim();
    const snapshot = await db
        .collectionGroup(PARTICIPANTS_SUBCOLLECTION)
        .where('participantId', '==', normalizedParticipantId)
        .limit(25)
        .get();
    if (snapshot.empty) {
        return null;
    }
    const candidates = await Promise.all(snapshot.docs.map(async (doc) => {
        const data = doc.data();
        const participantUpdatedAtRaw = data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt;
        const participantUpdatedAt = participantUpdatedAtRaw instanceof Date && !Number.isNaN(participantUpdatedAtRaw.getTime())
            ? participantUpdatedAtRaw
            : new Date(0);
        const sessionRef = doc.ref.parent.parent;
        if (!sessionRef)
            return null;
        const sessionSnapshot = await sessionRef.get();
        if (!sessionSnapshot.exists)
            return null;
        const session = mapSessionDoc(sessionSnapshot.id, sessionSnapshot.data());
        if (!session)
            return null;
        return { session, participantUpdatedAt };
    }));
    const validCandidates = candidates.filter((value) => Boolean(value));
    if (validCandidates.length === 0) {
        return null;
    }
    validCandidates.sort((a, b) => b.participantUpdatedAt.getTime() - a.participantUpdatedAt.getTime());
    return validCandidates[0]?.session ?? null;
}
export async function markSessionParticipantLeft(sessionId, participantId) {
    const now = new Date();
    const normalizedParticipantId = participantId.trim();
    const participantRef = db
        .collection(SESSIONS_COLLECTION)
        .doc(sessionId)
        .collection(PARTICIPANTS_SUBCOLLECTION)
        .doc(normalizedParticipantId);
    const existing = await participantRef.get();
    if (!existing.exists) {
        return null;
    }
    const data = existing.data();
    const joinedAt = data?.joinedAt?.toDate ? data.joinedAt.toDate() : data?.joinedAt ?? now;
    await participantRef.set({
        active: false,
        leftAt: now,
        lastSeenAt: now,
        updatedAt: now
    }, { merge: true });
    return {
        participantId: normalizedParticipantId,
        userId: data?.userId ?? null,
        displayName: data?.displayName,
        role: data?.role ?? null,
        active: false,
        joinedAt,
        leftAt: now,
        lastSeenAt: now,
        updatedAt: now
    };
}
//# sourceMappingURL=firebase-session.js.map