import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useUserStore } from '@/src/store/userStore';
import { getVerificationStatus } from '@/src/api/Firebase/firebase-auth';

export default function AuthRedirect() {
  const router = useRouter();
  const { uid, role, authInitialized } = useUserStore();

  useEffect(() => {
    if (!authInitialized) return;

    const run = async () => {
      if (!uid) {
        router.replace('/(onboarding)/signup');
        return;
      }

      const verificationStatus = await getVerificationStatus(uid);

      if (verificationStatus === false) {
        router.replace('/(onboarding)/pending-verification');
        return;
      }

      if (role === 'instructor') {
        router.replace('/(tabs)/(teacher)/classes');
      } else if (role === 'student') {
        router.replace('/(tabs)/(student)/classes');
      } else {
        router.replace('/(tabs)/profile');
      }
    };

    run();
  }, [uid, role, authInitialized, router]);

  return null;
}
