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

  const handleEndSession = async () => {
    if (!sessionId) {
      Alert.alert('Missing session', 'No session id was provided for ending this class.');
      return;
    }
    try {
      setEnding(true);
      await endIvsSession(sessionId);
      router.replace('/(tabs)/(teacher)/classes');
    } catch (err: any) {
      Alert.alert('Failed to end session', err?.message || 'Please try again.');
    } finally {
      setEnding(false);
    }
  };

  if (!token) {
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
      <View style={styles.header}>
        <Text style={styles.title}>{sessionName || 'Live Session'}</Text>
        <Text style={styles.subText}>{userName ? `Coach: ${userName}` : 'Instructor view'}</Text>
        {!!sessionCode && <Text style={styles.subText}>Code: {sessionCode}</Text>}
        <Pressable onPress={handleEndSession} style={styles.endButton} disabled={ending}>
          <Text style={styles.endButtonText}>{ending ? 'Ending...' : 'End Session'}</Text>
        </Pressable>
      </View>
      <IvsCall token={token} publishOnJoin onLeave={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#C3F5FF'
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 8
  },
  title: {
    fontSize: 22,
    fontWeight: '700'
  },
  subText: {
    marginTop: 4,
    color: '#27434a'
  },
  backButton: {
    marginTop: 14,
    backgroundColor: '#00C8B3',
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
    marginTop: 10,
    backgroundColor: '#b00020',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: 'flex-start'
  },
  endButtonText: {
    color: '#fff',
    fontWeight: '600'
  }
});
