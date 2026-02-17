import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons'; // Standard in modern Expo

// Mock data: In a real app, fetch this from your 'zoom-controller' or DB
const CLASSES_DATA = [
  { id: 'classid1', title: 'Tuesday, 3PM', instructor: 'Instructor Name' },
  { id: 'classid2', title: 'Saturday, 2PM', instructor: 'Instructor Name' },
  { id: 'classid3', title: 'Sunday, 1PM', instructor: 'Instructor Name' },
];

export default function ClassesScreen() {
  const router = useRouter();

  const handleClassSelect = (sessionName: string) => {
    // Navigate to the student join folder
    // Passing sessionName as a parameter
    router.push({
      pathname: "/(student)/join-meeting",
      params: { sessionName: sessionName }
    });
  };

  const renderClassItem = ({ item }: { item: typeof CLASSES_DATA[0] }) => (
    <TouchableOpacity 
      style={styles.classCard} 
      onPress={() => handleClassSelect(item.id)}
    >
      <View style={styles.classInfo}>
        <Text style={styles.classTitle}>{item.title}</Text>
        <Text style={styles.classInstructor}>{item.instructor}</Text>
      </View>
      <Ionicons name="videocam" size={24} color="#2D8CFF" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Available Sessions</Text>
      <FlatList
        data={CLASSES_DATA}
        keyExtractor={(item) => item.id}
        renderItem={renderClassItem}
        contentContainerStyle={styles.listPadding}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { fontSize: 22, fontWeight: 'bold', margin: 20, marginBottom: 10 },
  listPadding: { paddingHorizontal: 20 },
  classCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
    // Soft shadow for modern look
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  classTitle: { fontSize: 18, fontWeight: '600' },
  classInstructor: { fontSize: 14, color: '#666', marginTop: 4 },
  classInfo: {}
});