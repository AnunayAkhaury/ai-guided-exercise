import { Text, TextInput, Button, StyleSheet, View, Pressable } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { login } from '@/src/api/Firebase/firebase-auth';

export default function Login() {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  const handleLogin = async () => {
    try {
      await login(email, password);
      router.replace('/(tabs)/classes');
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>
      <View style={styles.inputContainer}>
        <Text>Email</Text>
        <TextInput
          secureTextEntry={true}
          style={styles.input}
          onChangeText={(email) => setEmail(email)}
          value={email}
        />
      </View>
      <View style={styles.inputContainer}>
        <Text>Password</Text>
        <TextInput
          secureTextEntry={true}
          style={styles.input}
          onChangeText={(password) => setPassword(password)}
          value={password}
        />
      </View>
      <Pressable style={styles.button} onPress={async () => await handleLogin()}>
        <Text style={styles.buttonText}>Submit</Text>
      </Pressable>
      <Link href="/signup" push>
        <Text style={styles.linkText}>Signup Instead</Text>
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
