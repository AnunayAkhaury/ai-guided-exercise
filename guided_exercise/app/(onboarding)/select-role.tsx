// app/(onboarding)/index.tsx
import { View, Text, Button, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function Onboarding() {
  const router = useRouter();

  return (
    <View>
      <Text>Select Role</Text>

      <Button
        title="Student"
        onPress={() =>
          router.push({
            pathname: '/create-profile',
            params: { role: 'student' }
          })
        }
      />

      <Button
        title="Instructor"
        onPress={() =>
          router.push({
            pathname: '/create-profile',
            params: { role: 'instructor' }
          })
        }
      />
    </View>
  );
}
