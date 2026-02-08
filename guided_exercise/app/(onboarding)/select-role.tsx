// app/(onboarding)/index.tsx
import { View, Text, Button, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

export default function Onboarding() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose Your Role</Text>

      <Pressable
        style={styles.button}
        onPress={() =>
          router.push({
            pathname: '/create-profile',
            params: { role: 'student' }
          })
        }>
        <Text style={styles.buttonText}>Student</Text>
      </Pressable>

      <Pressable
        style={styles.button}
        onPress={() =>
          router.push({
            pathname: '/create-profile',
            params: { role: 'instructor' }
          })
        }>
        <Text style={styles.buttonText}>Instructor</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#C3F5FF'
  },
  title: {
    fontSize: 25,
    marginBottom: 20
  },
  button: {
    marginTop: 15,
    backgroundColor: '#00C8B3',
    paddingHorizontal: 30,
    paddingVertical: 8,
    borderRadius: 6,
    width: '50%',
    alignItems: 'center'
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  }
});
