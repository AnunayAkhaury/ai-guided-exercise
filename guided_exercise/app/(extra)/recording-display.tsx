import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { router, useLocalSearchParams } from 'expo-router';

export default function RecordingDisplay() {
  const { link } = useLocalSearchParams();
  const videoLink = Array.isArray(link) ? link[0] : link;

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

      <VideoView player={player} allowsFullscreen style={{ width: '100%', height: 250, backgroundColor: 'black' }} />
    </View>
  );
}
