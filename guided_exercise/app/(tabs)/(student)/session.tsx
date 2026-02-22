import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

export default function Session() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.placeholderTitle}>Video session temporarily unavailable</Text>
      <Text style={styles.placeholderText}>
        IVS real-time integration will be added next.
      </Text>
      <Text style={styles.backLink} onPress={() => router.back()}>
        Go back
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#C3F5FF'
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12
  },
  placeholderText: {
    fontSize: 14,
    textAlign: 'center',
    color: '#333',
    marginBottom: 16
  },
  backLink: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0b5a6a'
  }
});
