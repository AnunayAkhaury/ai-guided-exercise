import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ZoomCall from '@/src/components/ZoomCall';

type SessionParams = {
  sessionName?: string;
  userName?: string;
  token?: string;
};

export default function Session() {
  const router = useRouter();
  const { sessionName, userName, token } = useLocalSearchParams<SessionParams>();

  return (
    <View style={styles.container}>
      <ZoomCall
        sessionName={sessionName ? String(sessionName) : undefined}
        userName={userName ? String(userName) : undefined}
        token={token ? String(token) : undefined}
        onLeave={() => router.back()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center'
  }
});
