import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { router, useLocalSearchParams } from 'expo-router';
import { ExerciseType } from '@/src/components/session/exercise-sheet';
import { getFeedbackFromRef, ExerciseFeedback } from '@/src/api/Firebase/firebase-feedback';

export const EXERCISE_TITLE_MAP: Record<ExerciseType, string> = {
  lunge: 'Lunges',
  pushup: 'Push Ups'
};

export default function RecordingDisplay() {
  const { link, title, feedback, feedbackRef } = useLocalSearchParams();
  const refId = Array.isArray(feedbackRef) ? feedbackRef[0] : feedbackRef;
  const videoLink = Array.isArray(link) ? link[0] : link;
  const [feedbackDocument, setFeedbackDocument] = useState<ExerciseFeedback | null>(null);

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        const feedback = await getFeedbackFromRef(refId || '');
        if (feedback) {
          setFeedbackDocument(feedback);
        }
      } catch (err) {
        console.error('Failed to fetch feedback:', err);
      }
    };

    if (refId) {
      fetchFeedback();
    }
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

  const player = useVideoPlayer(videoLink, (p) => p.play());

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
      <VideoView player={player} allowsFullscreen style={{ width: '100%', height: 250, backgroundColor: 'black' }} />
      <View className="mt-6 px-4">
        {feedbackDocument && (
          <View className="rounded-3xl border border-[#D9CCFF] bg-[#F8F5FF] p-6 shadow-sm">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-[#3E3A67] text-lg">{EXERCISE_TITLE_MAP[title as ExerciseType]} Summary</Text>
              <View className="flex-row items-center bg-white px-3 py-1 rounded-full border border-[#E5DCFF]">
                <Text className="ml-2 text-[#6155F5] text-xs">Score: {feedbackDocument.score}/10</Text>
              </View>
            </View>

            <Text className="text-[#5B5685] leading-6 text-base">{feedbackDocument.summary}</Text>

            <View className="mt-4 pt-4 border-t border-[#E5DCFF] flex-row items-center justify-between">
              <Text className="text-[#6155F5] text-xs">{feedbackDocument.data.length} Reps Detected</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
