import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Header from '@/src/components/ui/Header';
import Typography from '@/src/components/ui/Typography';
import { getIvsRecordingPlayback, listIvsRecordingsByUser, startIvsRecordingProcessing, type IvsRecording } from '@/src/api/ivs';
import { useUserStore } from '@/src/store/userStore';

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

function getStatusCopy(status: IvsRecording['status']) {
  switch (status) {
    case 'queued':
      return 'Queued for processing';
    case 'processing':
      return 'Processing video';
    case 'completed':
      return 'Ready to watch';
    case 'failed':
      return 'Processing failed';
    default:
      return status;
  }
}

function canPlayRecording(recording: IvsRecording) {
  return recording.status === 'completed' && Boolean(recording.processedVideoUrl);
}

export default function StudentRecordingsScreen() {
  const { width, height } = useWindowDimensions();
  const isSmallPhone = width < 380 || height < 760;
  const horizontalPadding = isSmallPhone ? 14 : 18;
  const uid = useUserStore((state) => state.uid);
  const [recordings, setRecordings] = useState<IvsRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(null);
  const [processingRecordingId, setProcessingRecordingId] = useState<string | null>(null);

  const loadRecordings = useCallback(async (options?: { silent?: boolean }) => {
    if (!uid) {
      setRecordings([]);
      return;
    }
    const data = await listIvsRecordingsByUser(uid);
    setRecordings(data);
    if (!options?.silent) {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    const run = async () => {
      try {
        await loadRecordings();
      } catch (error: any) {
        Alert.alert('Unable to load recordings', error?.message || 'Please try again.');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [loadRecordings]);

  const hasPendingRecordings = useMemo(
    () => recordings.some((recording) => recording.status === 'queued' || recording.status === 'processing'),
    [recordings]
  );

  useEffect(() => {
    if (!hasPendingRecordings) return;
    const interval = setInterval(() => {
      void loadRecordings({ silent: true }).catch(() => undefined);
    }, 6000);
    return () => clearInterval(interval);
  }, [hasPendingRecordings, loadRecordings]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadRecordings();
    } catch (error: any) {
      Alert.alert('Refresh failed', error?.message || 'Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, [loadRecordings]);

  const groupedRecordings = useMemo(() => {
    return recordings.reduce<Record<string, IvsRecording[]>>((acc, recording) => {
      const key = recording.recordingStart
        ? new Date(recording.recordingStart).toLocaleString(undefined, { month: 'long', year: 'numeric' })
        : 'Unknown';
      if (!acc[key]) acc[key] = [];
      acc[key].push(recording);
      return acc;
    }, {});
  }, [recordings]);

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

  const handleProcess = useCallback(async (recordingId: string) => {
    try {
      setProcessingRecordingId(recordingId);
      await startIvsRecordingProcessing(recordingId);
      await loadRecordings({ silent: true });
    } catch (error: any) {
      Alert.alert('Processing failed', error?.message || 'Unable to start recording processing.');
    } finally {
      setProcessingRecordingId(null);
    }
  }, [loadRecordings]);

  return (
    <View className="flex-1 bg-white">
      <Header title="Recordings" />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6155F5" />}
        contentContainerStyle={{ paddingHorizontal: horizontalPadding, paddingBottom: 30, paddingTop: 16 }}
      >
        {loading ? (
          <View className="items-center pt-12">
            <ActivityIndicator color="#6155F5" />
            <Typography className="mt-3 text-[#666]">Loading recordings...</Typography>
          </View>
        ) : recordings.length === 0 ? (
          <View className="rounded-2xl border border-[#D9CCFF] bg-[#F8F5FF] p-6 items-center mt-3">
            <Ionicons name="videocam-outline" size={24} color="#6155F5" />
            <Typography font="inter-semibold" className="text-[#342F66] text-base mt-3">
              No recordings yet
            </Typography>
            <Typography className="text-[#6C6896] text-center mt-2">
              Your session recordings will appear here after class ends.
            </Typography>
          </View>
        ) : (
          Object.entries(groupedRecordings).map(([group, items]) => (
            <View key={group} className="mb-6">
              <Typography font="inter-semibold" className="text-[#3E3A67] text-base mb-3">
                {group}
              </Typography>
              {items.map((recording) => (
                <View key={recording.recordingId} className="rounded-2xl border border-[#D9CCFF] bg-[#F8F5FF] p-4 mb-3">
                  <View className="flex-row items-center justify-between">
                    <Typography font="inter-semibold" className="text-[#2F2A5A]">
                      {formatDate(recording.recordingStart)}
                    </Typography>
                    <View className={`px-2 py-1 rounded-full ${recording.status === 'failed' ? 'bg-[#FFE3E8]' : recording.status === 'completed' ? 'bg-[#DDF8E8]' : 'bg-[#E5DCFF]'}`}>
                      <Typography font="inter-medium" className="text-[#6155F5] text-xs">
                        {getStatusCopy(recording.status)}
                      </Typography>
                    </View>
                  </View>
                  <Typography className="text-[#5B5685] mt-2">
                    Duration: {formatDuration(recording.durationMs)}
                  </Typography>
                  {recording.error ? (
                    <Typography className="text-[#B32646] mt-2">
                      {recording.error}
                    </Typography>
                  ) : recording.status !== 'completed' ? (
                    <Typography className="text-[#5B5685] mt-2">
                      Playback will be available after processing completes.
                    </Typography>
                  ) : null}
                  <Pressable
                    onPress={() => void handlePlay(recording.recordingId)}
                    disabled={playingRecordingId === recording.recordingId || !canPlayRecording(recording)}
                    className={`mt-4 rounded-xl px-4 py-3 flex-row items-center justify-center ${canPlayRecording(recording) ? 'bg-[#6155F5]' : 'bg-[#B8B3DF]'}`}
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
                  {(recording.status === 'queued' || recording.status === 'failed') ? (
                    <Pressable
                      onPress={() => void handleProcess(recording.recordingId)}
                      disabled={processingRecordingId === recording.recordingId}
                      className="mt-3 rounded-xl border border-[#6155F5] px-4 py-3 flex-row items-center justify-center"
                    >
                      {processingRecordingId === recording.recordingId ? (
                        <ActivityIndicator color="#6155F5" />
                      ) : (
                        <>
                          <Ionicons name="refresh" size={18} color="#6155F5" />
                          <Typography font="inter-semibold" className="text-[#6155F5] ml-2">
                            {recording.status === 'failed' ? 'Retry Processing' : 'Process Recording'}
                          </Typography>
                        </>
                      )}
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
