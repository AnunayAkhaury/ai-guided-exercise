import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { router, useLocalSearchParams } from 'expo-router';
import { ExerciseType } from '@/src/components/session/exercise-sheet';
import { getFeedbackFromRef, ExerciseFeedback } from '@/src/api/Firebase/firebase-feedback';

export const EXERCISE_TITLE_MAP: Record<ExerciseType, string> = {
  lunge: 'Lunges',
  pushup: 'Pushups'
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
          backgroundColor: '#C3F5FF',
          borderRadius: 8,
          alignSelf: 'flex-start'
        }}>
        <Text style={{ color: '#000', fontWeight: 'bold' }}>← Back</Text>
      </TouchableOpacity>
      <Text className="text-2xl">{EXERCISE_TITLE_MAP[title as ExerciseType]}</Text>
      <VideoView player={player} allowsFullscreen style={{ width: '100%', height: 250, backgroundColor: 'black' }} />
      {feedbackDocument && <Text className="text-lg mt-4">{feedbackDocument.summary}</Text>}
    </View>
  );
}
