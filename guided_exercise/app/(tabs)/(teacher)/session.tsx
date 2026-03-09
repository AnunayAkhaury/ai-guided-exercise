import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import IvsCall from '@/src/components/IvsCall';
import { endIvsSession } from '@/src/api/ivs';

type SessionParams = {
  token?: string;
  sessionName?: string;
  userName?: string;
  sessionCode?: string;
  sessionId?: string;
};

export default function TeacherSessionScreen() {
  const router = useRouter();
  const { token, sessionName, userName, sessionCode, sessionId } = useLocalSearchParams<SessionParams>();
  const [ending, setEnding] = useState(false);
  const [isInStage, setIsInStage] = useState(false);
  const normalizedSessionId = Array.isArray(sessionId) ? sessionId[0] : sessionId;
  const normalizedSessionName = Array.isArray(sessionName) ? sessionName[0] : sessionName;
  const normalizedUserName = Array.isArray(userName) ? userName[0] : userName;
  const normalizedSessionCode = Array.isArray(sessionCode) ? sessionCode[0] : sessionCode;
  const normalizedToken = Array.isArray(token) ? token[0] : token;

  const handleEndSession = async () => {
    if (!normalizedSessionId) {
      Alert.alert('Missing session', 'No session id was provided for ending this class.');
      return;
    }
    try {
      setEnding(true);
      await endIvsSession(normalizedSessionId);
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
          <View style={styles.headerTextBlock}>
            <Text style={styles.title}>{normalizedSessionName || 'Live Session'}</Text>
            <Text style={styles.subText}>{normalizedUserName ? `Coach: ${normalizedUserName}` : 'Instructor view'}</Text>
            {!!normalizedSessionCode && <Text style={styles.subText}>Code: {normalizedSessionCode}</Text>}
          </View>
          <Pressable onPress={handleEndSession} style={styles.endButton} disabled={ending}>
            <Text style={styles.endButtonText}>{ending ? 'Ending...' : 'End Session'}</Text>
          </Pressable>
        </View>
      )}
      <IvsCall token={normalizedToken} publishOnJoin onLeave={() => router.back()} onInStageChange={setIsInStage} />
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
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12
  },
  headerTextBlock: {
    flex: 1
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
  },
  endButton: {
    backgroundColor: '#A980FE',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12
  },
  endButtonText: {
    color: '#fff',
    fontWeight: '600'
  }
});
