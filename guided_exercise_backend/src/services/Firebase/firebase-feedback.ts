import { db } from './firebase-service.js';

export async function addExerciseTimestamp(sessionId: string, exercise: string, starttime: string, endtime: string) {
  try {
    // Add to recording to collection
    await db.collection('timestamps').doc().set({
      sessionId,
      exercise,
      starttime,
      endtime
    });
  } catch (error) {
    throw error;
  }
}
