import 'dotenv/config';
import { auth, db } from '../src/services/Firebase/firebase-service.js';
async function deleteCollection(collectionName, batchSize = 300) {
    while (true) {
        const snapshot = await db.collection(collectionName).limit(batchSize).get();
        if (snapshot.empty) {
            break;
        }
        const batch = db.batch();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
    }
}
async function deleteAllAuthUsers() {
    let nextPageToken;
    do {
        const listResult = await auth.listUsers(1000, nextPageToken);
        const uids = listResult.users.map((u) => u.uid);
        if (uids.length > 0) {
            const deleteResult = await auth.deleteUsers(uids);
            if (deleteResult.failureCount > 0) {
                console.log('[reset-firebase] Some auth users failed to delete:', deleteResult.errors.length);
            }
            console.log(`[reset-firebase] Deleted auth users: ${uids.length - deleteResult.failureCount}/${uids.length}`);
        }
        nextPageToken = listResult.pageToken;
    } while (nextPageToken);
}
async function main() {
    console.log('[reset-firebase] Starting full reset...');
    await deleteAllAuthUsers();
    await deleteCollection('users');
    console.log('[reset-firebase] Deleted Firestore collection: users');
    await deleteCollection('sessions');
    console.log('[reset-firebase] Deleted Firestore collection: sessions');
    await deleteCollection('recordings');
    console.log('[reset-firebase] Deleted Firestore collection: recordings');
    console.log('[reset-firebase] Reset complete.');
}
main().catch((err) => {
    console.error('[reset-firebase] Failed:', err);
    process.exit(1);
});
//# sourceMappingURL=reset-firebase.js.map