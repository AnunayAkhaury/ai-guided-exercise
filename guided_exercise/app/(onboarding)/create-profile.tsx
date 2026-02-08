import { Text, TextInput, StyleSheet, View, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { createProfile } from '@/src/api/Firebase/firebase-auth';
import { getAuth } from 'firebase/auth';

export default function CreateProfile() {
  const { role } = useLocalSearchParams<{ role: string }>();
  const [username, setUsername] = useState<string>('');
  const [fullname, setFullname] = useState<string>('');

  const user = getAuth().currentUser;
  const uid = user?.uid;

  if (!uid) {
    router.replace('/login');
  }

  const handleCreateProfile = async () => {
    await createProfile(uid!, role, username, fullname);
    router.replace('/(tabs)/classes');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Your Profile</Text>
      <View style={styles.inputContainer}>
        <Text>Username</Text>
        <TextInput style={styles.input} onChangeText={(username) => setUsername(username)} value={username} />
      </View>
      <View style={styles.inputContainer}>
        <Text>Full Name</Text>
        <TextInput style={styles.input} onChangeText={(fullname) => setFullname(fullname)} value={fullname} />
      </View>

      <Pressable style={styles.button} onPress={async () => await handleCreateProfile()}>
        <Text style={styles.buttonText}>Submit</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 15,
    backgroundColor: '#C3F5FF'
  },
  title: {
    fontSize: 30,
    marginBottom: 12
  },
  inputContainer: {
    width: '70%',
    alignItems: 'flex-start'
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 5,
    height: 30,
    width: '100%',
    color: 'black'
  },
  button: {
    marginTop: 15,
    backgroundColor: '#00C8B3',
    paddingHorizontal: 30,
    paddingVertical: 5,
    borderRadius: 6
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  linkText: {
    textDecorationLine: 'underline',
    color: 'blue'
  }
});
