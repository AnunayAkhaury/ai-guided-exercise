import 'dotenv/config';
import admin from 'firebase-admin';
if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
    console.warn('[firebase] Missing Firebase environment variables. Firebase services are disabled until configured.');
}
const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL
};
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
export const auth = admin.apps.length ? admin.auth() : null;
export const db = admin.apps.length ? admin.firestore() : null;
//# sourceMappingURL=firebase-service.js.map