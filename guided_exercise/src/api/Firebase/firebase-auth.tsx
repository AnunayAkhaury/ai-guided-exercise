import { auth } from './firebase-config';

import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import type { UserCredential } from 'firebase/auth';

export async function createAccount(email: string, password: string) {
  try {
    const userCredential: UserCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user.uid;
  } catch (err) {
    throw new Error(`Unknown Error.`);
  }
}

export async function createProfile(uid: string, role: string, username: string, fullname: string) {
  try {
    // Create user profile in Firestore
    const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/createProfile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ uid, role, username, fullname })
    });

    if (!response.ok) {
      throw new Error(`Failed to create profile: ${response.statusText}`);
    }
  } catch (err) {
    throw new Error(`Unknown Error.`);
  }
}

export async function login(email: string, password: string) {
  try {
    const userCredential: UserCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user.uid;
  } catch (err) {
    throw new Error(`Unknown Error.`);
  }
}
