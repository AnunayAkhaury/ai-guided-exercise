import {
  Text,
  TextInput,
  StyleSheet,
  View,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { Link, router } from 'expo-router';
import React, { useState } from 'react';
import { createAccount, createProfile } from '@/src/api/Firebase/firebase-auth';
import { auth } from '@/src/api/Firebase/firebase-config';
import { signInWithEmailAndPassword } from 'firebase/auth';

const INSTRUCTOR_SIGNUP_CODE = 'UCDavis123';

export default function Signup() {
  const [email, setEmail] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [retypePassword, setRetypePassword] = useState<string>('');
  const [role, setRole] = useState<'student' | 'instructor'>('student');
  const [instructorCode, setInstructorCode] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignUp = async () => {
    const trimmedEmail = email.trim();
    const trimmedUsername = username.trim();
    const trimmedInstructorCode = instructorCode.trim();
    if (!trimmedEmail || !trimmedUsername || !password || !retypePassword) {
      Alert.alert('Missing info', 'Please enter email, username, and password.');
      return;
    }
    if (password !== retypePassword) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }
    if (role === 'instructor' && trimmedInstructorCode !== INSTRUCTOR_SIGNUP_CODE) {
      Alert.alert('Invalid instructor code', 'Please enter a valid instructor signup code.');
      return;
    }
    if (trimmedUsername.length < 3) {
      Alert.alert('Username too short', 'Username must be at least 3 characters.');
      return;
    }
    if (isSubmitting) return;

    const normalizedName = trimmedUsername.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 30);
    if (!normalizedName) {
      Alert.alert('Invalid username', 'Use letters, numbers, underscores, periods, or hyphens.');
      return;
    }
    const defaultFullName = role === 'instructor' ? 'New Instructor' : 'New Student';
    const routeByRole = () => {
      if (role === 'student') {
        router.replace('/(tabs)/(student)/classes');
      } else {
        router.replace('/(tabs)/(teacher)/classes');
      }
    };

    try {
      setIsSubmitting(true);
      const uid = await createAccount(trimmedEmail, password);
      await createProfile(uid, role, normalizedName, defaultFullName, trimmedEmail);
      routeByRole();
    } catch (err: any) {
      const message = String(err?.message || '');
      if (message.includes('auth/email-already-in-use')) {
        try {
          const credential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
          await createProfile(credential.user.uid, role, normalizedName, defaultFullName, trimmedEmail);
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
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.formCard}>
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
            <Text style={styles.label}>Username</Text>
            <TextInput style={styles.input} onChangeText={(value) => setUsername(value)} value={username} />
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
          {role === 'instructor' && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Instructor Code</Text>
              <TextInput
                style={styles.input}
                onChangeText={(value) => setInstructorCode(value)}
                value={instructorCode}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}
          <Pressable
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={isSubmitting}
          >
            {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Account</Text>}
          </Pressable>
          <Link href="/login" push>
            <Text style={styles.linkText}>Login Instead</Text>
          </Link>
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
    width: '88%',
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
    color: '#302E47',
    fontWeight: '700',
    textAlign: 'center'
  },
  inputContainer: {
    width: '100%',
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
    marginTop: 8,
    backgroundColor: '#6155F5',
    paddingHorizontal: 34,
    paddingVertical: 11,
    borderRadius: 10,
    minWidth: 200,
    alignItems: 'center',
    shadowColor: '#2D2288',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 3
  },
  buttonDisabled: {
    opacity: 0.7
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  linkText: {
    textDecorationLine: 'underline',
    color: '#6155F5',
    textAlign: 'center'
  }
});
