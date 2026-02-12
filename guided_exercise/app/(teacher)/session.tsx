import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  EventType,
  VideoAspect,
  ZoomVideoSdkUser,
  ZoomView,
  useZoom
} from '@zoom/react-native-videosdk';
import type { EmitterSubscription } from 'react-native';

type SessionParams = {
  sessionName?: string;
  userName?: string;
  token?: string;
};

export default function Session() {
  const zoom = useZoom();
  const router = useRouter();
  const { sessionName, userName, token } = useLocalSearchParams<SessionParams>();
  const [status, setStatus] = useState<'idle' | 'joining' | 'error'>('idle');
  const [error, setError] = useState('');
  const [users, setUsers] = useState<ZoomVideoSdkUser[]>([]);
  const [isInSession, setIsInSession] = useState(false);
  const listeners = useRef<EmitterSubscription[]>([]);
  const joinTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionPoll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    console.log('[Zoom] join effect invoked');
    const join = async () => {
      if (!sessionName || !userName || !token) {
        setError('Missing session parameters.');
        setStatus('error');
        return;
      }

      setStatus('joining');
      try {
        console.log('[Zoom] joinSession params', {
          sessionName,
          userName,
          tokenLength: token.length
        });
        const sessionJoin = zoom.addListener(EventType.onSessionJoin, async () => {
          console.log('[Zoom] onSessionJoin');
          const mySelf = new ZoomVideoSdkUser(await zoom.session.getMySelf());
          const remoteUsers = await zoom.session.getRemoteUsers();
          setUsers([mySelf, ...remoteUsers.map((user) => new ZoomVideoSdkUser(user))]);
          setIsInSession(true);
          setStatus('idle');
          if (joinTimeout.current) {
            clearTimeout(joinTimeout.current);
            joinTimeout.current = null;
          }
        });
        listeners.current.push(sessionJoin);

        const userJoin = zoom.addListener(EventType.onUserJoin, async (event) => {
          console.log('[Zoom] onUserJoin', event?.remoteUsers?.length ?? 0);
          const { remoteUsers } = event;
          const mySelf = new ZoomVideoSdkUser(await zoom.session.getMySelf());
          const remote = remoteUsers.map((user) => new ZoomVideoSdkUser(user));
          setUsers([mySelf, ...remote]);
        });
        listeners.current.push(userJoin);

        const userLeave = zoom.addListener(EventType.onUserLeave, async (event) => {
          console.log('[Zoom] onUserLeave', event?.remoteUsers?.length ?? 0);
          const { remoteUsers } = event;
          const mySelf = new ZoomVideoSdkUser(await zoom.session.getMySelf());
          const remote = remoteUsers.map((user) => new ZoomVideoSdkUser(user));
          setUsers([mySelf, ...remote]);
        });
        listeners.current.push(userLeave);

        console.log('[Zoom] calling joinSession');
        joinTimeout.current = setTimeout(() => {
          if (!isInSession) {
            setError('Join timed out. Please try again.');
            setStatus('error');
          }
        }, 15000);

        await zoom.joinSession({
          sessionName,
          userName,
          token,
          sessionPassword: '',
          sessionIdleTimeoutMins: 10,
          audioOptions: { connect: true, mute: true, autoAdjustSpeakerVolume: false },
          videoOptions: { localVideoOn: true }
        });
        console.log('[Zoom] joinSession resolved');

        // Fallback: poll session state if onSessionJoin doesn't fire.
        let attempts = 0;
        sessionPoll.current = setInterval(async () => {
          attempts += 1;
          try {
            const mySelf = await zoom.session.getMySelf();
            if (mySelf) {
              console.log('[Zoom] session active via getMySelf');
              const selfUser = new ZoomVideoSdkUser(mySelf);
              const remoteUsers = await zoom.session.getRemoteUsers();
              setUsers([selfUser, ...remoteUsers.map((user) => new ZoomVideoSdkUser(user))]);
              setIsInSession(true);
              setStatus('idle');
              if (joinTimeout.current) {
                clearTimeout(joinTimeout.current);
                joinTimeout.current = null;
              }
              if (sessionPoll.current) {
                clearInterval(sessionPoll.current);
                sessionPoll.current = null;
              }
            }
          } catch {
            // ignore until attempts exhausted
          }
          if (attempts >= 10 && sessionPoll.current) {
            clearInterval(sessionPoll.current);
            sessionPoll.current = null;
          }
        }, 1000);
      } catch (err: any) {
        console.log('[Zoom] joinSession error', err);
        setError(err?.message || 'Failed to join session.');
        setStatus('error');
      }
    };

    join();

    return () => {
      if (joinTimeout.current) {
        clearTimeout(joinTimeout.current);
        joinTimeout.current = null;
      }
      if (sessionPoll.current) {
        clearInterval(sessionPoll.current);
        sessionPoll.current = null;
      }
      listeners.current.forEach((listener) => listener.remove());
      listeners.current = [];
    };
  }, [sessionName, token, userName, zoom]);

  return (
    <View style={styles.container}>
      {isInSession && (
        <View style={styles.videoGrid}>
          {users.map((user) => (
            <ZoomView
              key={user.userId}
              style={styles.video}
              userId={user.userId}
              fullScreen={users.length === 1}
              videoAspect={VideoAspect.PanAndScan}
            />
          ))}
        </View>
      )}
      {isInSession && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>
            Connected • {users.length} participant{users.length === 1 ? '' : 's'}
          </Text>
          <Pressable
            style={styles.backButton}
            onPress={() => {
              zoom.leaveSession(false);
              router.back();
            }}>
            <Text style={styles.backText}>Leave</Text>
          </Pressable>
        </View>
      )}
      {!isInSession && status === 'joining' && (
        <>
          <ActivityIndicator size="large" />
          <Text style={styles.text}>Joining session…</Text>
        </>
      )}
      {!isInSession && status === 'error' && <Text style={styles.error}>{error}</Text>}
      {!isInSession && status === 'idle' && <Text style={styles.text}>Preparing session…</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#C3F5FF',
    padding: 24
  },
  videoGrid: {
    ...StyleSheet.absoluteFillObject
  },
  video: {
    flex: 1
  },
  overlay: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12
  },
  overlayText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  },
  backButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10
  },
  backText: {
    fontSize: 12,
    fontWeight: '600'
  },
  text: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600'
  },
  error: {
    color: '#B00020',
    textAlign: 'center'
  }
});
