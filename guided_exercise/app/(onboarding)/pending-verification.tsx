import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useToast } from '@/src/components/ui/ToastProvider';
import { sendVerificationEmail, getVerificationStatus } from '@/src/api/Firebase/firebase-auth';
import { useUserStore } from '@/src/store/userStore';

export default function VerifyPending() {
  const router = useRouter();
  const { showToast } = useToast();
  const supervisorEmail = 'movetogetherhealtogether@gmail.com';
  const [isResending, setIsResending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const { uid } = useUserStore();

  const handleResend = async () => {
    if (isResending) return;

    try {
      setIsResending(true);

      const uid = useUserStore.getState().uid;
      const email = useUserStore.getState().email;
      const username = useUserStore.getState().username;

      if (!uid || !email || !username) {
        throw new Error('Missing user info');
      }

      await sendVerificationEmail(uid, email, username);

      showToast({
        title: 'Email sent',
        message: 'Approval email was resent to admin.',
        variant: 'success'
      });
    } catch (err: any) {
      showToast({
        title: 'Failed to resend',
        message: err?.message || 'Please try again later.',
        variant: 'error'
      });
    } finally {
      setIsResending(false);
    }
  };

  const recheckStatus = async () => {
    if (isVerifying) return;
    try {
      setIsVerifying(true);
      const status = await getVerificationStatus(uid!);
      if (status === true) {
        showToast({
          title: 'Account approved',
          message: 'Your account has been approved by the program manager.',
          variant: 'success'
        });
        router.replace('/(tabs)/profile');
      } else {
        showToast({
          title: 'Account pending',
          message: 'Your account is still waiting for approval from the program manager.',
          variant: 'info'
        });
      }
      setIsVerifying(false);
    } catch (err: any) {
      showToast({
        title: 'Failed to check status',
        message: err?.message || 'Please try again later.',
        variant: 'error'
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <View className="flex-1 bg-[#F5F2FF] items-center justify-center px-6">
      <View className="bg-white border border-[#E3E1FF] rounded-2xl w-full max-w-md p-6 gap-4 shadow-sm">
        <Text className="text-2xl font-bold text-[#302E47] text-center">Verification Pending</Text>

        <View className="bg-[#F5F2FF] border border-[#D8D5FF] rounded-lg p-3">
          <Text className="text-[#6155F5] text-left">
            Thanks for your patience! Your account is waiting for approval from the program manager. Please click
            recheck status if the admin has already approved your account. Only resend the email below if requested by
            the program manager.
          </Text>
          <Text>{'\n'}</Text>
          <Text className="text-[#6155F5] text-left">
            Questions or concerns? Contact the program manager at {supervisorEmail}.
          </Text>
        </View>

        <Pressable
          onPress={recheckStatus}
          disabled={isVerifying}
          className={`rounded-xl py-3 items-center ${isVerifying ? 'bg-[#8a82f7]' : 'bg-[#6155F5]'}`}>
          {isVerifying ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold">Recheck Status</Text>
          )}
        </Pressable>

        <Pressable
          onPress={handleResend}
          disabled={isResending}
          className={`rounded-xl py-3 items-center ${isResending ? 'bg-[#8a82f7]' : 'bg-[#6155F5]'}`}>
          {isResending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold">Resend Approval Email</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.replace('/login')}>
          <Text className="text-center text-[#6155F5] underline mt-2">Back to Login</Text>
        </Pressable>
      </View>
    </View>
  );
}
