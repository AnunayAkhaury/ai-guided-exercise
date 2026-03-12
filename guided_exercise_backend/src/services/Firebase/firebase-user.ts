import { db } from './firebase-service.js';

export async function getAchievements(uid: string) {
  try {
    // Retrieve from user collection
    const snapshot = await db.collection('achievements').get();
    if (snapshot.empty) {
      return null;
    }

    const achievements = snapshot.docs.map(doc => {
        return ({
            id: doc.id,
            ...doc.data()
        })
    })
    return achievements;
  } catch (error) {
    throw error;
  }
}
