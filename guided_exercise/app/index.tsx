// app/index.tsx
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { auth } from '@/src/api/Firebase/firebase-config';

export default function Index() {
  const router = useRouter();
  const user = auth.currentUser;

  useEffect(() => {
    const timeout = setTimeout(() => {
      // if (user) {
      //   router.replace('/(tabs)/classes');
      // } else {
      //   router.replace('/(onboarding)/signup');
      // }
      router.replace('/(tabs)/classes');
    }, 0);

    return () => clearTimeout(timeout);
  }, []);

  return null;
}
