// sessionId, exercise, starttime, endtime
export type ExerciseTimestamp = {
  sessionId: string | null;
  exercise: string | null;
  starttime: number | null;
  endtime: number | null;
};

export async function addExerciseTimestamp(timestamp: ExerciseTimestamp) {
  try {
    if (!timestamp.sessionId || !timestamp.exercise || !timestamp.starttime || !timestamp.endtime) {
      throw new Error(`Invalid timestamp data.`);
    }

    await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/firebase/addTimestamp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
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

export interface RepFeedback {
  timestampStart: number;
  timestampEnd: number;
  feedback: string;
}

export interface ExerciseFeedback {
  summary: string;
  score: number;
  data: RepFeedback[];
  exericse: string;
}

export async function getFeedbackFromRef(feedbackRef: string): Promise<ExerciseFeedback | null> {
  const url = `${process.env.EXPO_PUBLIC_API_URL}/api/feedback/${feedbackRef}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
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

export async function getFeedbackFromUserId(userId: string): Promise<ExerciseFeedback[] | null> {
  const url = `${process.env.EXPO_PUBLIC_API_URL}/api/feedback/user/${userId}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
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
