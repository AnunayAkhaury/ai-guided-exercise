import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/src/api/Firebase/firebase-config';
import { hydrateUserProfile } from '@/src/api/Firebase/firebase-auth';
import { useUserStore } from '@/src/store/userStore';
export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          await hydrateUserProfile(user.uid, user.email ?? null);
        } catch (err) {
          useUserStore.setState({
            uid: user.uid,
            email: user.email ?? null,
            role: null,
            username: null,
            fullname: null
          });
        }
      } else {
        useUserStore.getState().reset();
      }

      useUserStore.setState({ authInitialized: true });
    });

    return unsubscribe;
  }, []);

  return children;
}
