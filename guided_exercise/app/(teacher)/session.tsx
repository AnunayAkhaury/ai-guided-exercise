import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useZoom } from '@zoom/react-native-videosdk';

type SessionParams = {
  sessionName?: string;
  userName?: string;
  token?: string;
};

export default function Session() {
  const zoom = useZoom();
  const { sessionName, userName, token } = useLocalSearchParams<SessionParams>();
  const [status, setStatus] = useState<'idle' | 'joining' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    const join = async () => {
      if (!sessionName || !userName || !token) {
        setError('Missing session parameters.');
        setStatus('error');
        return;
      }

      setStatus('joining');
      try {
        await zoom.joinSession({
          sessionName,
          userName,
          token,
          sessionPassword: '',
          sessionIdleTimeoutMins: 10,
          audioOptions: { connect: true, mute: true, autoAdjustSpeakerVolume: false },
          videoOptions: { localVideoOn: true }
        });
      } catch (err: any) {
        setError(err?.message || 'Failed to join session.');
        setStatus('error');
      }
    };

    join();
  }, [sessionName, token, userName, zoom]);

  return (
    <View style={styles.container}>
      {status === 'joining' && (
        <>
          <ActivityIndicator size="large" />
          <Text style={styles.text}>Joining session…</Text>
        </>
      )}
      {status === 'error' && <Text style={styles.error}>{error}</Text>}
      {status === 'idle' && <Text style={styles.text}>Preparing session…</Text>}
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
