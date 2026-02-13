import React, { useState } from 'react';
import { View, TextInput, Button, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function JoinSessionScreen() {
  const router = useRouter();
  const [sessionName, setSessionName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!sessionName || !displayName) {
        Alert.alert("Error", "Please fill in all fields");
        return;
    }

    setLoading(true);

    try {
      // Request token from zoom-controller.ts
      const response = await fetch('tempURLforAPI', { ///////////// /* REPLACE tempURLforAPI */ //////////////
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionName: sessionName.trim(),
          userName: displayName.trim(),
          role: 0, // Enforces "Join Only" so user is only participant
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to get token");

      // navigate to session screen
      router.push({
        pathname: '/(student)/session',
        params: {
            sessionName: sessionName.trim(),
            userName: displayName.trim(),
            token: data.token
        }
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to join session');
    }
  };

  // session join display screen
  return (
    <View style={styles.container}>
      <TextInput 
        placeholder="Session Name" 
        style={styles.input} 
        onChangeText={setSessionName} 
      />
      <TextInput 
        placeholder="Your Name" 
        style={styles.input} 
        onChangeText={setDisplayName} 
      />
      <Button title="Join" onPress={handleJoin} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  input: { borderBottomWidth: 1, marginBottom: 20, padding: 10 },
});