import { Text, TextInput, Button, StyleSheet, View, Pressable } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
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
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} onChangeText={(email) => setEmail(email)} value={email} />
      </View>
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          secureTextEntry={true}
          style={styles.input}
          onChangeText={(password) => setPassword(password)}
          value={password}
        />
      </View>
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Retype Password</Text>
        <TextInput
          secureTextEntry={true}
          style={styles.input}
          onChangeText={(retypePassword) => setRetypePassword(retypePassword)}
          value={retypePassword}
        />
      </View>
      <Pressable style={styles.button} onPress={async () => await handleSignUp()}>
        <Text style={styles.buttonText}>Submit</Text>
      </Pressable>
      <Link href="/login" push>
        <Text style={styles.linkText}>Login Instead</Text>
      </Link>
      <Button title="Skip Auth (For Development)" onPress={() => router.replace('/(tabs)/classes')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 15,
    backgroundColor: '#F5F2FF'
  },
  title: {
    fontSize: 30,
    marginBottom: 12,
    color: '#302E47',
    fontWeight: '700'
  },
  inputContainer: {
    width: '70%',
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
    textAlignVertical: 'center',
    includeFontPadding: false,
    borderWidth: 1,
    borderColor: '#D8D5FF'
  },
  button: {
    marginTop: 15,
    backgroundColor: '#6155F5',
    paddingHorizontal: 30,
    paddingVertical: 8,
    borderRadius: 8
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  linkText: {
    textDecorationLine: 'underline',
    color: '#6155F5'
  }
});
