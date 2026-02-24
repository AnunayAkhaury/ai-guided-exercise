import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getIvsToken } from '@/src/api/ivs';

export default function StartMeeting() {
  const router = useRouter();
  // changed from sessionName to stageArn to match IVS logic
  const [stageArn, setStageArn] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    const trimmedArn = stageArn.trim();
    const trimmedName = displayName.trim();

    if (!trimmedArn || !trimmedName) {
      setError('Please enter a Stage ARN and display name.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      // fetch IVS token
      const token = await getIvsToken({
        stageArn: trimmedArn,
        userName: trimmedName,
        userId: `teacher-${Date.now()}` 
      });

      // redirect to live session
      router.push({
        pathname: '/(tabs)/(teacher)/session',
        params: { stageArn: trimmedArn, userName: trimmedName, token }
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

      {/* session view */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Stage ARN</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. arn:aws:ivs:us-west-2:..."
          value={stageArn}
          onChangeText={setStageArn}
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