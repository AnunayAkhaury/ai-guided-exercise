import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type MockTile = {
  id: string;
  name: string;
  role: 'instructor' | 'student';
  color: string;
};

const MOCK_PARTICIPANTS: MockTile[] = [
  { id: 'instructor', name: 'Coach Joey', role: 'instructor', color: '#4A3DDB' },
  { id: 's1', name: 'Sanjith', role: 'student', color: '#A64AF9' },
  { id: 's2', name: 'Anunay', role: 'student', color: '#E8518C' },
  { id: 's3', name: 'Garrett', role: 'student', color: '#22A6F2' },
  { id: 's4', name: 'Grace', role: 'student', color: '#FF8A34' }
];

export default function VideoUiTestScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [viewMode, setViewMode] = useState<'instructor' | 'student'>('instructor');
  const [muted, setMuted] = useState(true);
  const [cameraOff, setCameraOff] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const instructor = MOCK_PARTICIPANTS.find((p) => p.role === 'instructor')!;
  const students = MOCK_PARTICIPANTS.filter((p) => p.role === 'student');
  const useGrid = students.length > 1;
  const heroHeight = Math.max(190, Math.min(260, Math.round(width * 0.56)));
  const gridHeight = Math.max(190, Math.min(260, Math.round(((width - 38) / 2) * 1.35)));
  const showInstructorAsTop = viewMode === 'student';
  const showLocalAsTop = viewMode === 'instructor';

  const infoText = useMemo(
    () => `Session: UI Preview\nCoach: ${instructor.name}\nCode: DEMO42`,
    [instructor.name]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <ScrollView style={styles.videoContainer} contentContainerStyle={styles.videoContent}>
        <View style={styles.topRow}>
          <Text style={styles.heading}>Video UI Preview</Text>
          <Pressable style={styles.infoIconButton} onPress={() => setShowInfo((prev) => !prev)}>
            <Ionicons name="information-circle-outline" size={18} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.modeToggleRow}>
          <Pressable
            style={[styles.modeToggleButton, viewMode === 'instructor' && styles.modeToggleButtonActive]}
            onPress={() => setViewMode('instructor')}
          >
            <Text style={[styles.modeToggleText, viewMode === 'instructor' && styles.modeToggleTextActive]}>
              Instructor View
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeToggleButton, viewMode === 'student' && styles.modeToggleButtonActive]}
            onPress={() => setViewMode('student')}
          >
            <Text style={[styles.modeToggleText, viewMode === 'student' && styles.modeToggleTextActive]}>
              Student View
            </Text>
          </Pressable>
        </View>

        {showInfo && (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardText}>{infoText}</Text>
          </View>
        )}

        {showLocalAsTop && (
          <View style={styles.participantWrapper}>
            <View style={styles.participantLabelPill}>
              <Text style={styles.participantLabel}>You (Instructor)</Text>
            </View>
            <View style={[styles.heroFrame, { height: heroHeight, backgroundColor: '#4A3DDB' }]}>
              <Text style={styles.tileCenterText}>Your instructor video area</Text>
            </View>
          </View>
        )}

        {showInstructorAsTop && (
          <View style={styles.participantWrapper}>
            <View style={styles.participantLabelPill}>
              <Text style={styles.participantLabel}>{instructor.name}</Text>
            </View>
            <View style={[styles.heroFrame, { height: heroHeight, backgroundColor: instructor.color }]}>
              <Text style={styles.tileCenterText}>Instructor video area</Text>
            </View>
          </View>
        )}

        {students.map((student) => (
          <View key={student.id} style={[styles.participantWrapper, useGrid && styles.gridParticipantWrapper]}>
            <View style={styles.participantLabelPill}>
              <Text style={styles.participantLabel}>{student.name}</Text>
            </View>
            <View
              style={[
                useGrid ? styles.gridFrame : styles.heroFrame,
                {
                  height: useGrid ? gridHeight : heroHeight,
                  backgroundColor: student.color
                }
              ]}
            >
              <Text style={styles.tileCenterText}>
                {viewMode === 'student' ? 'Student tile' : `${student.name} (student)`}
              </Text>
            </View>
          </View>
        ))}

        {viewMode === 'student' && (
          <View style={[styles.participantWrapper, useGrid && styles.gridParticipantWrapper]}>
            <View style={styles.participantLabelPill}>
              <Text style={styles.participantLabel}>You (Student)</Text>
            </View>
            <View style={[styles.gridFrame, { height: gridHeight, backgroundColor: '#6A63A4' }]}>
              <Text style={styles.tileCenterText}>Your student tile</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.controlBar}>
        <Pressable style={[styles.controlButton, muted && styles.controlButtonMuted]} onPress={() => setMuted((v) => !v)}>
          <Ionicons name={muted ? 'mic-off' : 'mic'} size={18} color="#fff" />
          <Text style={styles.controlButtonText}>{muted ? 'Unmute' : 'Mute'}</Text>
        </Pressable>
        <Pressable
          style={[styles.controlButton, cameraOff && styles.controlButtonMuted]}
          onPress={() => setCameraOff((v) => !v)}
        >
          <Ionicons name={cameraOff ? 'videocam-off' : 'videocam'} size={18} color="#fff" />
          <Text style={styles.controlButtonText}>{cameraOff ? 'Start Cam' : 'Stop Cam'}</Text>
        </Pressable>
        <Pressable style={styles.endCallButton}>
          <Ionicons name="call" size={18} color="#fff" />
          <Text style={styles.controlButtonText}>Leave</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2FF'
  },
  videoContainer: { flex: 1, width: '100%' },
  videoContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingBottom: 12
  },
  topRow: {
    width: '100%',
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2B2457'
  },
  infoIconButton: {
    backgroundColor: '#6A63A4',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center'
  },
  infoCard: {
    width: '100%',
    borderRadius: 12,
    backgroundColor: '#EAE7FF',
    borderWidth: 1,
    borderColor: '#D9D5FF',
    padding: 12,
    marginBottom: 12
  },
  infoCardText: {
    color: '#3A346B',
    fontWeight: '600',
    lineHeight: 20
  },
  modeToggleRow: {
    width: '100%',
    marginBottom: 12,
    flexDirection: 'row',
    gap: 8
  },
  modeToggleButton: {
    flex: 1,
    backgroundColor: '#E6E2FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CFC8FF',
    paddingVertical: 10,
    alignItems: 'center'
  },
  modeToggleButtonActive: {
    backgroundColor: '#6155F5',
    borderColor: '#6155F5'
  },
  modeToggleText: {
    color: '#4A4383',
    fontWeight: '700',
    fontSize: 13
  },
  modeToggleTextActive: {
    color: '#FFFFFF'
  },
  participantWrapper: {
    width: '100%',
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#101015',
    borderWidth: 2,
    borderColor: '#E5E3FF'
  },
  gridParticipantWrapper: {
    width: '49%',
    marginHorizontal: '0.5%'
  },
  participantLabelPill: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 10,
    backgroundColor: 'rgba(97, 85, 245, 0.85)',
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 4
  },
  participantLabel: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12
  },
  heroFrame: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center'
  },
  gridFrame: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center'
  },
  tileCenterText: {
    color: '#fff',
    fontWeight: '800'
  },
  controlBar: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#F5F2FF'
  },
  controlButton: {
    flex: 1,
    backgroundColor: '#6155F5',
    borderRadius: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  controlButtonMuted: {
    backgroundColor: '#D64562'
  },
  endCallButton: {
    flex: 1,
    backgroundColor: '#A980FE',
    borderRadius: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  controlButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13
  }
});
