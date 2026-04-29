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

export async function getFeedbackFromRef(feedbackRef: string) {
  await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/firebase/${feedbackRef}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
}
