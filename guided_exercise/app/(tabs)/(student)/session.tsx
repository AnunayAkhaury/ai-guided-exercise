import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import IvsCall from '@/src/components/IvsCall';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  cacheIvsToken,
  getIvsSessionById,
  getIvsToken,
  listIvsSessionParticipants,
  markIvsSessionParticipantLeft,
  sendIvsTelemetry,
  upsertIvsSessionParticipant
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

export default function StudentSessionScreen() {
  const router = useRouter();
  const setInCall = useCallStore((state) => state.setInCall);
  const uid = useUserStore((state) => state.uid);
  const { token, sessionName, userName, sessionCode, sessionId, stageArn, participantId } = useLocalSearchParams<SessionParams>();
  const hasHandledEndedSession = useRef(false);
  const normalizedSessionId = Array.isArray(sessionId) ? sessionId[0] : sessionId;
  const normalizedSessionName = Array.isArray(sessionName) ? sessionName[0] : sessionName;
  const normalizedUserName = Array.isArray(userName) ? userName[0] : userName;
  const normalizedSessionCode = Array.isArray(sessionCode) ? sessionCode[0] : sessionCode;
  const normalizedToken = Array.isArray(token) ? token[0] : token;
  const normalizedStageArn = Array.isArray(stageArn) ? stageArn[0] : stageArn;
  const normalizedParticipantId = Array.isArray(participantId) ? participantId[0] : participantId;
  const [currentParticipantId, setCurrentParticipantId] = useState<string | undefined>(normalizedParticipantId);
  const [participantNameById, setParticipantNameById] = useState<Record<string, string>>({});
  const [participantRoleById, setParticipantRoleById] = useState<Record<string, string>>({});
  const normalizedLocalLabel = useMemo(() => normalizedUserName || 'Student', [normalizedUserName]);

  useEffect(() => {
    setCurrentParticipantId(normalizedParticipantId);
  }, [normalizedParticipantId]);

  useEffect(() => {
    setInCall(true);
    return () => setInCall(false);
  }, [setInCall]);

  useEffect(() => {
    if (!normalizedSessionId) return;
    let active = true;
    const checkSessionStatus = async () => {
      try {
        const session = await getIvsSessionById(normalizedSessionId);
        if (active && session.status === 'ended' && !hasHandledEndedSession.current) {
          hasHandledEndedSession.current = true;
          Alert.alert('Session ended', 'The instructor ended this session.');
          setInCall(false);
          router.replace('/(tabs)/(student)/classes');
        }
      } catch (error) {
        const message = String((error as any)?.message || '');
        if (active && !hasHandledEndedSession.current && (message.includes('Session not found') || message.includes('404'))) {
          hasHandledEndedSession.current = true;
          Alert.alert('Session ended', 'The instructor ended this session.');
          setInCall(false);
          router.replace('/(tabs)/(student)/classes');
          return;
        }
        console.log('[StudentSession] polling error', error);
      }
    };

    void checkSessionStatus();
    const interval = setInterval(() => {
      void checkSessionStatus();
    }, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [normalizedSessionId, router, setInCall]);

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
        console.log('[StudentSession] participant list error', error);
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

  const handleInfoPress = () => {
    Alert.alert(
      'Session Info',
      `Session: ${normalizedSessionName || 'Live Session'}\nYou: ${
        normalizedUserName || 'Student'
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
            router.back();
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
                role: 'student',
                participantId: currentParticipantId
              });
            } catch (error) {
              console.log('[StudentSession] participant leave error', error);
              await sendIvsTelemetry({
                eventName: 'participant_left_mark_failed',
                sessionId: normalizedSessionId,
                stageArn: normalizedStageArn,
                userId: uid?.trim() || undefined,
                role: 'student',
                participantId: currentParticipantId,
                details: {
                  message: String((error as any)?.message || 'unknown')
                }
              });
            }
          }
          setInCall(false);
          router.back();
        }}
        onJoinAttempt={async () => {
          await sendIvsTelemetry({
            eventName: 'join_attempt',
            sessionId: normalizedSessionId,
            stageArn: normalizedStageArn,
            userId: uid?.trim() || undefined,
            role: 'student',
            participantId: currentParticipantId
          });
        }}
        onJoinFailed={async (message) => {
          await sendIvsTelemetry({
            eventName: 'join_failed',
            sessionId: normalizedSessionId,
            stageArn: normalizedStageArn,
            userId: uid?.trim() || undefined,
            role: 'student',
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
                role: 'student',
                sessionId: normalizedSessionId,
                sessionCode: normalizedSessionCode || ''
              }
            });
            cacheIvsToken(
              {
                stageArn: normalizedStageArn,
                sessionId: normalizedSessionId,
                userId: effectiveUid,
                role: 'student'
              },
              refreshed
            );
            await upsertIvsSessionParticipant({
              sessionId: normalizedSessionId,
              participantId: refreshed.participantId,
              userId: effectiveUid,
              displayName: normalizedLocalLabel,
              role: 'student'
            });
            setCurrentParticipantId(refreshed.participantId);
            await sendIvsTelemetry({
              eventName: 'token_refreshed',
              sessionId: normalizedSessionId,
              stageArn: normalizedStageArn,
              userId: effectiveUid,
              role: 'student',
              participantId: refreshed.participantId
            });
            return refreshed;
          } catch (error) {
            await sendIvsTelemetry({
              eventName: 'token_refresh_failed',
              sessionId: normalizedSessionId,
              stageArn: normalizedStageArn,
              userId: effectiveUid,
              role: 'student',
              participantId: currentParticipantId,
              details: {
                message: String((error as any)?.message || 'unknown')
              }
            });
            throw error;
          }
        }}
        onInfoPress={handleInfoPress}
        localParticipantLabel={normalizedLocalLabel}
        participantNamesById={participantNameById}
        participantRolesById={participantRoleById}
        localParticipantRole="student"
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
