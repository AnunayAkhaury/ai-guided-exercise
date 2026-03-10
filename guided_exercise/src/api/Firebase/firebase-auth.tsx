import { useUserStore } from '@/src/store/userStore';
import { auth } from './firebase-config';

import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import type { UserCredential } from 'firebase/auth';

function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string') {
    return (err as any).message;
  }
  return fallback;
}

async function parseApiError(response: Response, fallback: string): Promise<string> {
  const requestIdHeader = response.headers.get('x-request-id');
  try {
    const payload = (await response.json()) as { message?: string; requestId?: string };
    const requestId = payload?.requestId || requestIdHeader || 'unknown';
    const message = payload?.message || fallback;
    return `${message} (requestId: ${requestId})`;
  } catch {
    const text = await response.text();
    const requestId = requestIdHeader || 'unknown';
    return `${text || fallback} (requestId: ${requestId})`;
  }
}

export async function createAccount(email: string, password: string) {
  try {
    const userCredential: UserCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user.uid;
  } catch (err) {
    console.log(err);
    throw new Error(getErrorMessage(err, 'Failed to create account.'));
  }
}

export async function createProfile(uid: string, role: string, username: string, fullname: string, email?: string) {
  try {
    // Create user profile in Firestore
    const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/firebase/createProfile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ uid, role, username, fullname, email })
    });

    if (!response.ok) {
      const message = await parseApiError(response, `Failed to create profile: ${response.status}`);
      throw new Error(message || `Failed to create profile: ${response.status}`);
    }

    const data = await response.json();

    useUserStore.setState({
      uid: uid,
      role: data?.role ?? role,
      fullname: data?.fullname ?? fullname,
      username: data?.username ?? username,
      email: data?.email ?? email ?? null
    });
    return data;
  } catch (err) {
    console.log(err);
    throw new Error(getErrorMessage(err, 'Failed to create profile.'));
  }
}

export async function login(email: string, password: string) {
  try {
    const userCredential: UserCredential = await signInWithEmailAndPassword(auth, email, password);

    const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/firebase/getProfile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ uid: userCredential.user.uid })
    });

    if (!response.ok) {
      const message = await parseApiError(response, `Failed to login: ${response.status}`);
      throw new Error(message || `Failed to login: ${response.status}`);
    }

    const data = await response.json();

    useUserStore.setState({
      uid: userCredential.user.uid,
      role: data.role,
      fullname: data.fullname,
      username: data.username,
      email: data.email ?? userCredential.user.email ?? null
    });
  } catch (err) {
    console.log(err);
    throw new Error(getErrorMessage(err, 'Failed to login.'));
  }
}

export async function logout() {
  try {
    await signOut(auth);
  } catch (err) {
    console.log(err);
    throw new Error(getErrorMessage(err, 'Failed to logout.'));
  } finally {
    useUserStore.getState().reset();
  }
}
