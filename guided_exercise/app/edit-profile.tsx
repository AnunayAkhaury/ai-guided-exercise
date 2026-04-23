import { Alert, ScrollView, TextInput, TouchableOpacity, View, useWindowDimensions } from "react-native";
import Header from "@/src/components/ui/Header";
import Typography from "@/src/components/ui/Typography";
import { useUserStore } from "@/src/store/userStore";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { updateUserProfile } from "@/src/api/Firebase/firebase-auth";

export default function EditProfile() {
  const { width, height } = useWindowDimensions();
  const isSmallPhone = width < 380 || height < 760;
  const uid = useUserStore((state) => state.uid);
  const role = useUserStore((state) => state.role);
  const storedFullname = useUserStore((state) => state.fullname);
  const storedUsername = useUserStore((state) => state.username);
  const storedEmail = useUserStore((state) => state.email);

  const [fullname, setFullname] = useState(storedFullname ?? '');
  const [username, setUsername] = useState(storedUsername ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const navigateBackToProfile = () => {
    router.replace('/(tabs)/profile');
  };

  const hasChanges = useMemo(() => {
    return fullname.trim() !== (storedFullname ?? '').trim()
      || username.trim() !== (storedUsername ?? '').trim();
  }, [fullname, storedFullname, storedUsername, username]);

  const handleSave = async () => {
    if (!uid) {
      Alert.alert('Profile unavailable', 'Missing user id. Please log in again.');
      return;
    }

    const trimmedFullname = fullname.trim();
    const trimmedUsername = username.trim();

    if (!trimmedFullname) {
      Alert.alert('Full name required', 'Please enter your full name.');
      return;
    }
    if (!trimmedUsername) {
      Alert.alert('Username required', 'Please enter a username.');
      return;
    }

    try {
      setIsSaving(true);
      await updateUserProfile(uid, trimmedUsername, trimmedFullname);
      navigateBackToProfile();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to update your profile.';
      Alert.alert('Update failed', message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <Header title="Edit Profile" />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: isSmallPhone ? 16 : 20, paddingVertical: isSmallPhone ? 16 : 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-5">
          <View>
            <Typography font='inter-medium' className="mb-2 text-sm text-[#555]">
              Role
            </Typography>
            <View className="rounded-2xl bg-[#F1F1F1] px-4 py-4">
              <Typography font='inter-medium'>
                {role === 'instructor' ? 'Instructor' : 'Student'}
              </Typography>
            </View>
          </View>

          <View>
            <Typography font='inter-medium' className="mb-2 text-sm text-[#555]">
              Email
            </Typography>
            <View className="rounded-2xl bg-[#F1F1F1] px-4 py-4">
              <Typography font='inter-medium'>
                {storedEmail || 'No email available'}
              </Typography>
            </View>
          </View>

          <View>
            <Typography font='inter-medium' className="mb-2 text-sm text-[#555]">
              Full Name
            </Typography>
            <TextInput
              value={fullname}
              onChangeText={setFullname}
              placeholder="Enter your full name"
              placeholderTextColor="#888"
              style={{ fontFamily: 'Inter_400Regular' }}
              className="rounded-2xl bg-[#F1F1F1] px-4 py-4 text-base"
            />
          </View>

          <View>
            <Typography font='inter-medium' className="mb-2 text-sm text-[#555]">
              Username
            </Typography>
            <TextInput
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              placeholder="Enter your username"
              placeholderTextColor="#888"
              style={{ fontFamily: 'Inter_400Regular' }}
              className="rounded-2xl bg-[#F1F1F1] px-4 py-4 text-base"
            />
          </View>

          <View className="flex flex-row gap-3 mt-4">
            <TouchableOpacity
              className="flex-1 rounded-2xl bg-[#E9E9E9] py-4 items-center"
              onPress={navigateBackToProfile}
              disabled={isSaving}
            >
              <Typography font='inter-semibold'>Cancel</Typography>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 rounded-2xl py-4 items-center ${isSaving || !hasChanges ? 'bg-[#B3B3B3]' : 'bg-black'}`}
              onPress={handleSave}
              disabled={isSaving || !hasChanges}
            >
              <Typography font='inter-semibold' className="text-white">
                {isSaving ? 'Saving...' : 'Save'}
              </Typography>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
