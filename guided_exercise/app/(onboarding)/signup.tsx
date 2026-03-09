import { Text, TextInput, Button, StyleSheet, View, Pressable, Alert } from 'react-native';
import { Link, router } from 'expo-router';
import React, { useState } from 'react';
import { createAccount, createProfile } from '@/src/api/Firebase/firebase-auth';
import { auth } from '@/src/api/Firebase/firebase-config';
import { signInWithEmailAndPassword } from 'firebase/auth';

export default function Signup() {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [retypePassword, setRetypePassword] = useState<string>('');
  const [role, setRole] = useState<'student' | 'instructor'>('student');

  const handleSignUp = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password || !retypePassword) {
      Alert.alert('Missing info', 'Please enter email and password.');
      return;
    }
    if (password !== retypePassword) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }

    const emailPrefix = trimmedEmail.split('@')[0] || 'user';
    const normalizedName = emailPrefix.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 30) || 'user';
    const defaultFullName = role === 'instructor' ? 'New Instructor' : 'New Student';
    const routeByRole = () => {
      if (role === 'student') {
        router.replace('/(tabs)/(student)/classes');
      } else {
        router.replace('/(tabs)/(teacher)/classes');
      }
    };

    try {
      const uid = await createAccount(trimmedEmail, password);
      await createProfile(uid, role, normalizedName, defaultFullName);
      routeByRole();
    } catch (err: any) {
      const message = String(err?.message || '');
      if (message.includes('auth/email-already-in-use')) {
        try {
          const credential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
          await createProfile(credential.user.uid, role, normalizedName, defaultFullName);
          routeByRole();
          return;
        } catch {
          Alert.alert(
            'Email already exists',
            'An account with this email already exists. Use Login Instead, or confirm your password to restore access.'
          );
          return;
        }
      }
      Alert.alert('Signup failed', err?.message || 'Unable to create account.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>
      <View style={styles.roleRow}>
        <Pressable
          style={[styles.roleButton, role === 'student' && styles.roleButtonActive]}
          onPress={() => setRole('student')}
        >
          <Text style={[styles.roleButtonText, role === 'student' && styles.roleButtonTextActive]}>Student</Text>
        </Pressable>
        <Pressable
          style={[styles.roleButton, role === 'instructor' && styles.roleButtonActive]}
          onPress={() => setRole('instructor')}
        >
          <Text style={[styles.roleButtonText, role === 'instructor' && styles.roleButtonTextActive]}>Instructor</Text>
        </Pressable>
      </View>
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
  roleRow: {
    flexDirection: 'row',
    gap: 10
  },
  roleButton: {
    borderWidth: 1,
    borderColor: '#D8D5FF',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF'
  },
  roleButtonActive: {
    backgroundColor: '#6155F5',
    borderColor: '#6155F5'
  },
  roleButtonText: {
    color: '#6155F5',
    fontWeight: '600'
  },
  roleButtonTextActive: {
    color: '#FFFFFF'
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
