import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import IvsCall from '@/src/components/IvsCall';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getIvsSessionById, listIvsSessionParticipants } from '@/src/api/ivs';

type SessionParams = {
  token?: string;
  sessionName?: string;
  userName?: string;
  sessionCode?: string;
  sessionId?: string;
};

export default function StudentSessionScreen() {
  const router = useRouter();
  const { token, sessionName, userName, sessionCode, sessionId } = useLocalSearchParams<SessionParams>();
  const hasHandledEndedSession = useRef(false);
  const normalizedSessionId = Array.isArray(sessionId) ? sessionId[0] : sessionId;
  const normalizedSessionName = Array.isArray(sessionName) ? sessionName[0] : sessionName;
  const normalizedUserName = Array.isArray(userName) ? userName[0] : userName;
  const normalizedSessionCode = Array.isArray(sessionCode) ? sessionCode[0] : sessionCode;
  const normalizedToken = Array.isArray(token) ? token[0] : token;
  const [isInStage, setIsInStage] = useState(false);
  const [participantNameById, setParticipantNameById] = useState<Record<string, string>>({});
  const normalizedLocalLabel = useMemo(() => normalizedUserName || 'Student', [normalizedUserName]);

  useEffect(() => {
    if (!normalizedSessionId) return;
    let active = true;
    const checkSessionStatus = async () => {
      try {
        const session = await getIvsSessionById(normalizedSessionId);
        if (active && session.status === 'ended' && !hasHandledEndedSession.current) {
          hasHandledEndedSession.current = true;
          Alert.alert('Session ended', 'The instructor ended this session.');
          router.replace('/(tabs)/(student)/classes');
        }
      } catch (error) {
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
  }, [normalizedSessionId, router]);

  useEffect(() => {
    if (!normalizedSessionId) return;
    let active = true;

    const loadParticipants = async () => {
      try {
        const participants = await listIvsSessionParticipants(normalizedSessionId);
        if (!active) return;
        const nextMap = participants.reduce<Record<string, string>>((acc, participant) => {
          if (participant.participantId && participant.displayName) {
            acc[participant.participantId] = participant.displayName;
          }
          return acc;
        }, {});
        setParticipantNameById(nextMap);
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

  if (!normalizedToken) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Unable to join session</Text>
        <Text style={styles.subText}>Missing IVS token. Please join the session again.</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isInStage && (
        <View style={styles.header}>
          <Text style={styles.title}>{normalizedSessionName || 'Live Session'}</Text>
          <Text style={styles.subText}>{normalizedUserName ? `Participant: ${normalizedUserName}` : 'Student view'}</Text>
          {!!normalizedSessionCode && <Text style={styles.subText}>Code: {normalizedSessionCode}</Text>}
        </View>
      )}
      <IvsCall
        token={normalizedToken}
        publishOnJoin
        onLeave={() => router.back()}
        onInStageChange={setIsInStage}
        localParticipantLabel={normalizedLocalLabel}
        participantNamesById={participantNameById}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2FF'
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 8
  },
  title: {
    fontSize: 20,
    fontWeight: '700'
  },
  subText: {
    marginTop: 2,
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
