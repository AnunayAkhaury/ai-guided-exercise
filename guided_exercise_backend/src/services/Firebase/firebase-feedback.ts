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

export interface LLMFeedbackData {
  timestampStart: number;
  timestampEnd: number;
  feedback: string;
}

export interface LLMFeedback {
  summary: string;
  score: number;
  repCount: number;
  data: LLMFeedbackData[];
}

export interface Feedback {
  userId: string;
  summary: string;
  starttime: number;
  score: number;
  feedbackJson: string;
  exercise: string;
  repCount: number;
  data: FeedbackData[];
}

// OUTPUT
export interface FeedbackData {
  feedback: string;
  timestampStart: number;
  timestampEnd: number;
}

export type AddClipInput = {
  clipUrl: string;
  exercise: string;
  userId: string;
  duration: string;
  starttime: string;
  recordingId?: string | null;
  sessionId?: string | null;
  sessionName?: string | null;
};

export async function addClip(input: AddClipInput) {
  try {
    const optionalMetadata: Record<string, string> = {};

    if (input.recordingId?.trim()) optionalMetadata.recordingId = input.recordingId.trim();
    if (input.sessionId?.trim()) optionalMetadata.sessionId = input.sessionId.trim();
    if (input.sessionName?.trim()) optionalMetadata.sessionName = input.sessionName.trim();

    const clip = await db.collection('clips').add({
      clipUrl: input.clipUrl,
      exercise: input.exercise,
      userId: input.userId,
      duration: input.duration,
      starttime: input.starttime,
      feedbackRef: null,
      ...optionalMetadata
    });
    return clip.id;
  } catch (error) {
    console.error('Failed to save to database:', error);
    throw error;
  }
}

export async function addFeedback(
  clipId: string,
  exercise: string,
  feedbackJson: string,
  starttime: string,
  userId: string
) {
  const processedFeedback = await parseFeedbackString(feedbackJson);

  try {
    const feedback = await db.collection('feedbacks').add({
      exercise,
      feedbackJson,
      starttime,
      userId,

      summary: processedFeedback?.summary ?? null,
      score: processedFeedback?.score ?? 0,
      data: processedFeedback?.data ?? [],
      repCount: processedFeedback?.repCount ?? 0
    });

    await db.collection('clips').doc(String(clipId)).update({ feedbackRef: feedback.id });

    return feedback.id;
  } catch (error) {
    console.error('Failed to save to database:', error);
    throw error;
  }
}

async function parseFeedbackString(jsonString: string): Promise<LLMFeedback | null> {
  if (!jsonString) return null;

  try {
    const raw = JSON.parse(jsonString);

    const formattedData: LLMFeedbackData[] = (raw.flag_feedbacks || []).map((item: any) => ({
      timestampStart: item.timestamp_start,
      timestampEnd: item.timestamp_end <= item.timestamp_start ? item.timestamp_start + 1000 : item.timestamp_end,
      feedback: item.feedback
    }));

    return {
      summary: raw.summary || 'No summary available.',
      score: raw.score || 0,
      data: formattedData.sort((a, b) => a.timestampStart - b.timestampStart),
      repCount: raw.rep_count
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

export async function getFeedbackFromRef(feedbackRef: string): Promise<Feedback | null> {
  const normalizedFeedbackRef = feedbackRef.trim();

  if (!normalizedFeedbackRef) return null;

  try {
    const snapshot = await db.collection('feedbacks').doc(normalizedFeedbackRef).get();

    if (!snapshot || !snapshot.exists) {
      return null;
    }

    const snapshotData = snapshot.data();
    if (!snapshotData) return null;

    return snapshotData as Feedback;
  } catch (error) {
    console.error('Error fetching feedback ref:', error);
    return null;
  }
}

export async function getFeedbackFromUserId(userId: string) {
  try {
    const snapshot = await db.collection('feedbacks').where('userId', '==', userId).get();
    const feedbacks = snapshot.docs.map((doc) => doc.data() as Feedback);
    return feedbacks;
  } catch (error) {
    console.error('Error fetching feedbacks:', error);
    return null;
  }
}
