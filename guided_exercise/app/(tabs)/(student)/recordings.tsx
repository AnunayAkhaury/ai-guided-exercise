import React, { useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native';
import { fetchRecordings } from '@/src/api/AWS/aws-s3';
import { useUserStore } from '@/src/store/userStore';
import MountainClimbExercise from '@/src/assets/images/mountain-climb-exercise-img.jpg';
import PushUpExercise from '@/src/assets/images/push-up-exercise-img.jpg';
import { router } from 'expo-router';
import Header from '@/src/components/ui/Header';
import Typography from '@/src/components/ui/Typography';
import Gradient from '@/src/assets/images/RecordingsGradient.jpeg'; 


type Recording = {
  date: string; // e.g. ISO string from Firestore
  id: string;
  exercise: string;
};

const exerciseImages: Record<string, any> = {
  'Mountain Climber': MountainClimbExercise,
  'Push Up': PushUpExercise
};

export default function RecordingsScreen() {
  const { width, height } = useWindowDimensions();
  const isSmallPhone = width < 380 || height < 760;
  const horizontalPadding = isSmallPhone ? 12 : 14;
  const cardWidth = Math.max(148, Math.floor((width - horizontalPadding * 2 - 16) / 2));
  const [recordings, setRecordings] = React.useState<Recording[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const uid = useUserStore((state) => state.uid);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!uid) {
          setRecordings([]);
          setLoading(false);
          return;
        }
        const userRecordings = await fetchRecordings(uid);
        setRecordings(userRecordings);
      } catch {
        setRecordings([{date: new Date().toISOString(), id: "", exercise: "Push Up" }]);
        setLoading(false);
      } finally {
        setRecordings([{date: new Date().toISOString(), id: "", exercise: "Push Up" }]);
        setLoading(false);
      }
    };

    fetchData();
  }, [uid]);

  // Group recordings by Month-Year and then by Day
  const groupedByMonthYear = recordings.reduce(
    (acc, rec) => {
      const dateObj = new Date(rec.date);
      const monthYear = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' }); // e.g. "October 2025"
      const day = dateObj.toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' }); // e.g. "October 25, 2025"

      if (!acc[monthYear]) acc[monthYear] = {};
      if (!acc[monthYear][day]) acc[monthYear][day] = [];
      acc[monthYear][day].push(rec);
      return acc;
    },
    {} as Record<string, Record<string, Recording[]>>
  );

  return (
    <View className='flex-grow bg-white'>
      <Header title="Recordings" />

      <View className='flex-grow'>
        {loading && <Text>Loading...</Text>}
        {!loading && recordings.length === 0 && <Text>No recordings found</Text>}
        {!loading && recordings.length > 0 && (
          <ScrollView contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
            {/* Month-Year Sections */}
            {Object.entries(groupedByMonthYear).map(([monthYear, days]) => (
              <View key={monthYear} className='mb-3 pt-10' style={{ paddingLeft: horizontalPadding }}>
                <View className='relative px-5 rounded-xl self-start overflow-hidden mb-4'>
                  <Image
                    source={Gradient}
                    resizeMode="cover"
                    className="absolute flex-grow inset-0"
                  />
                  <Typography font='inter-semibold' className='text-lg'>{monthYear}</Typography>
                </View>

                {/* Day Sections */}
                {Object.entries(days).map(([day, dayRecordings]) => (
                  <View key={day}>
                    <Typography font='istokWeb' className='mb-2'>{day}</Typography>
                    <View className='flex flex-row flex-wrap gap-3'>
                      {dayRecordings.map((recording, index) => (
                        <TouchableOpacity
                          key={index}
                          className='flex flex-col justify-center items-center'
                          style={{ width: cardWidth }}
                          onPress={() =>
                            router.push({
                              pathname: '/(extra)/recording-display',
                              params: { id: recording.id }
                            })
                          }
                        >
                          <Image
                            source={exerciseImages[recording.exercise]}
                            resizeMode="cover"
                            className='w-full h-28 shadow shadow-black bg-white'
                          />
                          <Typography className='text-sm mt-2'>{recording.exercise}</Typography>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}
