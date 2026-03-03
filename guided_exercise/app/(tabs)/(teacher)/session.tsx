import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import IvsCall from '@/src/components/IvsCall';

type SessionParams = {
  token?: string;
  sessionName?: string;
  userName?: string;
};

export default function TeacherSessionScreen() {
  const router = useRouter();
  const { token, sessionName, userName } = useLocalSearchParams<SessionParams>();

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
  }
});
