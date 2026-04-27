// app/index.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { auth } from '@/src/api/Firebase/firebase-config';
import { onAuthStateChanged } from 'firebase/auth';
import { useUserStore } from '@/src/store/userStore';
import { hydrateUserProfile } from '@/src/api/Firebase/firebase-auth';

export default function Index() {
  const router = useRouter();
  const [isBootstrapped, setIsBootstrapped] = useState(false);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      void (async () => {
        if (!active) return;

        if (user) {
          try {
            await hydrateUserProfile(user.uid, user.email ?? null);
          } catch (error) {
            console.log('[AuthBootstrap] profile hydrate failed', error);
            useUserStore.setState({
              uid: user.uid,
              role: null,
              fullname: null,
              username: null,
              email: user.email ?? null
            });
          }

          if (!active) return;
          const latestRole = useUserStore.getState().role;
          if (latestRole === 'instructor') {
            router.replace('/(tabs)/(teacher)/classes');
          } else if (latestRole === 'student') {
            router.replace('/(tabs)/(student)/classes');
          } else {
            router.replace('/(tabs)/profile');
          }
        } else {
          useUserStore.getState().reset();
          router.replace('/(onboarding)/signup');
        }

        if (active) {
          setIsBootstrapped(true);
        }
      })();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [router]);

  if (!isBootstrapped) {
    return null;
  }

  return null;
}
