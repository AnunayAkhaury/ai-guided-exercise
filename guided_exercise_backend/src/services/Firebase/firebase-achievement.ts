import { db } from './firebase-service.js';

export async function getAchievements(uid: string) {
  try {
    const userToAchievementsSnapshot = await db
      .collection('users_to_achievements')
      .where('user_id', '==', uid)
      .where('completed', '==', true)
      .get();

    if (userToAchievementsSnapshot.empty) {
      return null;
    }

    const achievementIds = userToAchievementsSnapshot.docs.map(doc =>
      doc.data().achievement_id
    );

    const achievementPromises = achievementIds.map((achievementId: string) =>
      db.collection('achievements').doc(achievementId).get()
    );

    const achievementDocs = await Promise.all(achievementPromises);

    const achievements = achievementDocs.map(doc => {
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
