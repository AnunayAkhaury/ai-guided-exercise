import { useUserStore } from '@/src/store/userStore';


function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string') {
    return (err as any).message;
  }
  return fallback;
}

export async function getAchievements() {
  try {
    const uid = useUserStore.getState().uid ?? 'abc';
    const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/firebase/getAchievements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ uid: uid })
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Failed to fetch achievements: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.log(err);
    throw new Error(getErrorMessage(err, 'Failed to fetch achievements.'));
  }
}
