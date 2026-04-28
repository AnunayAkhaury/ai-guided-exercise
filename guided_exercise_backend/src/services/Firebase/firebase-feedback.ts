import { db } from './firebase-service.js';

export async function addExerciseTimestamp(sessionId: string, exercise: string, starttime: string, endtime: string) {
  try {
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

export async function addClipWithFeedback(
  recordingId: string,
  processedVideoUrl: string,
  exercise: string,
  feedback: string,
  userId: string
) {
  try {
    await db.collection('clips').doc().set({
      recordingId,
      processedVideoUrl,
      exercise,
      feedback,
      userId
    });
  } catch (error) {
    throw error;
  }
}

export async function getTimestamps(recordingId: string) {
  try {
    const recordingSnap = await db.collection('recordings_v2').doc(recordingId).get();

    if (!recordingSnap.exists) {
      throw new Error('Recording not found');
    }

    const recording = recordingSnap.data();

    const sessionId = recording?.sessionId;
    const recordingStart = recording?.recordingStart;

    if (!sessionId || !recordingStart) {
      throw new Error('Missing sessionId or recordingStart');
    }

    const recordingStartMs = recordingStart.toDate().getTime();

    const querySnap = await db.collection('timestamps').where('sessionId', '==', sessionId).get();

    const timestamps = querySnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    return {
      recordingStartMs,
      timestamps
    };
  } catch (err) {
    throw err;
  }
}
