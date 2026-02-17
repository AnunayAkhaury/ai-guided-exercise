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

export async function getProfile(uid: string) {
  try {
    // Retrieve from user collection
    const doc = await db.collection('users').doc(uid).get();
    if (!doc.exists) {
      return null;
    }
    const user = doc.data();
    return user;
  } catch (error) {
    throw error;
  }
}
