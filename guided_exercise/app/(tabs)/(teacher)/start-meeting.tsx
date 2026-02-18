import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getZoomToken } from '@/src/api/zoom';

export default function StartMeeting() {
  const router = useRouter();
  const [sessionName, setSessionName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    const trimmedSession = sessionName.trim();
    const trimmedName = displayName.trim();

    if (!trimmedSession || !trimmedName) {
      setError('Please enter a session name and display name.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const token = await getZoomToken({
        sessionName: trimmedSession,
        userName: trimmedName
      });

      router.push({
        pathname: '/(tabs)/(teacher)/session',
        params: { sessionName: trimmedSession, userName: trimmedName, token }
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to start session.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <Text style={styles.title}>Start a Session</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Session Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. cancer-yoga-01"
          value={sessionName}
          onChangeText={setSessionName}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Display Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Coach Maya"
          value={displayName}
          onChangeText={setDisplayName}
        />
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={handleStart} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Start</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#C3F5FF',
    gap: 16
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    borderRadius: 16
  },
  backText: {
    fontSize: 14,
    fontWeight: '600'
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center'
  },
  inputGroup: {
    gap: 8
  },
  label: {
    fontSize: 14,
    fontWeight: '600'
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16
  },
  button: {
    backgroundColor: '#00C8B3',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  error: {
    color: '#B00020',
    textAlign: 'center'
  }
});
