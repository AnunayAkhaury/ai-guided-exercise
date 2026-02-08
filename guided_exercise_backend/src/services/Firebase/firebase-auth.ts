import { auth, db } from './firebase-service.js';

export async function createProfile(uid: string, role: string, username: string, fullname: string) {
  try {
    // Set user role (can be accessed in frontend)
    await auth.setCustomUserClaims(uid, { role: role });

    // Add to user collection
    await db.collection('users').doc(uid).set({
      role: role,
      username: username,
      fullname: fullname
    });

    return uid;
  } catch (error) {
    throw error;
  }
}
