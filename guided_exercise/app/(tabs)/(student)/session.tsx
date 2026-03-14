import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import IvsCall from '@/src/components/IvsCall';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getIvsSessionById, listIvsSessionParticipants } from '@/src/api/ivs';
import { useCallStore } from '@/src/store/callStore';

type SessionParams = {
  token?: string;
  sessionName?: string;
  userName?: string;
  sessionCode?: string;
  sessionId?: string;
};

export default function StudentSessionScreen() {
  const router = useRouter();
  const setInCall = useCallStore((state) => state.setInCall);
  const { token, sessionName, userName, sessionCode, sessionId } = useLocalSearchParams<SessionParams>();
  const hasHandledEndedSession = useRef(false);
  const normalizedSessionId = Array.isArray(sessionId) ? sessionId[0] : sessionId;
  const normalizedSessionName = Array.isArray(sessionName) ? sessionName[0] : sessionName;
  const normalizedUserName = Array.isArray(userName) ? userName[0] : userName;
  const normalizedSessionCode = Array.isArray(sessionCode) ? sessionCode[0] : sessionCode;
  const normalizedToken = Array.isArray(token) ? token[0] : token;
  const [participantNameById, setParticipantNameById] = useState<Record<string, string>>({});
  const [participantRoleById, setParticipantRoleById] = useState<Record<string, string>>({});
  const normalizedLocalLabel = useMemo(() => normalizedUserName || 'Student', [normalizedUserName]);

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
            if (participant.userId) {
              acc[participant.userId] = participant.displayName;
            }
          }
          return acc;
        }, {});
        const nextRoleMap = participants.reduce<Record<string, string>>((acc, participant) => {
          if (participant.role) {
            if (participant.participantId) {
              acc[participant.participantId] = participant.role;
            }
            if (participant.userId) {
              acc[participant.userId] = participant.role;
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
        onLeave={() => {
          setInCall(false);
          router.back();
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
