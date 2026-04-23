import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyAQNGH2BNurUfZlPn2mWgkHcQb5kbD3QX8',
  authDomain: 'ai-guided-exercise-feedback.firebaseapp.com',
  projectId: 'ai-guided-exercise-feedback',
  storageBucket: 'ai-guided-exercise-feedback.firebasestorage.app',
  messagingSenderId: '396997576150',
  appId: '1:396997576150:web:751cdf7ad7849f36e35077'
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence]
    });
  } catch (error: any) {
    if (error?.code === 'auth/already-initialized') {
      return getAuth(app);
    }
    throw error;
  }
})();

export const db = getFirestore(app);
