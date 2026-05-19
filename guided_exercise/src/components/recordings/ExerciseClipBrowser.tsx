import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '@/src/components/ui/Header';
import Typography from '@/src/components/ui/Typography';
import type { IvsClip } from '@/src/api/ivs';
import { EXERCISE_TITLE_MAP } from '@/src/constants/exerciseMap';

type ClipSessionGroup = {
  key: string;
  title: string;
  latestStart: number;
  items: IvsClip[];
  exercises: string[];
};

type ExerciseClipBrowserProps = {
  clips: IvsClip[];
  loading: boolean;
  refreshing: boolean;
  playingClipId: string | null;
  onRefresh: () => void;
  onPlay: (clip: IvsClip) => void;
};

function toTimestamp(value?: string | null): number {
  if (!value) return 0;
  const timestamp = Number(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatDate(value?: string | null) {
  const timestamp = toTimestamp(value);
  if (!timestamp) return 'Unknown date';

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

function formatTime(value?: string | null) {
  const timestamp = toTimestamp(value);
  if (!timestamp) return 'Unknown time';

  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return 'Unknown time';

  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatDuration(value?: string | null) {
  const durationMs = Number(value);
  if (!value || !Number.isFinite(durationMs) || durationMs < 1000) return '0s';

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

function formatClipTimeRange(clip: IvsClip) {
  const startMs = toTimestamp(clip.starttime);
  const durationMs = Number(clip.duration);

  if (!startMs || !Number.isFinite(durationMs) || durationMs <= 0) {
    return formatTime(clip.starttime);
  }

  return `${formatTime(clip.starttime)} - ${formatTime(String(startMs + durationMs))}`;
}

function formatExercise(exercise: string) {
  return EXERCISE_TITLE_MAP[exercise] ?? exercise;
}

function buildSessionGroups(clips: IvsClip[]): ClipSessionGroup[] {
  const sortedClips = [...clips].sort((a, b) => toTimestamp(b.starttime) - toTimestamp(a.starttime));
  const groups = new Map<string, ClipSessionGroup>();

  sortedClips.forEach((clip) => {
    const sessionId = clip.sessionId?.trim();
    const recordingId = clip.recordingId?.trim();
    const key = sessionId || recordingId || 'legacy-clips';
    const existing = groups.get(key);
    const title = clip.sessionName?.trim() || (sessionId ? 'Untitled session' : 'Legacy clips');
    const startTime = toTimestamp(clip.starttime);
    const exerciseTitle = formatExercise(clip.exercise);

    if (existing) {
      existing.items.push(clip);
      existing.latestStart = Math.max(existing.latestStart, startTime);
      if (!existing.exercises.includes(exerciseTitle)) existing.exercises.push(exerciseTitle);
      if (existing.title === 'Untitled session' && title !== 'Untitled session') existing.title = title;
      return;
    }

    groups.set(key, {
      key,
      title,
      latestStart: startTime,
      items: [clip],
      exercises: [exerciseTitle]
    });
  });

  return Array.from(groups.values()).sort((a, b) => b.latestStart - a.latestStart);
}

export default function ExerciseClipBrowser({
  clips,
  loading,
  refreshing,
  playingClipId,
  onRefresh,
  onPlay
}: ExerciseClipBrowserProps) {
  const { width, height } = useWindowDimensions();
  const isSmallPhone = width < 380 || height < 760;
  const horizontalPadding = isSmallPhone ? 14 : 18;
  const [selectedSessionKey, setSelectedSessionKey] = useState<string | null>(null);

  const sessionGroups = useMemo(() => buildSessionGroups(clips), [clips]);
  const selectedSession = selectedSessionKey
    ? sessionGroups.find((group) => group.key === selectedSessionKey) ?? null
    : null;

  useEffect(() => {
    if (selectedSessionKey && !sessionGroups.some((group) => group.key === selectedSessionKey)) {
      setSelectedSessionKey(null);
    }
  }, [selectedSessionKey, sessionGroups]);

  return (
    <View className="flex-1 bg-white">
      <Header title={selectedSession ? selectedSession.title : 'Exercise Clips'} />

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
              Generated exercise clips will appear here after your session is processed.
            </Typography>
          </View>
        ) : selectedSession ? (
          <View>
            <Pressable
              onPress={() => setSelectedSessionKey(null)}
              className="self-start rounded-full bg-[#EFE9FF] px-4 py-2 flex-row items-center mb-4 active:opacity-70">
              <Ionicons name="chevron-back" size={18} color="#6155F5" />
              <Typography font="inter-semibold" className="text-[#6155F5] ml-1">
                Sessions
              </Typography>
            </Pressable>

            <View className="rounded-2xl border border-[#D9CCFF] bg-[#F8F5FF] p-4 mb-4">
              <Typography font="inter-semibold" className="text-[#2F2A5A] text-lg">
                {selectedSession.title}
              </Typography>
              <Typography className="text-[#6C6896] mt-1">
                {selectedSession.items.length} {selectedSession.items.length === 1 ? 'clip' : 'clips'} from{' '}
                {formatDate(String(selectedSession.latestStart))}
              </Typography>
            </View>

            {selectedSession.items.map((clip) => (
              <View key={clip.id} className="rounded-2xl border border-[#D9CCFF] bg-[#F8F5FF] p-4 mb-3">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-3">
                    <Typography font="inter-semibold" className="text-[#2F2A5A] text-base">
                      {formatExercise(clip.exercise)}
                    </Typography>
                    <Typography className="text-[#5B5685] mt-1">
                      {formatClipTimeRange(clip)}
                    </Typography>
                  </View>

                  <View className="px-2 py-1 rounded-full bg-[#E5DCFF]">
                    <Typography font="inter-medium" className="text-[#6155F5] text-xs">
                      Processed
                    </Typography>
                  </View>
                </View>

                <View className="mt-3">
                  <Typography className="text-[#5B5685]">
                    <Typography font="inter-semibold">Duration:</Typography> {formatDuration(clip.duration)}
                  </Typography>
                  <Typography className="text-[#5B5685] mt-1">
                    <Typography font="inter-semibold">Recorded:</Typography> {formatDate(clip.starttime)}
                  </Typography>
                </View>

                <Pressable
                  onPress={() => onPlay(clip)}
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
              </View>
            ))}
          </View>
        ) : (
          <View>
            <Typography font="inter-semibold" className="text-[#3E3A67] text-base mb-3">
              Sessions
            </Typography>

            {sessionGroups.map((group) => (
              <Pressable
                key={group.key}
                onPress={() => setSelectedSessionKey(group.key)}
                className="rounded-2xl border border-[#D9CCFF] bg-[#F8F5FF] p-4 mb-3 active:opacity-75">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-4">
                    <Typography font="inter-semibold" className="text-[#2F2A5A] text-base">
                      {group.title}
                    </Typography>
                    <Typography className="text-[#6C6896] mt-1">{formatDate(String(group.latestStart))}</Typography>
                  </View>

                  <View className="flex-row items-center">
                    <View className="px-2 py-1 rounded-full bg-[#E5DCFF] mr-2">
                      <Typography font="inter-medium" className="text-[#6155F5] text-xs">
                        {group.items.length} {group.items.length === 1 ? 'clip' : 'clips'}
                      </Typography>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#6155F5" />
                  </View>
                </View>

                <Typography className="text-[#5B5685] mt-3" numberOfLines={2}>
                  {group.exercises.join(', ')}
                </Typography>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
