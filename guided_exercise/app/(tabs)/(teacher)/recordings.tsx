import React, { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import ExerciseClipBrowser from '@/src/components/recordings/ExerciseClipBrowser';
import { getIvsClipPlayback, getIvsClipsByUserId, type IvsClip } from '@/src/api/ivs';
import { useUserStore } from '@/src/store/userStore';

export default function TeacherRecordingSession() {
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

  const handlePlay = useCallback(async (clip: IvsClip) => {
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
      Alert.alert('Playback failed', error?.message || 'Unable to load this clip.');
    } finally {
      setPlayingClipId(null);
    }
  }, []);

  return (
    <ExerciseClipBrowser
      clips={clips}
      loading={loading}
      refreshing={refreshing}
      playingClipId={playingClipId}
      onRefresh={onRefresh}
      onPlay={handlePlay}
    />
  );
}
