import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons'; // Standard in modern Expo
import ClassCard from '@/src/components/ClassCard';

// Mock data: In a real app, fetch this from your 'zoom-controller' or DB
const CLASSES_DATA = [
  { id: 'classid1', start: new Date(), end: new Date(), title: 'Session', desc: 'This is a session', active: false },
  { id: 'classid2', start: new Date(), end: new Date(), title: 'Session', desc: 'This is a session', active: false },
  { id: 'classid3', start: new Date(), end: new Date(), title: 'Session', desc: 'This is a session', active: false },
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
      style={styles.bttn} 
      onPress={() => handleClassSelect(item.id)}
    >
      <Text>Join Meeting</Text>
      <Ionicons name="videocam" size={24} color="#2D8CFF" />
    </TouchableOpacity>
  );
}

export default function ClassesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Available Sessions</Text>
      <FlatList
        data={CLASSES_DATA}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ClassCard {...item}><JoinMeetingBttn item={item} /></ClassCard>}
        contentContainerStyle={styles.listPadding}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { fontSize: 22, fontWeight: 'bold', margin: 20, marginBottom: 10 },
  listPadding: { paddingHorizontal: 20 },
  bttn: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
  },
});