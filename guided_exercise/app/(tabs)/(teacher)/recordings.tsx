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
import { getIvsRecordingPlayback, IvsClipWithDate, listIvsClipsByUser } from '@/src/api/ivs';
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

export default function TeacherRecordingsScreen() {
  const { width, height } = useWindowDimensions();
  const isSmallPhone = width < 380 || height < 760;
  const horizontalPadding = isSmallPhone ? 14 : 18;
  const uid = useUserStore((state) => state.uid);

  const [clips, setClips] = useState<IvsClipWithDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(null);

  const loadRecordings = useCallback(async () => {
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
        await loadRecordings();
      } catch (error: any) {
        Alert.alert('Unable to load recordings', error?.message || 'Please try again.');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [loadRecordings]);

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

  const groupedClips = useMemo(() => {
    return clips.reduce<Record<string, IvsClipWithDate[]>>((acc, clip) => {
      const key = clip.recordingStart
        ? new Date(clip.recordingStart).toLocaleString(undefined, { month: 'long', year: 'numeric' })
        : 'Unknown';
      if (!acc[key]) acc[key] = [];
      acc[key].push(clip);
      return acc;
    }, {});
  }, [clips]);

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
        contentContainerStyle={{ paddingHorizontal: horizontalPadding, paddingBottom: 30, paddingTop: 16 }}>
        {loading ? (
          <View className="items-center pt-12">
            <ActivityIndicator color="#6155F5" />
            <Typography className="mt-3 text-[#666]">Loading recordings...</Typography>
          </View>
        ) : clips.length === 0 ? (
          <View className="rounded-2xl border border-[#D9CCFF] bg-[#F8F5FF] p-6 items-center mt-3">
            <Ionicons name="videocam-outline" size={24} color="#6155F5" />
            <Typography font="inter-semibold" className="text-[#342F66] text-base mt-3">
              No recordings yet
            </Typography>
            <Typography className="text-[#6C6896] text-center mt-2">
              Your processed class recordings will appear here after session recording completes.
            </Typography>
          </View>
        ) : (
          Object.entries(groupedClips).map(([group, items]) => (
            <View key={group} className="mb-6">
              <Typography font="inter-semibold" className="text-[#3E3A67] text-base mb-3">
                {group}
              </Typography>
              {items.map((clip, index) => (
                <View
                  key={`${clip.recordingId}-${index}`}
                  className="rounded-2xl border border-[#D9CCFF] bg-[#F8F5FF] p-4 mb-3">
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

                  <Typography className="text-[#5B5685] mt-2">Duration: {clip.duration}</Typography>

                  <Typography className="text-[#5B5685] mt-1">Exercise: {clip.exercise}</Typography>

                  {clip.recordingId ? (
                    <Typography className="text-[#5B5685] mt-1" numberOfLines={1}>
                      Session: {clip.recordingId}
                    </Typography>
                  ) : null}

                  <Pressable
                    onPress={() => void handlePlay(clip.recordingId)}
                    disabled={playingRecordingId === clip.recordingId}
                    className="mt-4 rounded-xl bg-[#6155F5] px-4 py-3 flex-row items-center justify-center">
                    {playingRecordingId === clip.recordingId ? (
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
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
