import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function Instructors() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Instructors</Text>
      <Link href="/(teacher)/start-meeting" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Start Teacher Session</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#C3F5FF'
  },
  title: {
    fontSize: 20,
    fontWeight: '600'
  },
  button: {
    backgroundColor: '#00C8B3',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600'
  }
});
