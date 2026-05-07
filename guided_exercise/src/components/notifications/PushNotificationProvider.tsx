import { useEffect, useRef, type ReactNode } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { registerPushToken, unregisterPushToken } from '@/src/api/notifications';
import { useUserStore } from '@/src/store/userStore';
import { useToast } from '@/src/components/ui/ToastProvider';

type PushNotificationProviderProps = {
  children: ReactNode;
};

type NotificationData = {
  type?: unknown;
  sessionId?: unknown;
  sessionCode?: unknown;
  recordingId?: unknown;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

function getProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

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

async function registerForNativePushNotifications(uid: string): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('class-updates', {
      name: 'Class updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6155F5'
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') {
    return null;
  }

  const projectId = getProjectId();
  if (!projectId) {
    throw new Error('EAS projectId is missing from app config.');
  }

  const pushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await registerPushToken({
    uid,
    token: pushToken,
    type: 'expo',
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    deviceName: Device.deviceName ?? null
  });

  return pushToken;
}

export function PushNotificationProvider({ children }: PushNotificationProviderProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const uid = useUserStore((state) => state.uid);
  const role = useUserStore((state) => state.role);
  const registeredRef = useRef<{ uid: string; token: string } | null>(null);

  useEffect(() => {
    const notificationListener = Notifications.addNotificationReceivedListener((notification) => {
      const title = notification.request.content.title ?? 'Notification';
      const message = notification.request.content.body ?? undefined;
      showToast({ title, message, variant: 'info' });
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = getRouteForNotification(response.notification.request.content.data as NotificationData, role);
      if (route) {
        router.push(route as any);
      }
    });

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, [role, router, showToast]);

  useEffect(() => {
    const effectiveUid = uid?.trim();
    if (!effectiveUid || Platform.OS === 'web') {
      return;
    }

    let canceled = false;
    void (async () => {
      try {
        const token = await registerForNativePushNotifications(effectiveUid);
        if (!token || canceled) {
          return;
        }
        registeredRef.current = { uid: effectiveUid, token };
      } catch (error) {
        console.log('[PushNotifications] registration failed', error);
      }
    })();

    return () => {
      canceled = true;
    };
  }, [uid]);

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
      console.log('[PushNotifications] unregister failed', error);
    });
  }, [uid]);

  return children;
}
