import { db } from './firebase-service.js';

export async function addRecording(uid: string, link: string, exercise: string) {
  const curDate = new Date(Date.now());

  try {
    // Add to recording to collection
    await db.collection('recordings').doc().set({
      uid: uid,
      link: link,
      exercise: exercise,
      date: curDate
    });
  } catch (error) {
    throw error;
  }
}

export async function getUserRecordings(uid: string) {
  try {
    const snapshot = await db.collection('recordings').where('uid', '==', uid).orderBy('date', 'desc').get();

    // Map to array of recording
    const recordings = snapshot.docs.map((doc) => ({
      id: doc.id,
      link: doc.data().link,
      exercise: doc.data().exercise,
      date: doc.data().date.toDate() //convert to javascript date
    }));

    return recordings;
  } catch (error) {
    console.error('Error fetching recordings:', error);
    throw error;
  }
}
