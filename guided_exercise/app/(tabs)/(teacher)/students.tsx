import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, ScrollView, TextInput, TouchableOpacity, View, useWindowDimensions } from "react-native";
import DefaultImage from '@/src/assets/images/default-profile.jpg';
import { AntDesign, Ionicons } from "@expo/vector-icons";
import Header from "@/src/components/ui/Header";
import Gradient from '@/src/assets/images/RecordingsGradient.jpeg';
import Typography from "@/src/components/ui/Typography";
import { listProfiles, type AppUserProfile } from "@/src/api/Firebase/firebase-auth";
import { resolvePreferredDisplayName } from "@/src/utils/display-name";

export default function Students() {
  const { width, height } = useWindowDimensions();
  const isSmallPhone = width < 380 || height < 760;
  const [students, setStudents] = useState<AppUserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortAscending, setSortAscending] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    async function loadStudents() {
      setIsLoading(true);
      setError(null);
      try {
        const profiles = await listProfiles('student');
        if (!isCancelled) {
          setStudents(profiles);
        }
      } catch (err) {
        if (!isCancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load students.';
          setError(message);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadStudents();
    return () => {
      isCancelled = true;
    };
  }, []);

  const filteredStudents = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const filtered = students.filter((student) => {
      const displayName = resolvePreferredDisplayName({
        fullname: student.fullname,
        username: student.username,
        fallback: 'Student'
      }).toLowerCase();
      const email = student.email?.toLowerCase() || '';
      const username = student.username?.toLowerCase() || '';
      return !normalizedQuery
        || displayName.includes(normalizedQuery)
        || email.includes(normalizedQuery)
        || username.includes(normalizedQuery);
    });

    filtered.sort((a, b) => {
      const aName = resolvePreferredDisplayName({
        fullname: a.fullname,
        username: a.username,
        fallback: 'Student'
      });
      const bName = resolvePreferredDisplayName({
        fullname: b.fullname,
        username: b.username,
        fallback: 'Student'
      });
      return sortAscending ? aName.localeCompare(bName) : bName.localeCompare(aName);
    });

    return filtered;
  }, [searchQuery, sortAscending, students]);

  return (
    <View className="flex-1 bg-white">
      <Header title="Students" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: isSmallPhone ? 14 : 20, paddingVertical: isSmallPhone ? 14 : 20 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex flex-row justify-between items-center">
          <View className="flex flex-row items-center bg-[#E6E6E6] flex-1 h-11 rounded-xl gap-1 pl-3 mr-2">
            <Ionicons name="search-sharp" size={12} color="black" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search name..."
              className="flex-grow text-base"
              style={{ fontFamily: 'Inter_400Regular' }}
              placeholderTextColor="#000"
            />
          </View>
          <TouchableOpacity onPress={() => setSortAscending((prev) => !prev)}>
            <View className="relative flex flex-row items-center gap-1 p-2 rounded-xl overflow-hidden">
              <Image
                source={Gradient}
                resizeMode="cover"
                className="absolute flex-grow inset-0"
              />
              <AntDesign name={sortAscending ? "sort-ascending" : "sort-descending"} size={16} color="black" />
              <AntDesign name="down" size={14} color="black" />
            </View>
          </TouchableOpacity>
        </View>

        <View className="my-2 w-full bg-[#D3D3D3] h-[1px]" />

        <Typography font='inter-semibold' className="text-sm pb-3">
          {isLoading ? 'Loading students...' : `${filteredStudents.length} students`}
        </Typography>

        {isLoading ? (
          <View className="py-10 items-center">
            <ActivityIndicator color="#000" />
          </View>
        ) : error ? (
          <View className="py-6">
            <Typography font='inter-medium' className="text-[#FF0000]">
              {error}
            </Typography>
          </View>
        ) : filteredStudents.length === 0 ? (
          <View className="py-6">
            <Typography font='inter-medium'>
              {searchQuery.trim() ? 'No students matched your search.' : 'No student accounts found.'}
            </Typography>
          </View>
        ) : (
          filteredStudents.map((student, idx) => {
            const displayName = resolvePreferredDisplayName({
              fullname: student.fullname,
              username: student.username,
              fallback: 'Student'
            });
            const secondaryText = student.email?.trim() || student.username?.trim() || null;

            return (
              <View key={student.uid}>
                {idx !== 0 && <View className="my-2 w-full bg-[#EFEFEF] h-[1px]" />}
                <View className="flex flex-row justify-between items-center py-4">
                  <View className="flex flex-row items-center gap-3 flex-1 pr-3">
                    <Image
                      source={DefaultImage}
                      resizeMode="cover"
                      className="w-10 h-10 rounded-full"
                    />
                    <View className="flex-1">
                      <Typography font='inter-medium'>{displayName}</Typography>
                      {secondaryText ? (
                        <Typography font='inter-medium' className="text-xs text-[#666] mt-1">
                          {secondaryText}
                        </Typography>
                      ) : null}
                    </View>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
