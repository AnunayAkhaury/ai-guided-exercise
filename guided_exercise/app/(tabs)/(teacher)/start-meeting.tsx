import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { createIvsSession, getIvsToken, startIvsSession, upsertIvsSessionParticipant } from '@/src/api/ivs';
import { useUserStore } from '@/src/store/userStore';

export default function StartMeeting() {
  const router = useRouter();
  const { sessionName: paramSessionName, sessionId: paramSessionId, coachName: paramCoachName } = useLocalSearchParams<{
    sessionName?: string;
    sessionId?: string;
    coachName?: string;
  }>();
  const username = useUserStore((state) => state.username);
  const fullname = useUserStore((state) => state.fullname);
  const fallbackDisplayName = useMemo(
    () => username?.trim() || fullname?.trim() || 'Instructor Test',
    [fullname, username]
  );
  const normalizedParamSessionName = Array.isArray(paramSessionName) ? paramSessionName[0] : paramSessionName;
  const normalizedParamCoachName = Array.isArray(paramCoachName) ? paramCoachName[0] : paramCoachName;
  const [sessionName, setSessionName] = useState(normalizedParamSessionName || '');
  const [displayName, setDisplayName] = useState(normalizedParamCoachName || fallbackDisplayName);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const normalizedSessionId = Array.isArray(paramSessionId) ? paramSessionId[0] : paramSessionId;

  useEffect(() => {
    if (normalizedParamSessionName) {
      setSessionName(normalizedParamSessionName);
    }
    if (normalizedParamCoachName) {
      setDisplayName(normalizedParamCoachName);
      return;
    }
    if (!normalizedSessionId) {
      setDisplayName(fallbackDisplayName);
    }
  }, [fallbackDisplayName, normalizedParamCoachName, normalizedParamSessionName, normalizedSessionId]);

  const handleStart = async () => {
    const trimmedSession = sessionName.trim();
    const trimmedName = displayName.trim() || fallbackDisplayName;

    if (!trimmedSession || !trimmedName) {
      setError('Please enter a session name and display name.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const liveSession = normalizedSessionId
        ? await startIvsSession(normalizedSessionId)
        : await (async () => {
            const createdSession = await createIvsSession({
              sessionName: trimmedSession,
              instructorUid: trimmedName,
              coachName: trimmedName
            });
            return startIvsSession(createdSession.sessionId);
          })();

      const tokenResult = await getIvsToken({
        stageArn: liveSession.stageArn,
        userId: trimmedName,
        userName: trimmedName,
        publish: true,
        subscribe: true,
        durationMinutes: 60,
        attributes: {
          role: 'instructor',
          sessionId: liveSession.sessionId,
          sessionCode: liveSession.sessionCode
        }
      });
      await upsertIvsSessionParticipant({
        sessionId: liveSession.sessionId,
        participantId: tokenResult.participantId,
        displayName: trimmedName,
        role: 'instructor'
      });

      router.push({
        pathname: '/(tabs)/(teacher)/session',
        params: {
          sessionName: liveSession.sessionName,
          userName: trimmedName,
          sessionCode: liveSession.sessionCode,
          sessionId: liveSession.sessionId,
          token: tokenResult.token
        }
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to start session.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.backButton} onPress={() => router.replace('/(tabs)/(teacher)/classes')}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <Text style={styles.title}>Start a Session</Text>
      {!!normalizedSessionId && <Text style={styles.subtitle}>Launching scheduled class</Text>}

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Session Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Tuesday Rehab Mobility"
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
    backgroundColor: '#F5F2FF',
    gap: 16
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#6155F5',
    borderRadius: 16
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff'
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    color: '#302E47'
  },
  subtitle: {
    textAlign: 'center',
    color: '#5F5893',
    marginTop: -8,
    marginBottom: 2
  },
  inputGroup: {
    gap: 8
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4E4680'
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#D8D5FF',
    color: '#1D1C2B'
  },
  button: {
    backgroundColor: '#6155F5',
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
    color: '#7A3FF2',
    textAlign: 'center'
  }
});
