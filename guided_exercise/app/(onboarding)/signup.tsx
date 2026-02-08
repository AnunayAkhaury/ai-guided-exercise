import { Text, TextInput, Button } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { createAccount } from '@/src/api/Firebase/firebase-auth';

export default function Signup() {
  const { role } = useLocalSearchParams<{ role: string }>();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [retypePassword, setRetypePassword] = useState<string>('');

  const handleSignUp = async () => {
    if (password === retypePassword) {
      await createAccount(email, password);
    } else {
      console.log('Passwords do not match');
    }
    router.replace('/select-role');
  };

  return (
    <>
      <TextInput placeholder="Email" onChangeText={(email) => setEmail(email)} value={email} />
      <TextInput placeholder="Password" onChangeText={(password) => setPassword(password)} value={password} />
      <TextInput
        placeholder="Retype Password"
        onChangeText={(retypePassword) => setRetypePassword(retypePassword)}
        value={retypePassword}
      />
      <Button
        title="Sign Up"
        onPress={async () => {
          await handleSignUp();
        }}
      />
      <Button title="Login Instead" onPress={() => router.replace('/login')} />
      <Button title="Skip Auth (For Development)" onPress={() => router.replace('/(tabs)/classes')} />
    </>
  );
}
