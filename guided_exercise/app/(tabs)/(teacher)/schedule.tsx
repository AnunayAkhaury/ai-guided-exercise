import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useRouter } from 'expo-router';
import Header from '@/src/components/ui/Header';
import { createIvsSession } from '@/src/api/ivs';
import { useUserStore } from '@/src/store/userStore';

function withRoundedHour(date: Date) {
  const next = new Date(date);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return next;
}

export default function ScheduleScreen() {
  const router = useRouter();
  const username = useUserStore((state) => state.username);
  const fullname = useUserStore((state) => state.fullname);
  const instructorId = useMemo(
    () => username?.trim() || fullname?.trim() || `instructor-${Date.now()}`,
    [fullname, username]
  );

  const [sessionName, setSessionName] = useState('');
  const [startAt, setStartAt] = useState(() => withRoundedHour(new Date()));
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);

  const formattedDate = useMemo(
    () =>
      startAt.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }),
    [startAt]
  );
  const formattedTime = useMemo(
    () =>
      startAt.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }),
    [startAt]
  );

  const handleConfirmDate = (pickedDate: Date) => {
    setIsDatePickerVisible(false);
    const next = new Date(startAt);
    next.setFullYear(pickedDate.getFullYear(), pickedDate.getMonth(), pickedDate.getDate());
    setStartAt(next);
  };

  const handleConfirmTime = (pickedTime: Date) => {
    setIsTimePickerVisible(false);
    const next = new Date(startAt);
    next.setHours(pickedTime.getHours(), pickedTime.getMinutes(), 0, 0);
    setStartAt(next);
  };

  const handleCreateScheduled = async () => {
    const trimmedSessionName = sessionName.trim();
    if (!trimmedSessionName) {
      Alert.alert('Missing title', 'Please enter a session title.');
      return;
    }

    const parsedDuration = Number(durationMinutes);
    if (!Number.isInteger(parsedDuration) || parsedDuration < 15 || parsedDuration > 240) {
      Alert.alert('Invalid duration', 'Duration must be between 15 and 240 minutes.');
      return;
    }
    if (isSubmitting) return;

    const endAt = new Date(startAt.getTime() + parsedDuration * 60 * 1000);

    try {
      setIsSubmitting(true);
      const created = await createIvsSession({
        sessionName: trimmedSessionName,
        instructorUid: instructorId,
        scheduledStartAt: startAt.toISOString(),
        scheduledEndAt: endAt.toISOString()
      });
      if (!created.scheduledStartAt || !created.scheduledEndAt) {
        Alert.alert(
          'Backend update needed',
          'Scheduled time was not saved by backend. Deploy latest backend changes and try again.'
        );
        return;
      }
      Alert.alert('Scheduled', 'Your class was added to upcoming sessions.');
      setSessionName('');
      router.replace('/(tabs)/(teacher)/classes');
    } catch (error: any) {
      Alert.alert('Unable to schedule', error?.message || 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Schedule Class" />
      <View style={styles.content}>
        <Text style={styles.sectionTitle}>New Scheduled Session</Text>
        <Text style={styles.helperText}>Set date and time with a picker. No manual typing needed.</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Session Title</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Thursday Mobility + Breathwork"
            placeholderTextColor="#8A86B0"
            value={sessionName}
            onChangeText={setSessionName}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.rowItem]}>
            <Text style={styles.label}>Date</Text>
            <Pressable style={styles.selectorButton} onPress={() => setIsDatePickerVisible(true)}>
              <Text style={styles.selectorText}>{formattedDate}</Text>
            </Pressable>
          </View>

          <View style={[styles.inputGroup, styles.rowItem]}>
            <Text style={styles.label}>Time</Text>
            <Pressable style={styles.selectorButton} onPress={() => setIsTimePickerVisible(true)}>
              <Text style={styles.selectorText}>{formattedTime}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Duration</Text>
          <View style={styles.durationRow}>
            {['30', '45', '60', '90'].map((value) => {
              const selected = durationMinutes === value;
              return (
                <Pressable
                  key={value}
                  style={[styles.durationChip, selected && styles.durationChipSelected]}
                  onPress={() => setDurationMinutes(value)}
                >
                  <Text style={[styles.durationText, selected && styles.durationTextSelected]}>{value} min</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={styles.previewText}>Starts: {formattedDate} at {formattedTime}</Text>

        <Pressable
          style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
          onPress={handleCreateScheduled}
          disabled={isSubmitting}
        >
          {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Create Scheduled Class</Text>}
        </Pressable>
      </View>

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        date={startAt}
        display="spinner"
        is24Hour={false}
        minimumDate={new Date()}
        onConfirm={handleConfirmDate}
        onCancel={() => setIsDatePickerVisible(false)}
      />
      <DateTimePickerModal
        isVisible={isTimePickerVisible}
        mode="time"
        date={startAt}
        display="spinner"
        is24Hour={false}
        onConfirm={handleConfirmTime}
        onCancel={() => setIsTimePickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2FF'
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2F2856'
  },
  helperText: {
    marginTop: 4,
    color: '#5F5994',
    marginBottom: 18
  },
  inputGroup: {
    marginBottom: 14
  },
  row: {
    flexDirection: 'row',
    gap: 10
  },
  rowItem: {
    flex: 1
  },
  label: {
    marginBottom: 6,
    color: '#4A4380',
    fontWeight: '600'
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D9D4FF',
    paddingVertical: 11,
    paddingHorizontal: 12,
    color: '#1D1C2B',
    fontSize: 15
  },
  selectorButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D9D4FF',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12
  },
  selectorText: {
    color: '#2F2856',
    fontWeight: '600'
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap'
  },
  durationChip: {
    borderWidth: 1,
    borderColor: '#D9D4FF',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12
  },
  durationChipSelected: {
    backgroundColor: '#EDEBFF',
    borderColor: '#6155F5'
  },
  durationText: {
    color: '#4A4380',
    fontWeight: '600'
  },
  durationTextSelected: {
    color: '#3B3272'
  },
  previewText: {
    color: '#5F5994',
    marginBottom: 10
  },
  primaryButton: {
    marginTop: 4,
    backgroundColor: '#6155F5',
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2D2288',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 3
  },
  primaryButtonDisabled: {
    opacity: 0.75
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15
  }
});
