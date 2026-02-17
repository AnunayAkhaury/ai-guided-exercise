import { useEffect, useRef, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import {
  EventType,
  VideoAspect,
  ZoomVideoSdkUser,
  ZoomView,
  useZoom
} from '@zoom/react-native-videosdk';
import type { EmitterSubscription } from 'react-native';

type ZoomCallProps = {
  sessionName?: string;
  userName?: string;
  token?: string;
  onLeave?: () => void;
};

export default function ZoomCall({ sessionName, userName, token, onLeave }: ZoomCallProps) {
  const zoom = useZoom();
  const listeners = useRef<EmitterSubscription[]>([]);
  const [users, setUsersInSession] = useState<ZoomVideoSdkUser[]>([]);
  const [isInSession, setIsInSession] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(true);
  const [isVideoMuted, setIsVideoMuted] = useState(true);
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [status, setStatus] = useState('');
  const [tokenInfo, setTokenInfo] = useState<string>('');

  const decodeJwtPayload = (jwtToken: string) => {
    const parts = jwtToken.split('.');
    if (parts.length < 2) {
      return null;
    }
    try {
      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, '=');
      if (typeof atob !== 'function') {
        return null;
      }
      const decoded = atob(padded);
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  };

  const join = async () => {
    if (isJoining || isInSession) {
      return;
    }
    setError('');
    setStatus('Starting join...');
    setIsJoining(true);

    if (!sessionName || !userName || !token) {
      setError('Missing session details.');
      setStatus('');
      setIsJoining(false);
      return;
    }

    console.log('[ZoomCall] join requested', {
      sessionName,
      userName,
      tokenLength: token.length
    });

    const payload = decodeJwtPayload(token) as
      | { app_key?: string; tpc?: string; iat?: number; exp?: number; role_type?: number }
      | null;
    console.log('[ZoomCall] token payload', payload);
    if (payload) {
      setTokenInfo(
        `app_key=${payload.app_key ?? 'n/a'} tpc=${payload.tpc ?? 'n/a'} iat=${payload.iat ?? 'n/a'} exp=${payload.exp ?? 'n/a'} role=${payload.role_type ?? 'n/a'}`
      );
    } else {
      setTokenInfo('token payload: unavailable');
    }

    const sessionJoin = zoom.addListener(EventType.onSessionJoin, async () => {
      setStatus('Joined session');
      const mySelf = new ZoomVideoSdkUser(await zoom.session.getMySelf());
      const remoteUsers = await zoom.session.getRemoteUsers();
      setUsersInSession([mySelf, ...remoteUsers]);
      setIsInSession(true);
      setIsJoining(false);
    });
    listeners.current.push(sessionJoin);

    const userJoin = zoom.addListener(EventType.onUserJoin, async (event) => {
      const { remoteUsers } = event;
      const mySelf = await zoom.session.getMySelf();
      const remote = remoteUsers.map((user) => new ZoomVideoSdkUser(user));
      setUsersInSession([mySelf, ...remote]);
    });
    listeners.current.push(userJoin);

    const userLeave = zoom.addListener(EventType.onUserLeave, async (event) => {
      const { remoteUsers } = event;
      const mySelf = await zoom.session.getMySelf();
      const remote = remoteUsers.map((user) => new ZoomVideoSdkUser(user));
      setUsersInSession([mySelf, ...remote]);
    });
    listeners.current.push(userLeave);

    const userVideo = zoom.addListener(EventType.onUserVideoStatusChanged, async (event) => {
      const { changedUsers } = event;
      const mySelf = new ZoomVideoSdkUser(await zoom.session.getMySelf());
      changedUsers.find((user) => user.userId === mySelf.userId) &&
        mySelf.videoStatus.isOn().then((on) => setIsVideoMuted(!on));
    });
    listeners.current.push(userVideo);

    const userAudio = zoom.addListener(EventType.onUserAudioStatusChanged, async (event) => {
      const { changedUsers } = event;
      const mySelf = new ZoomVideoSdkUser(await zoom.session.getMySelf());
      changedUsers.find((user) => user.userId === mySelf.userId) &&
        mySelf.audioStatus.isMuted().then((muted) => setIsAudioMuted(muted));
    });
    listeners.current.push(userAudio);

    const sessionLeave = zoom.addListener(EventType.onSessionLeave, (event) => {
      console.log('[ZoomCall] onSessionLeave', event);
      setStatus(`Left session${event?.reason ? `: ${event.reason}` : ''}`);
      setIsInSession(false);
      setUsersInSession([]);
      setIsJoining(false);
      sessionLeave.remove();
    });
    listeners.current.push(sessionLeave);

    try {
      setStatus('Calling joinSession...');
      await zoom.joinSession({
        sessionName,
        sessionPassword: '',
        userName,
        sessionIdleTimeoutMins: 10,
        token,
        audioOptions: { connect: true, mute: true, autoAdjustSpeakerVolume: false },
        videoOptions: { localVideoOn: true }
      });
    } catch (e: any) {
      console.log('[ZoomCall] joinSession error', e);
      setError(e?.message || 'Join Session failed');
      setStatus('');
      setIsJoining(false);
    }
  };

  const leaveSession = () => {
    zoom.leaveSession(false);
    setIsInSession(false);
    listeners.current.forEach((listener) => listener.remove());
    listeners.current = [];
    onLeave?.();
  };

  const onPressAudio = async () => {
    const mySelf = await zoom.session.getMySelf();
    const muted = await mySelf.audioStatus.isMuted();
    muted
      ? await zoom.audioHelper.unmuteAudio(mySelf.userId)
      : await zoom.audioHelper.muteAudio(mySelf.userId);
  };

  const onPressVideo = async () => {
    const mySelf = await zoom.session.getMySelf();
    const videoOn = await mySelf.videoStatus.isOn();
    videoOn ? await zoom.videoHelper.stopVideo() : await zoom.videoHelper.startVideo();
  };

  useEffect(() => {
    return () => {
      listeners.current.forEach((listener) => listener.remove());
      listeners.current = [];
    };
  }, []);

  return isInSession ? (
    <View style={styles.container}>
      {users.map((user) => (
        <View style={styles.container} key={user.userId}>
          <ZoomView
            style={styles.container}
            userId={user.userId}
            fullScreen
            videoAspect={VideoAspect.PanAndScan}
          />
        </View>
      ))}
      <Button title="Leave Session" color="#f01040" onPress={leaveSession} />
      <View style={styles.buttonHolder}>
        <Button title={isAudioMuted ? 'Unmute Audio' : 'Mute Audio'} onPress={onPressAudio} />
        <View style={styles.spacer} />
        <Button title={isVideoMuted ? 'Unmute Video' : 'Mute Video'} onPress={onPressVideo} />
      </View>
    </View>
  ) : (
    <View style={styles.container}>
      <Text style={styles.heading}>Welcome to Class</Text>
      <Text style={styles.heading}>Click Join Session When Ready</Text>
      <View style={styles.spacer} />
      {!!status && <Text style={styles.status}>{status}</Text>}
      {!!tokenInfo && <Text style={styles.status}>{tokenInfo}</Text>}
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Button title={isJoining ? 'Joining...' : 'Join Session'} onPress={join} disabled={isJoining} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'center',
    height: '100%',
    flex: 1,
    justifyContent: 'center'
  },
  spacer: {
    height: 16,
    width: 8
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  buttonHolder: {
    flexDirection: 'row',
    justifyContent: 'center',
    margin: 8
  },
  error: {
    color: '#B00020',
    textAlign: 'center',
    marginBottom: 12
  },
  status: {
    color: '#333',
    textAlign: 'center',
    marginBottom: 12
  }
});
