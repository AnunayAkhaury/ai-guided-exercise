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

export async function fetchVideoUrl(videoKey: string) {
  try {
    const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/aws/getVideo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ videoKey })
    });

    if (!response.ok) {
      console.log(`Response status: ${response.status}, statusText: ${response.statusText}`);
      throw new Error(`Failed to fetch url.`);
    }

    const videoUrl = await response.json();
    if (!videoUrl.recordingUrl) {
      throw new Error(`Unable to extract video URL.`);
    }
    return videoUrl.recordingUrl;
  } catch (err) {
    console.log(err);
    throw new Error(`Unknown Error.`);
  }
}
