import { auth, db } from './firebase-service.js';
export async function createProfile(uid, role, username, fullname, email) {
    try {
        const userRef = db.collection('users').doc(uid);
        const existingSnapshot = await userRef.get();
        const existingData = existingSnapshot.data();
        const now = new Date();
        // Keep existing profile data when present to avoid accidental overwrite on re-signup attempts.
        const effectiveRole = existingData?.role ?? role;
        const effectiveUsername = existingData?.username ?? username;
        const effectiveFullname = existingData?.fullname ?? fullname;
        const effectiveEmail = existingData?.email ?? email ?? null;
        const effectiveCreatedAt = existingData?.createdAt?.toDate
            ? existingData.createdAt.toDate()
            : existingData?.createdAt ?? now;
        await auth.setCustomUserClaims(uid, { role: effectiveRole });
        await userRef.set({
            role: effectiveRole,
            username: effectiveUsername,
            fullname: effectiveFullname,
            email: effectiveEmail,
            createdAt: effectiveCreatedAt,
            updatedAt: now
        }, { merge: true });
        return {
            role: effectiveRole,
            username: effectiveUsername,
            fullname: effectiveFullname,
            email: effectiveEmail,
            createdAt: effectiveCreatedAt,
            updatedAt: now
        };
    }
    catch (error) {
        throw error;
    }
}
export async function getProfile(uid) {
    try {
        // Retrieve from user collection
        const doc = await db.collection('users').doc(uid).get();
        if (!doc.exists) {
            return null;
        }
        const user = doc.data();
        return {
            role: user?.role,
            username: user?.username,
            fullname: user?.fullname,
            email: user?.email ?? null,
            createdAt: user?.createdAt?.toDate ? user.createdAt.toDate() : user?.createdAt ?? null,
            updatedAt: user?.updatedAt?.toDate ? user.updatedAt.toDate() : user?.updatedAt ?? null
        };
    }
    catch (error) {
        throw error;
    }
}
//# sourceMappingURL=firebase-auth.js.map