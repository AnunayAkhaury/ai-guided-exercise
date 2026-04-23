import React from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserStore } from '@/src/store/userStore';

export default function RecordingDisplayNative() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { link } = useLocalSearchParams();
  const role = useUserStore((state) => state.role);
  const videoLink = Array.isArray(link) ? link[0] : link;

  const goBackToRecordings = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    const fallbackRoute =
      role === 'instructor'
        ? '/(tabs)/(teacher)/recordings'
        : '/(tabs)/(student)/recordings';

    router.replace(fallbackRoute);
  };

  if (!videoLink) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingBottom: 20,
          paddingTop: insets.top + 16
        }}
      >
        <TouchableOpacity
          onPress={goBackToRecordings}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 12,
            backgroundColor: '#C3F5FF',
            borderRadius: 10,
            alignSelf: 'flex-start'
          }}
        >
          <Text style={{ color: '#000', fontWeight: 'bold' }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ marginTop: 16 }}>Unable to load recording.</Text>
      </View>
    );
  }

  const player = useVideoPlayer(videoLink, (p) => p.play());
  const maxWidth = Math.min(width - 32, 900);
  const maxHeight = Math.min(height - insets.top - insets.bottom - 160, 720);
  const playerHeight = Math.max(280, Math.min(maxHeight, Math.round(maxWidth * 0.5625)));

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#F4F3FF',
        paddingHorizontal: 20,
        paddingBottom: 20,
        paddingTop: insets.top + 12
      }}
    >
      <TouchableOpacity
        onPress={goBackToRecordings}
        style={{
          marginBottom: 20,
          paddingHorizontal: 14,
          paddingVertical: 12,
          backgroundColor: '#C3F5FF',
          borderRadius: 10,
          alignSelf: 'flex-start'
        }}
      >
        <Text style={{ color: '#000', fontWeight: 'bold' }}>← Back</Text>
      </TouchableOpacity>

      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <View
          style={{
            width: maxWidth,
            maxWidth: '100%',
            borderRadius: 24,
            overflow: 'hidden',
            backgroundColor: '#000000'
          }}
        >
          <VideoView
            player={player}
            allowsFullscreen
            style={{ width: '100%', height: playerHeight, backgroundColor: 'black' }}
          />
        </View>
      </View>
    </View>
  );
}
