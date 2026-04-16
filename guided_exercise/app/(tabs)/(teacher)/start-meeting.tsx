import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  cacheIvsToken,
  createIvsSession,
  getIvsToken,
  getReusableIvsToken,
  sendIvsTelemetry,
  startIvsSession,
  upsertIvsSessionParticipant
} from '@/src/api/ivs';
import { useUserStore } from '@/src/store/userStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolvePreferredDisplayName } from '@/src/utils/display-name';

export default function StartMeeting() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isSmallPhone = width < 380 || height < 760;
  const { sessionName: paramSessionName, sessionId: paramSessionId } = useLocalSearchParams<{
    sessionName?: string;
    sessionId?: string;
  }>();
  const username = useUserStore((state) => state.username);
  const fullname = useUserStore((state) => state.fullname);
  const uid = useUserStore((state) => state.uid);
  const role = useUserStore((state) => state.role);
  const instructorDisplayName = useMemo(
    () =>
      resolvePreferredDisplayName({
        fullname,
        username,
        fallback: 'Instructor'
      }),
    [fullname, username]
  );
  const normalizedParamSessionName = Array.isArray(paramSessionName) ? paramSessionName[0] : paramSessionName;
  const [sessionName, setSessionName] = useState(normalizedParamSessionName || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const normalizedSessionId = Array.isArray(paramSessionId) ? paramSessionId[0] : paramSessionId;

  useEffect(() => {
    if (normalizedParamSessionName) {
      setSessionName(normalizedParamSessionName);
    }
  }, [normalizedParamSessionName]);

  useEffect(() => {
    if (!role) return;
    if (role !== 'instructor') {
      router.replace(role === 'student' ? '/(tabs)/(student)/classes' : '/(tabs)/profile');
    }
  }, [role, router]);

  const handleStart = async () => {
    const trimmedSession = sessionName.trim();
    const trimmedName = instructorDisplayName;
    const effectiveUid = uid?.trim();

    if (!trimmedSession || !trimmedName || !effectiveUid) {
      setError('Missing required profile data. Please re-login and try again.');
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
              instructorUid: effectiveUid,
              coachName: trimmedName
            });
            return startIvsSession(createdSession.sessionId);
          })();

      const cached = getReusableIvsToken({
        sessionId: liveSession.sessionId,
        stageArn: liveSession.stageArn,
        userId: effectiveUid,
        role: 'instructor'
      });
      if (cached) {
        void sendIvsTelemetry({
          eventName: 'token_reused',
          sessionId: liveSession.sessionId,
          stageArn: liveSession.stageArn,
          userId: effectiveUid,
          role: 'instructor',
          participantId: cached.participantId
        });
      }
      const tokenResult =
        cached ??
        (await getIvsToken({
          stageArn: liveSession.stageArn,
          userId: effectiveUid,
          userName: trimmedName,
          publish: true,
          subscribe: true,
          durationMinutes: 60,
          attributes: {
            displayName: trimmedName,
            userId: effectiveUid,
            role: 'instructor',
            sessionId: liveSession.sessionId,
            sessionCode: liveSession.sessionCode
          }
        }));
      cacheIvsToken(
        {
          sessionId: liveSession.sessionId,
          stageArn: liveSession.stageArn,
          userId: effectiveUid,
          role: 'instructor'
        },
        tokenResult
      );
      await upsertIvsSessionParticipant({
        sessionId: liveSession.sessionId,
        participantId: tokenResult.participantId,
        userId: effectiveUid,
        displayName: trimmedName,
        role: 'instructor'
      });

      router.push({
        pathname: '/(tabs)/session' as any,
        params: {
          sessionName: liveSession.sessionName,
          userName: trimmedName,
          sessionCode: liveSession.sessionCode,
          sessionId: liveSession.sessionId,
          stageArn: liveSession.stageArn,
          participantId: tokenResult.participantId,
          role: 'instructor',
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <Pressable
        style={[styles.backButton, { top: insets.top + 10, left: isSmallPhone ? 14 : 20 }]}
        onPress={() => router.replace('/(tabs)/(teacher)/classes')}
      >
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: isSmallPhone ? 16 : 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, isSmallPhone && styles.titleCompact]}>Start a Session</Text>
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
          <Text style={styles.label}>Coach Name</Text>
          <View style={styles.readOnlyInput}>
            <Text style={styles.readOnlyText}>{instructorDisplayName}</Text>
          </View>
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={styles.button} onPress={handleStart} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Start</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2FF'
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 16
  },
  backButton: {
    position: 'absolute',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#6155F5',
    borderRadius: 16,
    zIndex: 10
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
  titleCompact: {
    fontSize: 24
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
  readOnlyInput: {
    backgroundColor: '#F0EEFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#D8D5FF'
  },
  readOnlyText: {
    fontSize: 16,
    color: '#3C366B',
    fontWeight: '600'
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
