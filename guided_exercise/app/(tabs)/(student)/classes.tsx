import React from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome6, Ionicons } from '@expo/vector-icons';
import ClassCard from '@/src/components/classes/ClassCard';
import Header from '@/src/components/ui/Header';
import ActiveClassCard from '@/src/components/classes/ActiveClassCard';
import Typography from '@/src/components/ui/Typography';

// Mock data: In a real app, fetch this from your 'zoom-controller' or DB
const ACTIVE_CLASSES_DATA = [
  { id: 'classid1', start: new Date(Date.now() + 24 * 60 * 60 * 1000), end: new Date(Date.now() + 25 * 60 * 60 * 1000), title: 'Session', desc: 'This is a session', active: false },
];

const CLASSES_DATA = [
  { id: 'classid1', start: new Date(Date.now() + 24 * 60 * 60 * 1000), end: new Date(Date.now() + 25 * 60 * 60 * 1000), title: 'Session', desc: 'This is a session', active: false },
  { id: 'classid2', start: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000), title: 'Session', desc: 'This is a session', active: false },
];

function JoinMeetingBttn({ item }: { item: typeof CLASSES_DATA[0] }) {
  const router = useRouter();

  const handleClassSelect = (sessionName: string) => {
    // Navigate to the student join folder
    // Passing sessionName as a parameter
    router.push({
      pathname: "/(student)/join-meeting",
      params: { sessionName: sessionName }
    });
  };

  return (
    <TouchableOpacity 
      onPress={() => handleClassSelect(item.id)}
    >
      <Text>Join Meeting</Text>
      <Ionicons name="videocam" size={24} color="#2D8CFF" />
    </TouchableOpacity>
  );
}

export default function ClassesScreen() {
  return (
    <View className='bg-white flex-grow'>
      <Header title='Classes' />

      <View className='px-5 pt-9'>
        <View className='pb-6 flex flex-row items-center gap-2'>
          <Typography font='inter-semibold' className=''>Active Sessions</Typography>
          <FontAwesome6 name="dumbbell" size={16} color="black" className="-rotate-45" />
        </View>

        <FlatList
          data={ACTIVE_CLASSES_DATA}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ActiveClassCard {...item} />}
        />

        <View className='pt-20 pb-6 flex flex-row items-center gap-2'>
          <Typography font='inter-semibold' className=''>Upcoming Sessions</Typography>
          <Ionicons name="calendar-clear-sharp" size={17} color="black" />
        </View>

        <FlatList
          data={CLASSES_DATA}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ClassCard {...item} />}
        />
      </View>
    </View>
  );
}
