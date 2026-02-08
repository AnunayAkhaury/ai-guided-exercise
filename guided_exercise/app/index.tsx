// app/index.tsx
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';

export default function Index() {
  const router = useRouter();
  const user = getAuth().currentUser;

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (user) {
        router.replace('/(tabs)/classes');
      } else {
        router.replace('/(onboarding)/signup');
      }
    }, 0);

    return () => clearTimeout(timeout);
  }, []);

  return null;
}
