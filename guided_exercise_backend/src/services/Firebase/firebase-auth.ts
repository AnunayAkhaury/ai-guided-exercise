import { auth, db } from './firebase-service.js';

export async function createUser(email: string, password: string, username: string, fullname: string) {
  try {
    // Create user
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      emailVerified: false,
      disabled: false
    });

    // Add to user collection
    await db.collection('users').doc(userRecord.uid).set({
      email: userRecord.email,
      username: username,
      fullname: fullname
    });

    return userRecord;
  } catch (error) {
    throw error;
  }
}
