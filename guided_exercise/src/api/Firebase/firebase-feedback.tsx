// sessionId, exercise, starttime, endtime
export type ExerciseTimestamp = {
  sessionId: string | null;
  exercise: string | null;
  starttime: number | null;
  endtime: number | null;
};

import { getAuthHeader } from './firebase-auth';
export async function addExerciseTimestamp(timestamp: ExerciseTimestamp) {
  try {
    if (!timestamp.sessionId || !timestamp.exercise || !timestamp.starttime || !timestamp.endtime) {
      throw new Error(`Invalid timestamp data.`);
    }

    await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/firebase/addTimestamp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await getAuthHeader())
      },
      body: JSON.stringify({
        sessionId: timestamp.sessionId,
        exercise: timestamp.exercise,
        starttime: timestamp.starttime,
        endtime: timestamp.endtime
      })
    });
  } catch (err) {
    throw new Error(`Error Adding Timestamp.`);
  }
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

export interface FeedbackData {
  feedback: string;
  timestampStart: number;
  timestampEnd: number;
}

export async function getFeedbackFromRef(feedbackRef: string): Promise<Feedback | null> {
  const url = `${process.env.EXPO_PUBLIC_API_URL}/api/feedback/${feedbackRef}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(await getAuthHeader())
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Fetch failed with status ${response.status}. Body:`, errorText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Network or Parsing Error in getFeedbackFromRef:', error);
    return null;
  }
}

export async function getFeedbackFromUserId(userId: string): Promise<Feedback[] | null> {
  const url = `${process.env.EXPO_PUBLIC_API_URL}/api/feedback/user/${userId}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(await getAuthHeader())
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Fetch failed with status ${response.status}. Body:`, errorText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Network or Parsing Error in getFeedbackFromUserId:', error);
    return null;
  }
}
