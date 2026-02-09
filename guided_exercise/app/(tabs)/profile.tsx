import { useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { getZoomToken } from '@/src/api/zoom';

export default function Profile() {
  const [status, setStatus] = useState<string>('');

  const handleTestToken = async () => {
    try {
      setStatus('Requesting token...');
      const token = await getZoomToken({ sessionName: 'test-session', userName: 'teacher' });
      console.log('Zoom token:', token);
      setStatus('Token received. Check console output.');
    } catch (err: any) {
      console.error('Token request failed:', err);
      setStatus(err?.message || 'Token request failed.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile (Temp Test)</Text>
      <Button title="Test Zoom Token" onPress={handleTestToken} />
      {!!status && <Text style={styles.status}>{status}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12
  },
  title: {
    fontSize: 18,
    fontWeight: '600'
  },
  status: {
    marginTop: 8
  }
});
