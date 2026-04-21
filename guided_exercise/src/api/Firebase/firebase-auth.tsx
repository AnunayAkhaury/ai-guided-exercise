import { useUserStore } from '@/src/store/userStore';
import { auth } from './firebase-config';

import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import type { UserCredential } from 'firebase/auth';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string') {
    return (err as any).message;
  }
  return fallback;
}

function getApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error(
      'Backend URL is not configured. EXPO_PUBLIC_API_URL is missing in this app build.'
    );
  }
  return API_BASE_URL;
}

function toBackendUnavailableMessage(endpoint: string): string {
  return `Backend unavailable: could not reach ${endpoint}. Check EXPO_PUBLIC_API_URL and confirm backend is running.`;
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

async function postBackendJson<T>(path: string, body: Record<string, unknown>, fallback: string): Promise<T> {
  const base = getApiBaseUrl();
  const endpoint = `${base}${path}`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  } catch {
    throw new Error(toBackendUnavailableMessage(endpoint));
  }

  if (!response.ok) {
    const message = await parseApiError(response, fallback);
    throw new Error(message || fallback);
  }

  return (await response.json()) as T;
}

async function getBackendJson<T>(path: string, fallback: string): Promise<T> {
  const base = getApiBaseUrl();
  const endpoint = `${base}${path}`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch {
    throw new Error(toBackendUnavailableMessage(endpoint));
  }

  if (!response.ok) {
    const message = await parseApiError(response, fallback);
    throw new Error(message || fallback);
  }

  return (await response.json()) as T;
}

export type AppUserProfile = {
  uid: string;
  role: string;
  username: string;
  fullname: string;
  email?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

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
    const data = await postBackendJson<{
      role?: string;
      fullname?: string;
      username?: string;
      email?: string | null;
    }>(
      '/api/firebase/createProfile',
      { uid, role, username, fullname, email },
      'Failed to create profile.'
    );

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
    await hydrateUserProfile(userCredential.user.uid, userCredential.user.email ?? null);
  } catch (err) {
    console.log(err);
    throw new Error(getErrorMessage(err, 'Failed to login.'));
  }
}

export async function hydrateUserProfile(uid: string, fallbackEmail?: string | null) {
  const data = await postBackendJson<{
    role: string;
    fullname: string;
    username: string;
    email?: string | null;
  }>(
    '/api/firebase/getProfile',
    { uid },
    'Failed to load profile from backend.'
  );

  useUserStore.setState({
    uid,
    role: data.role,
    fullname: data.fullname,
    username: data.username,
    email: data.email ?? fallbackEmail ?? null
  });

  return data;
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

export async function listProfiles(role?: string) {
  const query = role?.trim() ? `?role=${encodeURIComponent(role.trim())}` : '';
  return getBackendJson<AppUserProfile[]>(
    `/api/firebase/users${query}`,
    'Failed to load user profiles.'
  );
}

export async function updateUserProfile(uid: string, username: string, fullname: string) {
  try {
    const data = await postBackendJson<{
      uid: string;
      role: string;
      username: string;
      fullname: string;
      email?: string | null;
    }>(
      '/api/firebase/updateProfile',
      { uid, username, fullname },
      'Failed to update profile.'
    );

    useUserStore.setState((state) => ({
      ...state,
      uid: data.uid,
      role: data.role,
      username: data.username,
      fullname: data.fullname,
      email: data.email ?? state.email
    }));

    return data;
  } catch (err) {
    console.log(err);
    throw new Error(getErrorMessage(err, 'Failed to update profile.'));
  }
}
