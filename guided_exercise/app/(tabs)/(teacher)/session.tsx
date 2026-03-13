import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import IvsCall from '@/src/components/IvsCall';
import { endIvsSession, listIvsSessionParticipants } from '@/src/api/ivs';
import { useCallStore } from '@/src/store/callStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SessionParams = {
  token?: string;
  sessionName?: string;
  userName?: string;
  sessionCode?: string;
  sessionId?: string;
};

export default function TeacherSessionScreen() {
  const router = useRouter();
  const setInCall = useCallStore((state) => state.setInCall);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isSmallPhone = width < 380;
  const { token, sessionName, userName, sessionCode, sessionId } = useLocalSearchParams<SessionParams>();
  const [ending, setEnding] = useState(false);
  const [isInStage, setIsInStage] = useState(false);
  const [participantNameById, setParticipantNameById] = useState<Record<string, string>>({});
  const normalizedSessionId = Array.isArray(sessionId) ? sessionId[0] : sessionId;
  const normalizedSessionName = Array.isArray(sessionName) ? sessionName[0] : sessionName;
  const normalizedUserName = Array.isArray(userName) ? userName[0] : userName;
  const normalizedSessionCode = Array.isArray(sessionCode) ? sessionCode[0] : sessionCode;
  const normalizedToken = Array.isArray(token) ? token[0] : token;
  const normalizedLocalLabel = useMemo(() => normalizedUserName || 'Instructor', [normalizedUserName]);

  useEffect(() => {
    setInCall(true);
    return () => setInCall(false);
  }, [setInCall]);

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
        setParticipantNameById(nextMap);
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

  if (!normalizedToken) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Unable to join session</Text>
        <Text style={styles.subText}>Missing IVS token. Please start the session again.</Text>
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
      {isInStage && (
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerCard}>
            <View style={styles.headerTopRow}>
              <Text numberOfLines={1} style={[styles.title, isSmallPhone && styles.titleCompact]}>
                {normalizedSessionName || 'Live Session'}
              </Text>
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>Live</Text>
              </View>
            </View>
            <Text style={styles.subText}>{normalizedUserName ? `Coach: ${normalizedUserName}` : 'Instructor view'}</Text>
            {!!normalizedSessionCode && (
              <View style={styles.codePill}>
                <Text style={styles.codePillLabel}>Session Code</Text>
                <Text style={styles.codePillValue}>{normalizedSessionCode}</Text>
              </View>
            )}
          </View>
          <Pressable onPress={handleEndSession} style={styles.endButton} disabled={ending}>
            <Text style={styles.endButtonText}>{ending ? 'Ending...' : 'End Session'}</Text>
          </Pressable>
        </View>
      )}
      <IvsCall
        token={normalizedToken}
        publishOnJoin
        onLeave={() => {
          setInCall(false);
          router.back();
        }}
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
    paddingBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12
  },
  headerCard: {
    flex: 1
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2F2856',
    flexShrink: 1
  },
  titleCompact: {
    fontSize: 18
  },
  liveBadge: {
    backgroundColor: '#E6E2FF',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4
  },
  liveBadgeText: {
    color: '#6155F5',
    fontWeight: '700',
    fontSize: 12
  },
  subText: {
    marginTop: 4,
    color: '#4E4680'
  },
  codePill: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#ECE9FF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  codePillLabel: {
    color: '#5E5797',
    fontSize: 11,
    fontWeight: '600'
  },
  codePillValue: {
    color: '#3B3269',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 1
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
  },
  endButton: {
    backgroundColor: '#A980FE',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 13
  },
  endButtonText: {
    color: '#fff',
    fontWeight: '600'
  }
});
