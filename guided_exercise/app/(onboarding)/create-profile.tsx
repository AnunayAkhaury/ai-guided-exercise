import { Text, TextInput, Button } from 'react-native';
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
    <>
      <TextInput placeholder="Username" onChangeText={(username) => setUsername(username)} value={username} />
      <TextInput placeholder="Full Name" onChangeText={(fullname) => setFullname(fullname)} value={fullname} />
      <Button
        title="Create"
        onPress={async () => {
          await handleCreateProfile();
        }}
      />
    </>
  );
}
