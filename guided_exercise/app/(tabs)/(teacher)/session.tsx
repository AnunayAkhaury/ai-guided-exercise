import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import IvsCall from '@/src/components/IvsCall';
import {
  endIvsSession,
  getIvsToken,
  listIvsSessionParticipants,
  markIvsSessionParticipantLeft,
  upsertIvsSessionParticipant,
  cacheIvsToken,
  sendIvsTelemetry
} from '@/src/api/ivs';
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
};

export default function TeacherSessionScreen() {
  const router = useRouter();
  const setInCall = useCallStore((state) => state.setInCall);
  const uid = useUserStore((state) => state.uid);
  const role = useUserStore((state) => state.role);
  const { token, sessionName, userName, sessionCode, sessionId, stageArn, participantId } = useLocalSearchParams<SessionParams>();
  const [ending, setEnding] = useState(false);
  const [participantNameById, setParticipantNameById] = useState<Record<string, string>>({});
  const [participantRoleById, setParticipantRoleById] = useState<Record<string, string>>({});
  const normalizedSessionId = Array.isArray(sessionId) ? sessionId[0] : sessionId;
  const normalizedSessionName = Array.isArray(sessionName) ? sessionName[0] : sessionName;
  const normalizedUserName = Array.isArray(userName) ? userName[0] : userName;
  const normalizedSessionCode = Array.isArray(sessionCode) ? sessionCode[0] : sessionCode;
  const normalizedToken = Array.isArray(token) ? token[0] : token;
  const normalizedStageArn = Array.isArray(stageArn) ? stageArn[0] : stageArn;
  const normalizedParticipantId = Array.isArray(participantId) ? participantId[0] : participantId;
  const [currentParticipantId, setCurrentParticipantId] = useState<string | undefined>(normalizedParticipantId);
  const normalizedLocalLabel = useMemo(() => normalizedUserName || 'Instructor', [normalizedUserName]);

  useEffect(() => {
    setCurrentParticipantId(normalizedParticipantId);
  }, [normalizedParticipantId]);

  useEffect(() => {
    setInCall(true);
    return () => setInCall(false);
  }, [setInCall]);

  useEffect(() => {
    if (!role) return;
    if (role !== 'instructor') {
      setInCall(false);
      router.replace(role === 'student' ? '/(tabs)/(student)/classes' : '/(tabs)/profile');
    }
  }, [role, router, setInCall]);

  useEffect(() => {
    if (!normalizedSessionId) return;
    let active = true;

    const loadParticipants = async () => {
      try {
        const participants = await listIvsSessionParticipants(normalizedSessionId);
        if (!active) return;
        const nextMap = participants.reduce<Record<string, string>>((acc, participant) => {
          if (participant.displayName) {
            if (participant.participantId) {
              acc[participant.participantId] = participant.displayName;
            }
          }
          return acc;
        }, {});
        const nextRoleMap = participants.reduce<Record<string, string>>((acc, participant) => {
          if (participant.role) {
            if (participant.participantId) {
              acc[participant.participantId] = participant.role;
            }
          }
          return acc;
        }, {});
        setParticipantNameById(nextMap);
        setParticipantRoleById(nextRoleMap);
      } catch (error) {
        console.log('[TeacherSession] participant list error', error);
      }
    };

    void loadParticipants();
    const interval = setInterval(() => {
      void loadParticipants();
    }, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [normalizedSessionId]);

  const handleEndSession = async () => {
    if (!normalizedSessionId) {
      Alert.alert('Missing session', 'No session id was provided for ending this class.');
      return;
    }
    try {
      setEnding(true);
      await endIvsSession(normalizedSessionId);
      setInCall(false);
      router.replace('/(tabs)/(teacher)/classes');
    } catch (err: any) {
      Alert.alert('Failed to end session', err?.message || 'Please try again.');
    } finally {
      setEnding(false);
    }
  };

  const handleInfoPress = () => {
    Alert.alert(
      'Session Info',
      `Session: ${normalizedSessionName || 'Live Session'}\nCoach: ${
        normalizedUserName || 'Instructor'
      }\nCode: ${normalizedSessionCode || 'N/A'}`
    );
  };

  if (!normalizedToken) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Unable to join session</Text>
        <Text style={styles.subText}>Missing IVS token. Please start the session again.</Text>
        <Pressable
          onPress={() => {
            setInCall(false);
            router.replace('/(tabs)/(teacher)/classes');
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
                role: 'instructor',
                participantId: currentParticipantId
              });
            } catch (error) {
              console.log('[TeacherSession] participant leave error', error);
              await sendIvsTelemetry({
                eventName: 'participant_left_mark_failed',
                sessionId: normalizedSessionId,
                stageArn: normalizedStageArn,
                userId: uid?.trim() || undefined,
                role: 'instructor',
                participantId: currentParticipantId,
                details: {
                  message: String((error as any)?.message || 'unknown')
                }
              });
            }
          }
          setInCall(false);
          router.replace('/(tabs)/(teacher)/classes');
        }}
        onJoinAttempt={async () => {
          await sendIvsTelemetry({
            eventName: 'join_attempt',
            sessionId: normalizedSessionId,
            stageArn: normalizedStageArn,
            userId: uid?.trim() || undefined,
            role: 'instructor',
            participantId: currentParticipantId
          });
        }}
        onJoinFailed={async (message) => {
          await sendIvsTelemetry({
            eventName: 'join_failed',
            sessionId: normalizedSessionId,
            stageArn: normalizedStageArn,
            userId: uid?.trim() || undefined,
            role: 'instructor',
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
                role: 'instructor',
                sessionId: normalizedSessionId,
                sessionCode: normalizedSessionCode || ''
              }
            });
            cacheIvsToken(
              {
                stageArn: normalizedStageArn,
                sessionId: normalizedSessionId,
                userId: effectiveUid,
                role: 'instructor'
              },
              refreshed
            );
            await upsertIvsSessionParticipant({
              sessionId: normalizedSessionId,
              participantId: refreshed.participantId,
              userId: effectiveUid,
              displayName: normalizedLocalLabel,
              role: 'instructor'
            });
            setCurrentParticipantId(refreshed.participantId);
            await sendIvsTelemetry({
              eventName: 'token_refreshed',
              sessionId: normalizedSessionId,
              stageArn: normalizedStageArn,
              userId: effectiveUid,
              role: 'instructor',
              participantId: refreshed.participantId
            });
            return refreshed;
          } catch (error) {
            await sendIvsTelemetry({
              eventName: 'token_refresh_failed',
              sessionId: normalizedSessionId,
              stageArn: normalizedStageArn,
              userId: effectiveUid,
              role: 'instructor',
              participantId: currentParticipantId,
              details: {
                message: String((error as any)?.message || 'unknown')
              }
            });
            throw error;
          }
        }}
        onInfoPress={handleInfoPress}
        onEndSession={handleEndSession}
        endSessionLabel={ending ? 'Ending...' : 'End Session'}
        endSessionDisabled={ending}
        localParticipantLabel={normalizedLocalLabel}
        participantNamesById={participantNameById}
        participantRolesById={participantRoleById}
        localParticipantRole="instructor"
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
