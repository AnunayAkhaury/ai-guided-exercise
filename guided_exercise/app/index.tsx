// app/index.tsx
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { auth } from '@/src/api/Firebase/firebase-config';
import { useUserStore } from '@/src/store/userStore';

export default function Index() {
  const router = useRouter();
  const user = auth.currentUser;
  const role = useUserStore((state) => state.role);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (user) {
        if (role === 'instructor') {
          router.replace('/(tabs)/(teacher)/classes');
          return;
        }
        if (role === 'student') {
          router.replace('/(tabs)/(student)/classes');
          return;
        }
        router.replace('/(tabs)/profile');
      } else {
        router.replace('/(onboarding)/signup');
      }
    }, 0);

    return () => clearTimeout(timeout);
  }, [role, router, user]);

  return null;
}
