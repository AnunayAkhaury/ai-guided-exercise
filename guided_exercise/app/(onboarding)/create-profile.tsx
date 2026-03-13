import {
  Text,
  TextInput,
  StyleSheet,
  View,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { createProfile } from '@/src/api/Firebase/firebase-auth';
import { auth } from '@/src/api/Firebase/firebase-config';

export default function CreateProfile() {
  const { role } = useLocalSearchParams<{ role: string }>();
  const [username, setUsername] = useState<string>('');
  const [fullname, setFullname] = useState<string>('');

  const user = auth.currentUser;
  const uid = user?.uid;
  const email = user?.email ?? undefined;

  if (!uid) {
    router.replace('/login');
  }

  const handleCreateProfile = async () => {
    await createProfile(uid!, role, username, fullname, email);
    if (role === 'student') {
      router.replace('/(tabs)/(student)/classes');
    } else {
      router.replace('/(tabs)/(teacher)/classes');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.formCard}>
          <Text style={styles.title}>Create Your Profile</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Username</Text>
            <TextInput style={styles.input} onChangeText={(username) => setUsername(username)} value={username} />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput style={styles.input} onChangeText={(fullname) => setFullname(fullname)} value={fullname} />
          </View>

          <Pressable style={styles.button} onPress={async () => await handleCreateProfile()}>
            <Text style={styles.buttonText}>Submit</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2FF'
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24
  },
  formCard: {
    width: '86%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 15,
    borderWidth: 1,
    borderColor: '#E3E1FF'
  },
  title: {
    fontSize: 30,
    marginBottom: 8,
    textAlign: 'center',
    color: '#302E47',
    fontWeight: '700'
  },
  inputContainer: {
    width: '100%',
    alignItems: 'flex-start'
  },
  label: {
    color: '#4E4680',
    fontWeight: '600'
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    height: 40,
    width: '100%',
    color: '#1D1C2B',
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#D8D5FF'
  },
  button: {
    marginTop: 8,
    backgroundColor: '#6155F5',
    paddingHorizontal: 30,
    paddingVertical: 11,
    borderRadius: 10,
    minWidth: 200,
    alignItems: 'center'
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600'
  }
});
