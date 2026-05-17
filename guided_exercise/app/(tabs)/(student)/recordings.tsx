import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Header from '@/src/components/ui/Header';
import Typography from '@/src/components/ui/Typography';
import { getIvsClipPlayback, IvsClip, getIvsClipsByUserId } from '@/src/api/ivs';
import { useUserStore } from '@/src/store/userStore';
import { useToast } from '@/src/components/ui/ToastProvider';

function formatDate(value: string) {
  const timestamp = Number(value);

  if (isNaN(timestamp)) {
    return 'Unknown date';
  }

  const date = new Date(timestamp);

  if (isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatDuration(value: string | null) {
  if (!value || Number(value) < 1000) return '0s';
  const totalSeconds = Math.round(Number(value) / 1000);
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

function getRecordingSessionLabel(recording: IvsRecording) {
  return recording.sessionName?.trim() || 'Untitled session';
}

export default function StudentRecordingsScreen() {
  const { showToast } = useToast();
  const { width, height } = useWindowDimensions();
  const isSmallPhone = width < 380 || height < 760;
  const horizontalPadding = isSmallPhone ? 14 : 18;
  const uid = useUserStore((state) => state.uid);

  const [clips, setClips] = useState<IvsClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);

  const loadClips = useCallback(async () => {
    if (!uid) {
      setClips([]);
      return;
    }
    const data = await getIvsClipsByUserId(uid);
    setClips(data);
  }, [uid]);

  useEffect(() => {
    const run = async () => {
      try {
        await loadClips();
      } catch (error: any) {
        showToast({
          title: 'Unable to load recordings',
          message: error?.message || 'Please try again.',
          variant: 'error'
        });
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [loadRecordings, showToast]);

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
      await loadClips();
    } catch (error: any) {
      showToast({ title: 'Refresh failed', message: error?.message || 'Please try again.', variant: 'error' });
    } finally {
      setRefreshing(false);
    }
  }, [loadRecordings, showToast]);

  const groupedClips = useMemo(() => {
    // 1. Sort the raw clips array first (Newest to Oldest)
    const sortedClips = [...clips].sort((a, b) => {
      const timeA = a.starttime ? Number(a.starttime) : 0;
      const timeB = b.starttime ? Number(b.starttime) : 0;
      return timeB - timeA;
    });

    return sortedClips.reduce<Record<string, IvsClip[]>>((acc, clip) => {
      let key = 'Other';
      if (clip.starttime) {
        const date = new Date(Number(clip.starttime));
        if (!isNaN(date.getTime())) {
          key = date.toLocaleString(undefined, { month: 'long', year: 'numeric' });
        }
      }

      if (!acc[key]) acc[key] = [];
      acc[key].push(clip);
      return acc;
    }, {});
  }, [clips]);

  const handlePlay = useCallback(
    async (clip: IvsClip) => {
      try {
        setPlayingClipId(clip.id);

        const playback = await getIvsClipPlayback(clip.id);

        router.push({
          pathname: '/(extra)/recording-display',
          params: {
            link: playback.playbackUrl,
            title: clip.exercise,
            feedbackRef: clip.feedbackRef
          }
        });
      } catch (error: any) {
        showToast({
          title: 'Playback failed',
          message: error?.message || 'Unable to load this recording.',
          variant: 'error'
        });
        Alert.alert('Playback failed', error?.message || 'Unable to load this clip.');
      } finally {
        setPlayingClipId(null);
      }
    },
    [showToast]
  );

  const handleProcess = useCallback(
    async (recordingId: string) => {
      try {
        setProcessingRecordingId(recordingId);
        await startIvsRecordingProcessing(recordingId);
        await loadRecordings({ silent: true });
        showToast({
          title: 'Processing started',
          message: 'Recording processing has been queued.',
          variant: 'success'
        });
      } catch (error: any) {
        showToast({
          title: 'Processing failed',
          message: error?.message || 'Unable to start recording processing.',
          variant: 'error'
        });
      } finally {
        setProcessingRecordingId(null);
      }
    },
    [loadRecordings, showToast]
  );

  return (
    <View className="flex-1 bg-white">
      <Header title="Exercise Clips" />

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6155F5" />}
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingBottom: 30,
          paddingTop: 16
        }}>
        {loading ? (
          <View className="items-center pt-12">
            <ActivityIndicator color="#6155F5" />
            <Typography className="mt-3 text-[#666]">Loading your clips...</Typography>
          </View>
        ) : clips.length === 0 ? (
          <View className="rounded-2xl border border-[#D9CCFF] bg-[#F8F5FF] p-6 items-center mt-3">
            <Ionicons name="videocam-outline" size={24} color="#6155F5" />
            <Typography font="inter-semibold" className="text-[#342F66] text-base mt-3">
              No clips found
            </Typography>
            <Typography className="text-[#6C6896] text-center mt-2">
              Your generated exercise clips will appear here after your session is processed.
            </Typography>
          </View>
        ) : (
          Object.entries(groupedClips).map(([group, items]) => (
            <View key={group} className="mb-6">
              <Typography font="inter-semibold" className="text-[#3E3A67] text-base mb-3">
                {group}
              </Typography>

              {items.map((clip) => (
                <View key={clip.id} className="rounded-2xl border border-[#D9CCFF] bg-[#F8F5FF] p-4 mb-3">
                  <View className="flex-row items-center justify-between">
                    <Typography font="inter-semibold" className="text-[#2F2A5A]">
                      {formatDate(clip.starttime)}
                    </Typography>
                    <View
                      className={`px-2 py-1 rounded-full ${recording.status === 'failed' ? 'bg-[#FFE3E8]' : recording.status === 'completed' ? 'bg-[#DDF8E8]' : 'bg-[#E5DCFF]'}`}>
                      <Typography font="inter-medium" className="text-[#6155F5] text-xs">
                        {getStatusCopy(recording.status)}
                      </Typography>
                    </View>
                  </View>

                  <View className="mt-2 space-y-1">
                    <Typography className="text-[#5B5685]">
                      <Typography font="inter-semibold">Duration:</Typography> {formatDuration(clip.duration)}
                    </Typography>

                    <Typography className="text-[#5B5685]">
                      <Typography font="inter-semibold">Exercise:</Typography> {clip.exercise}
                    </Typography>
                  </View>

                  <Typography className="text-[#5B5685] mt-2">
                    Duration: {formatDuration(recording.durationMs)}
                  </Typography>
                  <Typography className="text-[#5B5685] mt-1" numberOfLines={1}>
                    Session: {getRecordingSessionLabel(recording)}
                  </Typography>
                  {recording.error ? (
                    <Typography className="text-[#B32646] mt-2">{recording.error}</Typography>
                  ) : recording.status !== 'completed' ? (
                    <Typography className="text-[#5B5685] mt-2">
                      Playback will be available after processing completes.
                    </Typography>
                  ) : null}
                  <Pressable
                    onPress={() => void handlePlay(clip)}
                    disabled={playingClipId === clip.id}
                    className="mt-4 rounded-xl bg-[#6155F5] px-4 py-3 flex-row items-center justify-center active:opacity-70">
                    {playingClipId === clip.id ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="play" size={18} color="#fff" />
                        <Typography font="inter-semibold" className="text-white ml-2">
                          View Clip
                        </Typography>
                      </>
                    )}
                  </Pressable>
                  {recording.status === 'queued' || recording.status === 'failed' ? (
                    <Pressable
                      onPress={() => void handleProcess(recording.recordingId)}
                      disabled={processingRecordingId === recording.recordingId}
                      className="mt-3 rounded-xl border border-[#6155F5] px-4 py-3 flex-row items-center justify-center">
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
