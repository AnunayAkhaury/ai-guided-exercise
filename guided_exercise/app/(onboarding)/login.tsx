import {
  Text,
  TextInput,
  StyleSheet,
  View,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions
} from 'react-native';
import { Link, router } from 'expo-router';
import React, { useState } from 'react';
import { getVerificationStatus, login, sendPasswordReset } from '@/src/api/Firebase/firebase-auth';
import { useUserStore } from '@/src/store/userStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '@/src/components/ui/ToastProvider';

export default function Login() {
  const { showToast } = useToast();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isSmallPhone = width < 380 || height < 760;
  const cardWidth = Math.min(440, width - (isSmallPhone ? 24 : 36));

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      showToast({ title: 'Missing info', message: 'Please enter your email and password.', variant: 'error' });
      return;
    }
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      await login(trimmedEmail, password);
      const uid = useUserStore.getState().uid;
      const verificationStatus = await getVerificationStatus(uid!);
      console.log('verificationStatus', verificationStatus);
      if (verificationStatus === false) {
        router.replace('/(onboarding)/pending-verification');
      }
      const latestRole = useUserStore.getState().role;
      if (latestRole === 'student') {
        router.replace('/(tabs)/(student)/classes');
      } else {
        router.replace('/(tabs)/(teacher)/classes');
      }
    } catch (error: any) {
      console.error('Login failed:', error);
      showToast({
        title: 'Login failed',
        message: error?.message || 'Please check your email/password and try again.',
        variant: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      showToast({
        title: 'Email required',
        message: 'Enter your email first so we know where to send the reset link.',
        variant: 'error'
      });
      return;
    }
    if (isResettingPassword) return;

    try {
      setIsResettingPassword(true);
      await sendPasswordReset(trimmedEmail);
      showToast({
        title: 'Reset email sent',
        message: 'Check your inbox for a link to reset your password.',
        variant: 'success',
        durationMs: 5200
      });
    } catch (error: any) {
      console.error('Password reset failed:', error);
      showToast({
        title: 'Reset failed',
        message: error?.message || 'Unable to send a password reset email.',
        variant: 'error'
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + (isSmallPhone ? 8 : 14), paddingBottom: Math.max(insets.bottom + 16, 24) }
        ]}
        keyboardShouldPersistTaps="handled">
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
          <Pressable onPress={handleForgotPassword} disabled={isResettingPassword} style={styles.forgotPasswordButton}>
            <Text style={[styles.forgotPasswordText, isResettingPassword && styles.linkDisabled]}>
              {isResettingPassword ? 'Sending reset email...' : 'Forgot password?'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isSubmitting}>
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
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: -6,
    paddingVertical: 4
  },
  forgotPasswordText: {
    color: '#6155F5',
    fontWeight: '600'
  },
  linkDisabled: {
    opacity: 0.6
  }
});
