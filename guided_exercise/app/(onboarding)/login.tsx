import { Text, TextInput, StyleSheet, View, Pressable, Alert, ActivityIndicator } from 'react-native';
import { Link, router } from 'expo-router';
import React, { useState } from 'react';
import { login } from '@/src/api/Firebase/firebase-auth';
import { useUserStore } from '@/src/store/userStore';

export default function Login() {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      Alert.alert('Missing info', 'Please enter your email and password.');
      return;
    }
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      await login(trimmedEmail, password);
      const latestRole = useUserStore.getState().role;
      if (latestRole === 'student') {
        router.replace('/(tabs)/(student)/classes');
      } else {
        router.replace('/(tabs)/(teacher)/classes');
      }
    } catch (error) {
      console.error('Login failed:', error);
      Alert.alert('Login failed', 'Please check your email/password and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>
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
      <Pressable style={[styles.button, isSubmitting && styles.buttonDisabled]} onPress={handleLogin} disabled={isSubmitting}>
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log In</Text>}
      </Pressable>
      <Link href="/signup" push>
        <Text style={styles.linkText}>Signup Instead</Text>
      </Link>
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
    color: '#6155F5'
  }
});
