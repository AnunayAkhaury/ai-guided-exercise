import { auth, db } from './firebase-service.js';

type UserProfile = {
  uid?: string;
  role: string;
  username: string;
  fullname: string;
  email: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function createProfile(uid: string, role: string, username: string, fullname: string, email?: string) {
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

    await userRef.set(
      {
        role: effectiveRole,
        username: effectiveUsername,
        fullname: effectiveFullname,
        email: effectiveEmail,
        createdAt: effectiveCreatedAt,
        updatedAt: now
      },
      { merge: true }
    );

    return {
      role: effectiveRole,
      username: effectiveUsername,
      fullname: effectiveFullname,
      email: effectiveEmail,
      createdAt: effectiveCreatedAt,
      updatedAt: now
    } as UserProfile;
  } catch (error) {
    throw error;
  }
}

export async function getProfile(uid: string) {
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
  } catch (error) {
    throw error;
  }
}

export async function listProfilesByRole(role?: string) {
  try {
    let query: FirebaseFirestore.Query = db.collection('users');
    if (role?.trim()) {
      query = query.where('role', '==', role.trim());
    }

    const snapshot = await query.get();
    const profiles = snapshot.docs.map((doc) => {
      const user = doc.data();
      return {
        uid: doc.id,
        role: user?.role ?? '',
        username: user?.username ?? '',
        fullname: user?.fullname ?? '',
        email: user?.email ?? null,
        createdAt: user?.createdAt?.toDate ? user.createdAt.toDate() : user?.createdAt ?? null,
        updatedAt: user?.updatedAt?.toDate ? user.updatedAt.toDate() : user?.updatedAt ?? null
      };
    });

    profiles.sort((a, b) => {
      const aName = `${a.fullname || ''} ${a.username || ''}`.trim().toLowerCase();
      const bName = `${b.fullname || ''} ${b.username || ''}`.trim().toLowerCase();
      return aName.localeCompare(bName);
    });

    return profiles;
  } catch (error) {
    throw error;
  }
}

export async function updateProfile(uid: string, input: {
  username?: string;
  fullname?: string;
}) {
  try {
    const userRef = db.collection('users').doc(uid);
    const snapshot = await userRef.get();
    if (!snapshot.exists) {
      return null;
    }

    const existingData = snapshot.data() ?? {};
    const now = new Date();
    const nextUsername = input.username?.trim() ?? existingData.username ?? '';
    const nextFullname = input.fullname?.trim() ?? existingData.fullname ?? '';

    if (!nextUsername) {
      throw new Error('username is required');
    }
    if (!nextFullname) {
      throw new Error('fullname is required');
    }

    await userRef.set(
      {
        username: nextUsername,
        fullname: nextFullname,
        updatedAt: now
      },
      { merge: true }
    );

    return {
      uid,
      role: existingData.role ?? '',
      username: nextUsername,
      fullname: nextFullname,
      email: existingData.email ?? null,
      createdAt: existingData.createdAt?.toDate ? existingData.createdAt.toDate() : existingData.createdAt ?? null,
      updatedAt: now
    };
  } catch (error) {
    throw error;
  }
}
