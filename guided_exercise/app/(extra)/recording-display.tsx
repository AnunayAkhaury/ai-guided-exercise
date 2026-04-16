import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { router, useLocalSearchParams } from 'expo-router';
import useRecording from '@/src/hooks/useRecording';
import captions from "../../src/assets/images/StudentPushup-feedback.json";

export default function RecordingDisplay() {
  const { id } = useLocalSearchParams();
  const { data, loading, error } = useRecording(id);
  const [caption, setCaption] = useState("Empty");
  // const videoLink = Array.isArray(link) ? link[0] : link;

  const player = useVideoPlayer({
    uri: "https://www.w3schools.com/html/mov_bbb.mp4",
  });

  useEffect(() => {
    player.timeUpdateEventInterval = 0.25;

    const subscription = player.addListener(
      "timeUpdate",
      (event) => {
        const t = event.currentTime * 1000; // seconds
        console.log("Timestamp found ", t)

        const active = captions.data.find(
          (c) => t >= c.timestampStart - 1000 && t < c.timestampEnd + 1000
        );

        setCaption(active?.feedback ?? "Empty");
      }
    );


    return () => {
      subscription?.remove?.();
    };
  }, [player]);

  if (error) {
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
          backgroundColor: '#C3F5FF',
          borderRadius: 8,
          alignSelf: 'flex-start'
        }}>
        <Text style={{ color: '#000', fontWeight: 'bold' }}>← Back</Text>
      </TouchableOpacity>

      <VideoView
        player={player}
        style={{ width: '100%', height: 250 }}
        allowsFullscreen
        onLayout={() => {
          console.log("READY FOR DISPLAY");
          player.play();
          
        }}
      />

      <Text
        style={{
          marginBottom: 20,
          padding: 10,
          backgroundColor: '#C3F5FF',
          borderRadius: 8,
          alignSelf: 'flex-start'
        }}
      >{caption}
      </Text>
    </View>
  );
}
