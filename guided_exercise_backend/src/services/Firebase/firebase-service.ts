import 'dotenv/config';
import admin from 'firebase-admin';
import type { ServiceAccount } from 'firebase-admin';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';

if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
  console.warn('[firebase] Missing Firebase environment variables. Firebase services are disabled until configured.');
}

const serviceAccount: ServiceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID!,
  privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL!
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

export const auth: Auth = admin.apps.length ? admin.auth() : (null as unknown as Auth);
export const db: Firestore = admin.apps.length ? admin.firestore() : (null as unknown as Firestore);
