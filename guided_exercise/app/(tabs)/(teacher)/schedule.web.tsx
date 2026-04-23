import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Header from '@/src/components/ui/Header';
import { createIvsSession } from '@/src/api/ivs';
import { useUserStore } from '@/src/store/userStore';
import { resolvePreferredDisplayName } from '@/src/utils/display-name';

function withRoundedHour(date: Date) {
  const next = new Date(date);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return next;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toTimeInputValue(date: Date) {
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${hours}:${minutes}`;
}

function applyDatePart(base: Date, value: string) {
  const [year, month, day] = value.split('-').map((segment) => Number(segment));
  if (!year || !month || !day) return base;
  return new Date(year, month - 1, day, base.getHours(), base.getMinutes(), 0, 0);
}

function applyTimePart(base: Date, value: string) {
  const [hours, minutes] = value.split(':').map((segment) => Number(segment));
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return base;
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), hours, minutes, 0, 0);
}

const htmlInputStyle: React.CSSProperties = {
  width: '100%',
  border: 'none',
  outline: 'none',
  backgroundColor: 'transparent',
  color: '#2F2856',
  fontSize: 16,
  fontFamily: 'inherit'
};

export default function ScheduleScreenWeb() {
  const router = useRouter();
  const uid = useUserStore((state) => state.uid);
  const username = useUserStore((state) => state.username);
  const fullname = useUserStore((state) => state.fullname);
  const instructorId = useMemo(() => uid?.trim() || `instructor-${Date.now()}`, [uid]);
  const coachName = useMemo(
    () =>
      resolvePreferredDisplayName({
        fullname,
        username,
        fallback: 'Coach'
      }),
    [fullname, username]
  );

  const [sessionName, setSessionName] = useState('');
  const [startAt, setStartAt] = useState(() => withRoundedHour(new Date()));
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleCreateScheduled = async () => {
    const trimmedSessionName = sessionName.trim();
    if (!trimmedSessionName) {
      Alert.alert('Missing title', 'Please enter a session title.');
      return;
    }
    if (!uid?.trim()) {
      Alert.alert('Missing profile', 'Missing instructor profile uid. Please log out and log in again.');
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
        coachName,
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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>New Scheduled Session</Text>
          <Text style={styles.helperText}>Use desktop-friendly date and time inputs to create a class.</Text>

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
              <View style={styles.webInputShell}>
                <input
                  type="date"
                  min={toDateInputValue(new Date())}
                  value={toDateInputValue(startAt)}
                  onChange={(event) => {
                    setStartAt((current) => applyDatePart(current, event.currentTarget.value));
                  }}
                  style={htmlInputStyle}
                />
              </View>
            </View>

            <View style={[styles.inputGroup, styles.rowItem]}>
              <Text style={styles.label}>Time</Text>
              <View style={styles.webInputShell}>
                <input
                  type="time"
                  value={toTimeInputValue(startAt)}
                  onChange={(event) => {
                    setStartAt((current) => applyTimePart(current, event.currentTarget.value));
                  }}
                  style={htmlInputStyle}
                />
              </View>
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
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Create Scheduled Class</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2FF'
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24
  },
  card: {
    width: '100%',
    maxWidth: 920,
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingVertical: 30,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9CCFF'
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2F2856'
  },
  helperText: {
    marginTop: 6,
    marginBottom: 22,
    color: '#5F5994'
  },
  row: {
    flexDirection: 'row',
    gap: 16
  },
  rowItem: {
    flex: 1
  },
  inputGroup: {
    marginBottom: 18
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#413B71',
    marginBottom: 8
  },
  input: {
    borderWidth: 1,
    borderColor: '#D9CCFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F8F5FF',
    color: '#2F2856'
  },
  webInputShell: {
    borderWidth: 1,
    borderColor: '#D9CCFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F8F5FF'
  },
  durationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  durationChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D9CCFF',
    backgroundColor: '#F8F5FF',
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  durationChipSelected: {
    backgroundColor: '#6155F5',
    borderColor: '#6155F5'
  },
  durationText: {
    color: '#4B4680',
    fontWeight: '600'
  },
  durationTextSelected: {
    color: '#FFFFFF'
  },
  previewText: {
    color: '#5F5994',
    marginBottom: 20
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#6155F5',
    paddingVertical: 14
  },
  primaryButtonDisabled: {
    opacity: 0.65
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16
  }
});
