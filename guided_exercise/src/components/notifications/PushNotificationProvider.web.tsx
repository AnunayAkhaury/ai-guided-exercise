import { useEffect, useRef, type ReactNode } from 'react';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { useRouter } from 'expo-router';
import { app } from '@/src/api/Firebase/firebase-config';
import { registerPushToken, unregisterPushToken } from '@/src/api/notifications';
import { useToast } from '@/src/components/ui/ToastProvider';
import { useUserStore } from '@/src/store/userStore';

type PushNotificationProviderProps = {
  children: ReactNode;
};

type NotificationData = {
  type?: unknown;
};

const FIREBASE_WEB_PUSH_VAPID_KEY = process.env.EXPO_PUBLIC_FIREBASE_WEB_PUSH_VAPID_KEY;

function getRouteForNotification(data: NotificationData, role?: string | null): string | null {
  const classRoute = role === 'instructor' ? '/(tabs)/(teacher)/classes' : '/(tabs)/(student)/classes';
  const recordingsRoute = role === 'instructor' ? '/(tabs)/(teacher)/recordings' : '/(tabs)/(student)/recordings';

  if (data.type === 'recording_ready' || data.type === 'recording_failed') {
    return recordingsRoute;
  }
  if (
    data.type === 'class_scheduled' ||
    data.type === 'class_reminder' ||
    data.type === 'class_live' ||
    data.type === 'class_canceled'
  ) {
    return classRoute;
  }
  return null;
}

export function PushNotificationProvider({ children }: PushNotificationProviderProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const uid = useUserStore((state) => state.uid);
  const role = useUserStore((state) => state.role);
  const registeredRef = useRef<{ uid: string; token: string } | null>(null);

  useEffect(() => {
    const effectiveUid = uid?.trim();
    if (!effectiveUid || !FIREBASE_WEB_PUSH_VAPID_KEY || typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    let unsubscribeMessage: (() => void) | undefined;
    let canceled = false;

    void (async () => {
      try {
        if (!(await isSupported())) {
          return;
        }

        const permission = await window.Notification.requestPermission();
        if (permission !== 'granted' || canceled) {
          return;
        }

        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        const messaging = getMessaging(app);
        const token = await getToken(messaging, {
          vapidKey: FIREBASE_WEB_PUSH_VAPID_KEY,
          serviceWorkerRegistration: registration
        });
        if (!token || canceled) {
          return;
        }

        await registerPushToken({
          uid: effectiveUid,
          token,
          type: 'fcm_web',
          platform: 'web',
          deviceName: navigator.userAgent
        });
        registeredRef.current = { uid: effectiveUid, token };

        unsubscribeMessage = onMessage(messaging, (payload) => {
          showToast({
            title: payload.notification?.title ?? 'Notification',
            message: payload.notification?.body,
            variant: 'info'
          });
        });
      } catch (error) {
        console.log('[PushNotifications][web] registration failed', error);
      }
    })();

    return () => {
      canceled = true;
      unsubscribeMessage?.();
    };
  }, [showToast, uid]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      const route = getRouteForNotification((event.data ?? {}) as NotificationData, role);
      if (route) {
        router.push(route as any);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [role, router]);

  useEffect(() => {
    if (uid) {
      return;
    }

    const registered = registeredRef.current;
    if (!registered) {
      return;
    }

    registeredRef.current = null;
    void unregisterPushToken(registered).catch((error) => {
      console.log('[PushNotifications][web] unregister failed', error);
    });
  }, [uid]);

  return children;
}
