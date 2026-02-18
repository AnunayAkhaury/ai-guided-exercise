import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import { fetchRecordings } from '@/src/api/AWS/aws-s3';
import { useUserStore } from '@/src/store/userStore';
import MountainClimbExercise from '@/src/assets/images/mountain-climb-exercise-img.jpg';
import PushUpExercise from '@/src/assets/images/push-up-exercise-img.jpg';
import { router } from 'expo-router';

type Recording = {
  date: string; // e.g. ISO string from Firestore
  link: string;
  exercise: string;
};

const exerciseImages: Record<string, any> = {
  'Mountain Climber': MountainClimbExercise,
  'Push Up': PushUpExercise
};

export default function RecordingsScreen() {
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
      } finally {
        setRecordings([]);
        setLoading(false);
      }
    };

    fetchData();
  }, [uid]);

  // ---- Group recordings by Month-Year and then by Day ----
  const groupedByMonthYear = recordings.reduce(
    (acc, rec) => {
      const dateObj = new Date(rec.date);
      const monthYear = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' }); // e.g. "October 2025"
      const day = dateObj.toLocaleDateString('default', { day: 'numeric', weekday: 'short' }); // e.g. "Tue, 14"

      if (!acc[monthYear]) acc[monthYear] = {};
      if (!acc[monthYear][day]) acc[monthYear][day] = [];
      acc[monthYear][day].push(rec);
      return acc;
    },
    {} as Record<string, Record<string, Recording[]>>
  );

  return (
    <View style={styles.background}>
      {/* Top Blue Header */}
      <View style={styles.topBlue}>
        <Text style={styles.headerText}>Recordings</Text>
      </View>

      {/* White container */}
      <View style={styles.container}>
        {loading && <Text>Loading...</Text>}
        {!loading && recordings.length === 0 && <Text>No recordings found</Text>}
        {!loading && recordings.length > 0 && (
          <ScrollView>
            {/* Month-Year Sections */}
            {Object.entries(groupedByMonthYear).map(([monthYear, days]) => (
              <View key={monthYear} style={styles.monthSection}>
                <Text style={styles.monthTitle}>{monthYear}</Text>

                {/* Day Sections */}
                {Object.entries(days).map(([day, dayRecordings]) => (
                  <View key={day} style={styles.daySection}>
                    <Text style={styles.dayTitle}>{day}</Text>
                    <View style={styles.row}>
                      {dayRecordings.map((recording, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.recordingItem}
                          onPress={() =>
                            router.push({
                              pathname: '/(extra)/recording-display',
                              params: { link: recording.link }
                            })
                          }>
                          <Image style={styles.exerciseImage} source={exerciseImages[recording.exercise]} />
                          <Text style={styles.exerciseText}>{recording.exercise}</Text>
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

// ---- Styles ----
const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#C3F5FF'
  },
  topBlue: {
    height: 120,
    justifyContent: 'flex-end',
    paddingLeft: 20,
    paddingBottom: 10,
    backgroundColor: '#C3F5FF'
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000'
  },
  container: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flex: 1,
    padding: 20
  },
  monthSection: {
    marginBottom: 25
  },
  monthTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333'
  },
  daySection: {
    marginBottom: 15
  },
  dayTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 5
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  recordingItem: {
    alignItems: 'center',
    width: '45%'
  },
  exerciseImage: {
    width: '100%',
    height: 100,
    borderRadius: 10,
    borderColor: '#000',
    borderWidth: 1
  },
  exerciseText: {
    marginTop: 5,
    fontSize: 14,
    color: '#000'
  }
});
