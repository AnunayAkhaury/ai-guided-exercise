import React, { useState } from 'react';
import { View, TextInput, Button, Alert, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useZoom } from '@zoom/react-native-videosdk';
import { getZoomToken } from '@/src/api/zoom';

export default function JoinSessionScreen() {
  const { sessionName: paramSessionName } = useLocalSearchParams(); // Grab param
  const [sessionName, setSessionName] = useState((paramSessionName as string) || '');
  const [displayName, setDisplayName] = useState('');
  const zoom = useZoom();
  const router = useRouter();

  const handleJoin = async () => {
    try {
      const trimmedSession = sessionName.trim();
      const trimmedName = displayName.trim();
      if (!trimmedSession || !trimmedName) {
        Alert.alert('Missing info', 'Please enter a session name and your name.');
        return;
      }
      console.log('[StudentJoin] request start', {
        sessionName: trimmedSession,
        displayName: trimmedName
      });
      const token = await getZoomToken({
        sessionName: trimmedSession,
        userName: trimmedName,
        role: 0
      });
      console.log('[StudentJoin] token received', { length: token.length });

      router.push({
        pathname: '/(tabs)/(student)/session',
        params: { sessionName: trimmedSession, userName: trimmedName, token }
      });

    } catch (error: any) {
      console.log('[StudentJoin] join error', error);
      Alert.alert('Error', error.message || 'Failed to join session');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Session Name</Text>
      <TextInput 
        placeholder="Session Name"
        value={sessionName}
        style={styles.input} 
        onChangeText={setSessionName}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.label}>Your Name</Text>
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
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6
  },
  input: { borderBottomWidth: 1, marginBottom: 20, padding: 10 },
});
