import developmentEnv from '../../../development_env.json' with { type: 'json' };

import admin from 'firebase-admin';
import type { ServiceAccount } from 'firebase-admin';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';

const serviceAccount: ServiceAccount = {
  projectId: developmentEnv.FIREBASE_PROJECT_ID,
  privateKey: developmentEnv.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  clientEmail: developmentEnv.FIREBASE_CLIENT_EMAIL
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

export const auth: Auth = admin.auth();
export const db: Firestore = admin.firestore();
