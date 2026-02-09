type ZoomTokenRequest = {
  sessionName: string;
  userName: string;
};

type ZoomTokenResponse = {
  token: string;
};

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export async function getZoomToken({
  sessionName,
  userName
}: ZoomTokenRequest): Promise<string> {
  if (!API_BASE_URL) {
    throw new Error('EXPO_PUBLIC_API_URL is not set.');
  }

  const response = await fetch(`${API_BASE_URL}/api/zoom/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionName,
      userName,
      role: 1
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to fetch Zoom token.');
  }

  const data = (await response.json()) as ZoomTokenResponse;
  if (!data.token) {
    throw new Error('Zoom token missing from response.');
  }

  return data.token;
}
