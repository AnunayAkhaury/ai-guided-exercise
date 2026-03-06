import React, { useState } from 'react';
import { View, TextInput, Button, Alert, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getIvsToken, joinIvsSessionByCode } from '@/src/api/ivs';

export default function JoinSessionScreen() {
  const { sessionCode: paramSessionCode } = useLocalSearchParams();
  const [sessionCode, setSessionCode] = useState((paramSessionCode as string) || '');
  const [displayName, setDisplayName] = useState('');
  const router = useRouter();

  const handleJoin = async () => {
    try {
      const trimmedCode = sessionCode.trim().toUpperCase();
      const trimmedName = displayName.trim();
      if (!trimmedCode || !trimmedName) {
        Alert.alert('Missing info', 'Please enter a session code and your name.');
        return;
      }

      console.log('[StudentJoin] request start', {
        sessionCode: trimmedCode,
        displayName: trimmedName
      });

      const joinedSession = await joinIvsSessionByCode(trimmedCode);

      const token = await getIvsToken({
        stageArn: joinedSession.stageArn,
        userId: trimmedName,
        userName: trimmedName,
        publish: true,
        subscribe: true,
        durationMinutes: 60,
        attributes: {
          role: 'student',
          sessionId: joinedSession.sessionId,
          sessionCode: joinedSession.sessionCode
        }
      });
      router.push({
        pathname: '/(tabs)/(student)/session',
        params: {
          sessionName: joinedSession.sessionName,
          sessionCode: joinedSession.sessionCode,
          sessionId: joinedSession.sessionId,
          userName: trimmedName,
          token
        }
      });

    } catch (error: any) {
      console.log('[StudentJoin] join error', error);
      Alert.alert('Error', error.message || 'Failed to join session');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Session Code</Text>
      <TextInput 
        placeholder="e.g. FYNHYH"
        value={sessionCode}
        style={styles.input} 
        onChangeText={setSessionCode}
        autoCapitalize="characters"
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
