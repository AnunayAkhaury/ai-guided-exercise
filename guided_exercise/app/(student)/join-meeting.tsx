import React, { useState } from 'react';
import { View, TextInput, Button, Alert, StyleSheet } from 'react-native';
import { useZoom } from '@zoom/react-native-videosdk';

export default function JoinSessionScreen() {
  const [sessionName, setSessionName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const zoom = useZoom();

  const handleJoin = async () => {
    try {
      // Request token from zoom-controller.ts
      const response = await fetch('tempURLforAPI', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionName: sessionName,
          userName: displayName,
          role: 0, // Enforces "Join Only" so user is only participant
        }),
      });

      const { token } = await response.json();

      // join session 
      await zoom.joinSession({
        sessionName: sessionName,
        userName: displayName,
        token: token,
        sessionPassword: '', // Add if your logic requires it
        audioOptions: { connect: true, mute: false },
        videoOptions: { localVideoOn: true },
        sessionIdleTimeoutMins: 40, 
      });

    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to join session');
    }
  };

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