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
  ScrollView,
  useWindowDimensions
} from 'react-native';
import { Link, router } from 'expo-router';
import React, { useState } from 'react';
import { login } from '@/src/api/Firebase/firebase-auth';
import { useUserStore } from '@/src/store/userStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Login() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isSmallPhone = width < 380 || height < 760;
  const cardWidth = Math.min(440, width - (isSmallPhone ? 24 : 36));

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
    } catch (error: any) {
      console.error('Login failed:', error);
      Alert.alert('Login failed', error?.message || 'Please check your email/password and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + (isSmallPhone ? 8 : 14), paddingBottom: Math.max(insets.bottom + 16, 24) }
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.formCard, { width: cardWidth }]}>
          <Text style={[styles.title, isSmallPhone && styles.titleCompact]}>Login</Text>
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
          <Pressable
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isSubmitting}
          >
            {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log In</Text>}
          </Pressable>
          <Link href="/signup" push>
            <Text style={styles.linkText}>Signup Instead</Text>
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
  titleCompact: {
    fontSize: 26
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
