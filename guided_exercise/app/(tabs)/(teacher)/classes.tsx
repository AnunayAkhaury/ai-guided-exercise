import React from 'react';
import { View, FlatList, TouchableOpacity } from 'react-native';
import { AntDesign, FontAwesome6, Ionicons } from '@expo/vector-icons';
import ClassCard from '@/src/components/classes/ClassCard';
import Header from '@/src/components/ui/Header';
import Typography from '@/src/components/ui/Typography';
import TeacherActiveClassCard from '@/src/components/classes/TeacherActiveClassCard';

// Mock data: In a real app, fetch this from your 'zoom-controller' or DB
const ACTIVE_CLASSES_DATA = [
  { id: 'classid1', start: new Date(Date.now() + 24 * 60 * 60 * 1000), end: new Date(Date.now() + 25 * 60 * 60 * 1000), title: 'Session', desc: 'This is a session', active: false },
];

const CLASSES_DATA = [
  { id: 'classid1', start: new Date(Date.now() + 24 * 60 * 60 * 1000), end: new Date(Date.now() + 25 * 60 * 60 * 1000), title: 'Session', desc: 'This is a session', active: false },
  { id: 'classid2', start: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000), title: 'Session', desc: 'This is a session', active: false },
];

export default function ClassesScreen() {
  return (
    <View className='bg-white flex-grow'>
      <Header title='Classes' />

      <View className='px-5 pt-9'>
        <View className='pb-6 flex flex-row items-center gap-2'>
          <Typography font='inter-semibold' className=''>Start Sessions</Typography>
          <FontAwesome6 name="dumbbell" size={16} color="black" className="-rotate-45" />
        </View>

        <FlatList
          data={ACTIVE_CLASSES_DATA}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TeacherActiveClassCard {...item} />}
        />

        <View className='pt-20 pb-6 flex flex-row justify-between items-center'>
          <View className='flex flex-row items-center gap-2'>
            <Typography font='inter-semibold' className=''>Upcoming Sessions</Typography>
            <Ionicons name="calendar-clear-sharp" size={17} color="black" />
          </View>
          <TouchableOpacity className='p-1 rounded-lg border-[#DFDFDF] border-[1px]'>
            <AntDesign name="delete" size={17} color="#929292" />
          </TouchableOpacity>
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
