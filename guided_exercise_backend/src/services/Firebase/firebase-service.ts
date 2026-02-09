import fs from 'node:fs';
import path from 'node:path';
import admin from 'firebase-admin';
import type { ServiceAccount } from 'firebase-admin';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';

const envPath = path.resolve(process.cwd(), 'development_env.json');
const hasEnvFile = fs.existsSync(envPath);

if (hasEnvFile) {
  const developmentEnv = JSON.parse(fs.readFileSync(envPath, 'utf-8'));
  const serviceAccount: ServiceAccount = {
    projectId: developmentEnv.FIREBASE_PROJECT_ID,
    privateKey: developmentEnv.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: developmentEnv.FIREBASE_CLIENT_EMAIL
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} else {
  console.warn(
    '[firebase] development_env.json not found. Firebase services are disabled until configured.'
  );
}

export const auth: Auth = admin.apps.length ? admin.auth() : (null as unknown as Auth);
export const db: Firestore = admin.apps.length ? admin.firestore() : (null as unknown as Firestore);
