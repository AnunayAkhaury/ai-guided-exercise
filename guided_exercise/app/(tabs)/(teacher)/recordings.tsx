import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Header from '@/src/components/ui/Header';
import Typography from '@/src/components/ui/Typography';
import {
  getIvsRecordingPlayback,
  listIvsRecordingsBySession,
  listIvsSessions,
  type IvsRecording,
  type IvsSession
} from '@/src/api/ivs';

function formatDate(value: string | null) {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatDuration(durationMs: number | null) {
  if (!durationMs || durationMs < 1000) return '0s';
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

export default function TeacherRecordingsScreen() {
  const { width, height } = useWindowDimensions();
  const isSmallPhone = width < 380 || height < 760;
  const horizontalPadding = isSmallPhone ? 14 : 18;
  const [sessions, setSessions] = useState<IvsSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<IvsRecording[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingRecordings, setLoadingRecordings] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(null);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.sessionId === selectedSessionId) ?? null,
    [selectedSessionId, sessions]
  );

  const loadSessions = useCallback(async () => {
    const data = await listIvsSessions(['live', 'scheduled', 'ended']);
    setSessions(data);
    if (!selectedSessionId && data.length > 0) {
      setSelectedSessionId(data[0]?.sessionId ?? null);
    }
  }, [selectedSessionId]);

  const loadRecordingsForSession = useCallback(async (sessionId: string) => {
    setLoadingRecordings(true);
    try {
      const data = await listIvsRecordingsBySession(sessionId);
      setRecordings(data);
    } finally {
      setLoadingRecordings(false);
    }
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        await loadSessions();
      } catch (error: any) {
        Alert.alert('Unable to load sessions', error?.message || 'Please try again.');
      } finally {
        setLoadingSessions(false);
      }
    };
    void run();
  }, [loadSessions]);

  useEffect(() => {
    if (!selectedSessionId) {
      setRecordings([]);
      return;
    }
    void loadRecordingsForSession(selectedSessionId).catch((error: any) => {
      Alert.alert('Unable to load recordings', error?.message || 'Please try again.');
    });
  }, [loadRecordingsForSession, selectedSessionId]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadSessions();
      if (selectedSessionId) {
        await loadRecordingsForSession(selectedSessionId);
      }
    } catch (error: any) {
      Alert.alert('Refresh failed', error?.message || 'Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, [loadRecordingsForSession, loadSessions, selectedSessionId]);

  const handlePlay = useCallback(async (recordingId: string) => {
    try {
      setPlayingRecordingId(recordingId);
      const playback = await getIvsRecordingPlayback(recordingId);
      router.push({
        pathname: '/(extra)/recording-display',
        params: { link: playback.playbackUrl }
      });
    } catch (error: any) {
      Alert.alert('Playback failed', error?.message || 'Unable to load this recording.');
    } finally {
      setPlayingRecordingId(null);
    }
  }, []);

  return (
    <View className="flex-1 bg-white">
      <Header title="Recordings" />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6155F5" />}
        contentContainerStyle={{ paddingHorizontal: horizontalPadding, paddingBottom: 30, paddingTop: 16 }}
      >
        <Typography font="inter-semibold" className="text-[#3E3A67] text-base mb-3">
          Choose Session
        </Typography>

        {loadingSessions ? (
          <View className="items-center py-6">
            <ActivityIndicator color="#6155F5" />
          </View>
        ) : sessions.length === 0 ? (
          <View className="rounded-2xl border border-[#D9CCFF] bg-[#F8F5FF] p-5 mb-4">
            <Typography font="inter-semibold" className="text-[#342F66]">
              No sessions found
            </Typography>
            <Typography className="text-[#6C6896] mt-1">Create or start a class to see recordings.</Typography>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
            {sessions.map((session) => {
              const isSelected = session.sessionId === selectedSessionId;
              return (
                <Pressable
                  key={session.sessionId}
                  onPress={() => setSelectedSessionId(session.sessionId)}
                  className={`rounded-xl mr-2 px-4 py-3 border ${isSelected ? 'bg-[#6155F5] border-[#6155F5]' : 'bg-white border-[#D9CCFF]'}`}
                  style={{ minWidth: Math.min(220, Math.max(150, width * 0.5)) }}
                >
                  <Typography
                    font="inter-semibold"
                    className={isSelected ? 'text-white' : 'text-[#322D5D]'}
                    numberOfLines={1}
                  >
                    {session.sessionName}
                  </Typography>
                  <Typography className={isSelected ? 'text-[#E8E3FF] mt-1 text-xs' : 'text-[#7A76A1] mt-1 text-xs'}>
                    Code: {session.sessionCode}
                  </Typography>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <View className="mt-4">
          <Typography font="inter-semibold" className="text-[#3E3A67] text-base mb-3">
            {selectedSession ? `${selectedSession.sessionName} Recordings` : 'Session Recordings'}
          </Typography>

          {!selectedSession ? (
            <View className="rounded-2xl border border-[#D9CCFF] bg-[#F8F5FF] p-5">
              <Typography className="text-[#6C6896]">Select a session to view recordings.</Typography>
            </View>
          ) : loadingRecordings ? (
            <View className="items-center py-8">
              <ActivityIndicator color="#6155F5" />
            </View>
          ) : recordings.length === 0 ? (
            <View className="rounded-2xl border border-[#D9CCFF] bg-[#F8F5FF] p-5">
              <Typography className="text-[#6C6896]">No recordings found for this session yet.</Typography>
            </View>
          ) : (
            recordings.map((recording) => (
              <View key={recording.recordingId} className="rounded-2xl border border-[#D9CCFF] bg-[#F8F5FF] p-4 mb-3">
                <View className="flex-row items-center justify-between">
                  <Typography font="inter-semibold" className="text-[#2F2A5A]">
                    {recording.participantId}
                  </Typography>
                  <View className="px-2 py-1 rounded-full bg-[#E5DCFF]">
                    <Typography font="inter-medium" className="text-[#6155F5] text-xs">
                      {recording.status}
                    </Typography>
                  </View>
                </View>

                <Typography className="text-[#5B5685] mt-2">Start: {formatDate(recording.recordingStart)}</Typography>
                <Typography className="text-[#5B5685] mt-1">Duration: {formatDuration(recording.durationMs)}</Typography>

                <Pressable
                  onPress={() => void handlePlay(recording.recordingId)}
                  disabled={playingRecordingId === recording.recordingId}
                  className="mt-4 rounded-xl bg-[#6155F5] px-4 py-3 flex-row items-center justify-center"
                >
                  {playingRecordingId === recording.recordingId ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="play" size={18} color="#fff" />
                      <Typography font="inter-semibold" className="text-white ml-2">
                        Play Recording
                      </Typography>
                    </>
                  )}
                </Pressable>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
