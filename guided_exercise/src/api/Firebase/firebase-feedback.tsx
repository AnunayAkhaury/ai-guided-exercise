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

    // 1. Check if the server actually returned a 200 OK
    if (!response.ok) {
      const errorText = await response.text(); // Get the HTML/Error body
      console.error(`Fetch failed with status ${response.status}. Body:`, errorText);
      return null;
    }

    // 2. Try to parse the JSON
    return await response.json();
  } catch (error) {
    console.error('Network or Parsing Error in getFeedbackFromRef:', error);
    return null;
  }
}
