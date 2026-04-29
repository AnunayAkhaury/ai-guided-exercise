import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
  useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Header from '@/src/components/ui/Header';
import Typography from '@/src/components/ui/Typography';
import { getIvsClipsPlayback, IvsClipWithDate, listIvsClipsByUser } from '@/src/api/ivs';
import { useUserStore } from '@/src/store/userStore';

function formatDate(value: string | number | null) {
  if (!value) return 'Unknown date';
  const timestamp = typeof value === 'string' && !isNaN(Number(value)) ? Number(value) : value;
  const date = new Date(timestamp);

  if (isNaN(date.getTime())) return 'Unknown date';

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

export default function TeacherRecordingsScreen() {
  const { width, height } = useWindowDimensions();
  const isSmallPhone = width < 380 || height < 760;
  const horizontalPadding = isSmallPhone ? 14 : 18;
  const uid = useUserStore((state) => state.uid);

  const [clips, setClips] = useState<IvsClipWithDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);

  const loadClips = useCallback(async () => {
    if (!uid) {
      setClips([]);
      return;
    }
    const data = await listIvsClipsByUser(uid);
    setClips(data);
  }, [uid]);

  useEffect(() => {
    const run = async () => {
      try {
        await loadClips();
      } catch (error: any) {
        Alert.alert('Unable to load clips', error?.message || 'Please try again.');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [loadClips]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadClips();
    } catch (error: any) {
      Alert.alert('Refresh failed', error?.message || 'Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, [loadClips]);

  const groupedClips = useMemo(() => {
    // 1. Sort the raw clips array first (Newest to Oldest)
    const sortedClips = [...clips].sort((a, b) => {
      const timeA = a.recordingStart ? Number(a.recordingStart) : 0;
      const timeB = b.recordingStart ? Number(b.recordingStart) : 0;
      return timeB - timeA;
    });

    return sortedClips.reduce<Record<string, IvsClipWithDate[]>>((acc, clip) => {
      let key = 'Other';
      if (clip.recordingStart) {
        const date = new Date(Number(clip.recordingStart));
        if (!isNaN(date.getTime())) {
          key = date.toLocaleString(undefined, { month: 'long', year: 'numeric' });
        }
      }

      if (!acc[key]) acc[key] = [];
      acc[key].push(clip);
      return acc;
    }, {});
  }, [clips]);
  const handlePlay = useCallback(async (clip: IvsClipWithDate) => {
    try {
      setPlayingClipId(clip.clipId);

      const playback = await getIvsClipsPlayback(clip.clipId);

      router.push({
        pathname: '/(extra)/recording-display',
        params: {
          link: playback.playbackUrl,
          title: clip.exercise,
          feedback: clip.feedback
        }
      });
    } catch (error: any) {
      Alert.alert('Playback failed', error?.message || 'Unable to load this clip.');
    } finally {
      setPlayingClipId(null);
    }
  }, []);

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
                <View key={clip.clipId} className="rounded-2xl border border-[#D9CCFF] bg-[#F8F5FF] p-4 mb-3">
                  <View className="flex-row items-center justify-between">
                    <Typography font="inter-semibold" className="text-[#2F2A5A]">
                      {formatDate(clip.recordingStart)}
                    </Typography>

                    <View className="px-2 py-1 rounded-full bg-[#E5DCFF]">
                      <Typography font="inter-medium" className="text-[#6155F5] text-xs">
                        Processed
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

                    <Typography className="text-[#5B5685]" numberOfLines={1}>
                      <Typography font="inter-semibold">Ref:</Typography> {clip.clipId}
                    </Typography>
                  </View>

                  <Pressable
                    onPress={() => void handlePlay(clip)}
                    disabled={playingClipId === clip.clipId}
                    className="mt-4 rounded-xl bg-[#6155F5] px-4 py-3 flex-row items-center justify-center active:opacity-70">
                    {playingClipId === clip.clipId ? (
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
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
