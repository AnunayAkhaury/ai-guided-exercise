export async function fetchRecordings(uid: string) {
  try {
    const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/firebase/getUserRecordings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ uid })
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch recordings: ${response.statusText}`);
    }

    const userRecordings = await response.json();
    if (!userRecordings) {
      throw new Error(`Unable to extract user recordings.`);
    }
    return userRecordings;
  } catch (err) {
    console.log(err);
    throw new Error(`Unknown Error.`);
  }
}
