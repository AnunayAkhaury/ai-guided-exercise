import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent } from 'expo';
import { router, useLocalSearchParams } from 'expo-router';
import { ExerciseType } from '@/src/components/session/exercise-sheet';
import { getFeedbackFromRef, ExerciseFeedback } from '@/src/api/Firebase/firebase-feedback';

export const EXERCISE_TITLE_MAP: Record<ExerciseType, string> = {
  lunge: 'Lunges',
  pushup: 'Pushups'
};

export default function RecordingDisplay() {
  const { link, title, feedbackRef } = useLocalSearchParams();
  const refId = Array.isArray(feedbackRef) ? feedbackRef[0] : feedbackRef;
  const videoLink = Array.isArray(link) ? link[0] : link;
  const [feedbackDocument, setFeedbackDocument] = useState<ExerciseFeedback | null>(null);

  const player = useVideoPlayer(videoLink || '', (p) => {
    p.loop = true;
    p.timeUpdateEventInterval = 0.05;
    p.play();
  });

  const timeUpdateEvent = useEvent(player, 'timeUpdate');
  const currentTimeMs = (timeUpdateEvent?.currentTime ?? 0) * 1000;
  const activeFeedback = feedbackDocument?.data.find((item) => {
    const start = Number(item.timestampStart);
    const end = Number(item.timestampEnd) <= start ? start + 2500 : Number(item.timestampEnd);
    return currentTimeMs >= start && currentTimeMs <= end;
  });

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        const data = await getFeedbackFromRef(refId || '');
        if (data) setFeedbackDocument(data);
      } catch (err) {
        console.error('Failed to fetch feedback:', err);
      }
    };
    if (refId) fetchFeedback();
  }, [refId]);

  if (!videoLink) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            marginTop: 20,
            padding: 10,
            backgroundColor: '#C3F5FF',
            borderRadius: 8,
            alignSelf: 'flex-start'
          }}>
          <Text style={{ color: '#000', fontWeight: 'bold' }}>← Back</Text>
        </TouchableOpacity>
        <Text>Unable to load recording.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={{
          marginBottom: 20,
          padding: 10,
          backgroundColor: '#6155F5',
          borderRadius: 8,
          alignSelf: 'flex-start'
        }}>
        <Text style={{ color: '#FFF', fontWeight: 'bold' }}>← Back</Text>
      </TouchableOpacity>

      <Text className="text-2xl font-bold mb-2">{EXERCISE_TITLE_MAP[title as ExerciseType]}</Text>

      <VideoView player={player} allowsFullscreen style={{ width: '100%', height: 250, backgroundColor: 'black' }} />

      {activeFeedback ? (
        <Text className="text-lg m-2" numberOfLines={2} ellipsizeMode="tail">
          {activeFeedback.feedback}
        </Text>
      ) : (
        <Text className="text-lg m-2" numberOfLines={2}>
          -
        </Text>
      )}

      <View className="mt-2 px-4">
        {feedbackDocument && (
          <View className="rounded-3xl border border-[#D9CCFF] bg-[#F8F5FF] p-6 shadow-sm">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <Text className="text-[#3E3A67] text-lg font-bold">{EXERCISE_TITLE_MAP[title as ExerciseType]}</Text>
                <Text className="text-[#3E3A67] text-lg"> Summary</Text>
              </View>

              <View className="flex-row items-center bg-white px-3 py-1 rounded-full border border-[#E5DCFF]">
                <Text className="text-[#6155F5] text-xs font-bold">Score: {feedbackDocument.score}/10</Text>
              </View>
            </View>

            <Text className="text-[#5B5685] leading-6 text-base">{feedbackDocument.summary}</Text>

            <View className="mt-4 pt-4 border-t border-[#E5DCFF] flex-row items-center justify-between">
              <Text className="text-[#6155F5] text-xs font-semibold">{feedbackDocument.data.length} Reps Detected</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
