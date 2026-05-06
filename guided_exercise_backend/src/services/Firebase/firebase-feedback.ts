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

export interface RepFeedback {
  timestampStart: number;
  timestampEnd: number;
  feedback: string;
}

export interface ExerciseFeedback {
  summary: string;
  score: number;
  data: RepFeedback[];
}

export async function addClipWithFeedback(
  recordingId: string,
  processedVideoUrl: string,
  exercise: string,
  rawFeedbackJson: string,
  userId: string,
  duration: string
) {
  try {
    const processedFeedback = await parseFeedbackString(rawFeedbackJson);

    let feedbackRef: string | null = null;

    if (processedFeedback) {
      const feedbackDoc = await db.collection('feedbacks').add({
        ...processedFeedback,
        userId,
        recordingId,
        createdAt: new Date().toISOString()
      });
      feedbackRef = feedbackDoc.id;
    }

    await db.collection('clips').add({
      recordingId,
      processedVideoUrl,
      exercise,
      userId,
      duration,
      feedbackRef,
      feedback: rawFeedbackJson,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to save to database:', error);
    throw error;
  }
}

async function parseFeedbackString(jsonString: string): Promise<ExerciseFeedback | null> {
  if (!jsonString) return null;

  try {
    const raw = JSON.parse(jsonString);

    const formattedData: RepFeedback[] = (raw.repetition_feedbacks || []).map((item: any) => ({
      timestampStart: item.timestamp_start,
      timestampEnd: item.timestamp_end <= item.timestamp_start ? item.timestamp_start + 1000 : item.timestamp_end,
      feedback: item.feedback
    }));

    return {
      summary: raw.summary || 'No summary available.',
      score: raw.score || 0,
      data: formattedData.sort((a, b) => a.timestampStart - b.timestampStart)
    };
  } catch (error) {
    console.error('JSON Parsing failed:', error);
    return null;
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

export async function getFeedbackFromRef(feedbackRef: string): Promise<ExerciseFeedback | null> {
  const normalizedFeedbackRef = feedbackRef.trim();

  if (!normalizedFeedbackRef) return null;

  try {
    const snapshot = await db.collection('feedbacks').doc(normalizedFeedbackRef).get();

    if (!snapshot || !snapshot.exists) {
      return null;
    }

    const snapshotData = snapshot.data();
    if (!snapshotData) return null;

    return snapshotData as ExerciseFeedback;
  } catch (error) {
    console.error('Error fetching feedback ref:', error);
    return null;
  }
}
