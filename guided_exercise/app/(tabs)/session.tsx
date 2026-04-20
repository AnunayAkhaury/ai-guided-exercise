import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import IvsCall from '@/src/components/IvsCall';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  cacheIvsToken,
  endIvsSession,
  getIvsToken,
  markIvsSessionParticipantLeft,
  sendIvsTelemetry,
  upsertIvsSessionParticipant
} from '@/src/api/ivs';
import { useFirestoreSession, useFirestoreSessionParticipants } from '@/src/hooks/use-ivs-firestore';
import { useCallStore } from '@/src/store/callStore';
import { useUserStore } from '@/src/store/userStore';

type SessionParams = {
  token?: string;
  sessionName?: string;
  userName?: string;
  sessionCode?: string;
  sessionId?: string;
  stageArn?: string;
  participantId?: string;
  role?: 'student' | 'instructor';
};

function normalizeRole(value: unknown): 'student' | 'instructor' {
  return value === 'instructor' ? 'instructor' : 'student';
}

export default function SharedSessionScreen() {
  const router = useRouter();
  const setInCall = useCallStore((state) => state.setInCall);
  const storeRole = useUserStore((state) => state.role);
  const uid = useUserStore((state) => state.uid);
  const {
    token,
    sessionName,
    userName,
    sessionCode,
    sessionId,
    stageArn,
    participantId,
    role
  } = useLocalSearchParams<SessionParams>();

  const normalizedRole = useMemo(
    () => normalizeRole((Array.isArray(role) ? role[0] : role) ?? storeRole),
    [role, storeRole]
  );

  const hasHandledEndedSession = useRef(false);
  const [ending, setEnding] = useState(false);
  const normalizedSessionId = Array.isArray(sessionId) ? sessionId[0] : sessionId;
  const normalizedSessionName = Array.isArray(sessionName) ? sessionName[0] : sessionName;
  const normalizedUserName = Array.isArray(userName) ? userName[0] : userName;
  const normalizedSessionCode = Array.isArray(sessionCode) ? sessionCode[0] : sessionCode;
  const normalizedToken = Array.isArray(token) ? token[0] : token;
  const normalizedStageArn = Array.isArray(stageArn) ? stageArn[0] : stageArn;
  const normalizedParticipantId = Array.isArray(participantId) ? participantId[0] : participantId;
  const [currentParticipantId, setCurrentParticipantId] = useState<string | undefined>(normalizedParticipantId);
  const normalizedLocalLabel = useMemo(
    () => normalizedUserName || (normalizedRole === 'instructor' ? 'Instructor' : 'Student'),
    [normalizedRole, normalizedUserName]
  );
  const classesRoute = normalizedRole === 'instructor' ? '/(tabs)/(teacher)/classes' : '/(tabs)/(student)/classes';
  const { data: session, loading: sessionLoading, error: sessionError } = useFirestoreSession(normalizedSessionId, Boolean(normalizedSessionId));
  const { data: participants, error: participantsError } = useFirestoreSessionParticipants(normalizedSessionId, Boolean(normalizedSessionId));
  const participantNameById = useMemo(
    () =>
      participants.reduce<Record<string, string>>((acc, participant) => {
        if (participant.displayName && participant.participantId) {
          acc[participant.participantId] = participant.displayName;
        }
        return acc;
      }, {}),
    [participants]
  );
  const participantRoleById = useMemo(
    () =>
      participants.reduce<Record<string, string>>((acc, participant) => {
        if (participant.role && participant.participantId) {
          acc[participant.participantId] = participant.role;
        }
        return acc;
      }, {}),
    [participants]
  );

  useEffect(() => {
    setCurrentParticipantId(normalizedParticipantId);
  }, [normalizedParticipantId]);

  useEffect(() => {
    setInCall(true);
    return () => setInCall(false);
  }, [setInCall]);

  useEffect(() => {
    if (!normalizedSessionId || sessionLoading || sessionError || hasHandledEndedSession.current) return;
    if (!session || session.status === 'ended') {
      hasHandledEndedSession.current = true;
      Alert.alert('Session ended', 'This session has ended.');
      setInCall(false);
      router.replace(classesRoute as any);
    }
  }, [classesRoute, normalizedSessionId, router, session, sessionError, sessionLoading, setInCall]);

  useEffect(() => {
    if (sessionError) {
      console.log('[SharedSession] Firestore session listener error', sessionError);
    }
  }, [sessionError]);

  useEffect(() => {
    if (participantsError) {
      console.log('[SharedSession] Firestore participants listener error', participantsError);
    }
  }, [participantsError]);

  const handleEndSession = async () => {
    if (!normalizedSessionId) {
      Alert.alert('Missing session', 'No session id was provided for ending this class.');
      return;
    }
    try {
      setEnding(true);
      await endIvsSession(normalizedSessionId);
      setInCall(false);
      router.replace(classesRoute as any);
    } catch (err: any) {
      Alert.alert('Failed to end session', err?.message || 'Please try again.');
    } finally {
      setEnding(false);
    }
  };

  const handleInfoPress = () => {
    Alert.alert(
      'Session Info',
      `Session: ${normalizedSessionName || 'Live Session'}\n${normalizedRole === 'instructor' ? 'Coach' : 'You'}: ${
        normalizedUserName || (normalizedRole === 'instructor' ? 'Instructor' : 'Student')
      }\nCode: ${normalizedSessionCode || 'N/A'}`
    );
  };

  if (!normalizedToken) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Unable to join session</Text>
        <Text style={styles.subText}>Missing IVS token. Please join the session again.</Text>
        <Pressable
          onPress={() => {
            setInCall(false);
            router.replace(classesRoute as any);
          }}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <IvsCall
        token={normalizedToken}
        publishOnJoin
        onLeave={async () => {
          if (normalizedSessionId && currentParticipantId) {
            try {
              await markIvsSessionParticipantLeft({
                sessionId: normalizedSessionId,
                participantId: currentParticipantId
              });
              await sendIvsTelemetry({
                eventName: 'participant_left_marked',
                sessionId: normalizedSessionId,
                stageArn: normalizedStageArn,
                userId: uid?.trim() || undefined,
                role: normalizedRole,
                participantId: currentParticipantId
              });
            } catch (error) {
              console.log('[SharedSession] participant leave error', error);
              await sendIvsTelemetry({
                eventName: 'participant_left_mark_failed',
                sessionId: normalizedSessionId,
                stageArn: normalizedStageArn,
                userId: uid?.trim() || undefined,
                role: normalizedRole,
                participantId: currentParticipantId,
                details: {
                  message: String((error as any)?.message || 'unknown')
                }
              });
            }
          }
          setInCall(false);
          router.replace(classesRoute as any);
        }}
        onJoinAttempt={async () => {
          await sendIvsTelemetry({
            eventName: 'join_attempt',
            sessionId: normalizedSessionId,
            stageArn: normalizedStageArn,
            userId: uid?.trim() || undefined,
            role: normalizedRole,
            participantId: currentParticipantId
          });
        }}
        onJoinFailed={async (message) => {
          await sendIvsTelemetry({
            eventName: 'join_failed',
            sessionId: normalizedSessionId,
            stageArn: normalizedStageArn,
            userId: uid?.trim() || undefined,
            role: normalizedRole,
            participantId: currentParticipantId,
            details: { message }
          });
        }}
        onRequestFreshToken={async () => {
          const effectiveUid = uid?.trim();
          if (!normalizedStageArn || !normalizedSessionId || !effectiveUid) {
            return null;
          }
          try {
            const refreshed = await getIvsToken({
              stageArn: normalizedStageArn,
              userId: effectiveUid,
              userName: normalizedLocalLabel,
              publish: true,
              subscribe: true,
              durationMinutes: 60,
              attributes: {
                displayName: normalizedLocalLabel,
                userId: effectiveUid,
                role: normalizedRole,
                sessionId: normalizedSessionId,
                sessionCode: normalizedSessionCode || ''
              }
            });
            cacheIvsToken(
              {
                stageArn: normalizedStageArn,
                sessionId: normalizedSessionId,
                userId: effectiveUid,
                role: normalizedRole
              },
              refreshed
            );
            await upsertIvsSessionParticipant({
              sessionId: normalizedSessionId,
              participantId: refreshed.participantId,
              userId: effectiveUid,
              displayName: normalizedLocalLabel,
              role: normalizedRole
            });
            setCurrentParticipantId(refreshed.participantId);
            await sendIvsTelemetry({
              eventName: 'token_refreshed',
              sessionId: normalizedSessionId,
              stageArn: normalizedStageArn,
              userId: effectiveUid,
              role: normalizedRole,
              participantId: refreshed.participantId
            });
            return refreshed;
          } catch (error) {
            await sendIvsTelemetry({
              eventName: 'token_refresh_failed',
              sessionId: normalizedSessionId,
              stageArn: normalizedStageArn,
              userId: effectiveUid,
              role: normalizedRole,
              participantId: currentParticipantId,
              details: {
                message: String((error as any)?.message || 'unknown')
              }
            });
            throw error;
          }
        }}
        onInfoPress={handleInfoPress}
        onEndSession={normalizedRole === 'instructor' ? handleEndSession : undefined}
        endSessionLabel={ending ? 'Ending...' : 'End Session'}
        endSessionDisabled={ending}
        localParticipantLabel={normalizedLocalLabel}
        participantNamesById={participantNameById}
        participantRolesById={participantRoleById}
        localParticipantRole={normalizedRole}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2FF'
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2F2856'
  },
  subText: {
    marginTop: 4,
    color: '#4E4680'
  },
  backButton: {
    marginTop: 14,
    backgroundColor: '#6155F5',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: 'flex-start'
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600'
  }
});
