import React, { useEffect, useState } from 'react';
import { Button, StyleSheet, Text, View, ScrollView } from 'react-native';
import {
  initializeStage,
  initializeLocalStreams,
  joinStage,
  leaveStage,
  setStreamsPublished,
  setMicrophoneMuted,
  setCameraMuted,
  useStageParticipants,
  ExpoIVSStagePreviewView,
  ExpoIVSRemoteStreamView,
  addOnStageConnectionStateChangedListener
} from 'expo-realtime-ivs-broadcast';
import type { Participant } from 'expo-realtime-ivs-broadcast';

type IvsCallProps = {
  token?: string;
  publishOnJoin?: boolean;
  onLeave?: () => void;
};

export default function IvsCall({ token, publishOnJoin = true, onLeave }: IvsCallProps) {
  const [isInStage, setIsInStage] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(true);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const { participants } = useStageParticipants() as { participants: Participant[] };

  useEffect(() => {
    console.log(
      '[IVS][Client] participants',
      participants.map((p) => ({
        id: p.id,
        videoStreams: p.streams.filter((s) => s.mediaType === 'video').map((s) => s.deviceUrn)
      }))
    );
  }, [participants]);

  useEffect(() => {
    // setup the connection listener
    const connectionListener = addOnStageConnectionStateChangedListener(({ state, error: connError }) => {
      setStatus(`State: ${state}`);
      
      if (state === 'connected') {
        setIsInStage(true);
        setIsJoining(false);
      } else if (state === 'disconnected') {
        setIsInStage(false);
      }
      
      if (connError) setError(connError);
    });

    // cleanup when component unmounts
    return () => {
      connectionListener.remove();
      leaveStage();
    };
  }, []);

  const join = async () => {
    if (!token) {
      setError('No token provided.');
      return;
    }

    setIsJoining(true);
    setStatus('Initializing Stage...');
    setError('');

    try {
      // prepare SDK configurations
      await initializeStage();
      
      // Only publishers need local camera/microphone streams.
      if (publishOnJoin) {
        await initializeLocalStreams();
      }

      // connect to the stage using token
      await joinStage(token);

      // start broadcasting local streams only when participant has publish capability
      if (publishOnJoin) {
        await setStreamsPublished(true);
      }
      
      // Sync initial mute state (only relevant if publishing is enabled)
      if (publishOnJoin) {
        await setMicrophoneMuted(isAudioMuted);
      }

    } catch (err: any) {
      setError(err.message || 'Failed to join stage.');
      setIsJoining(false);
    }
  };

  const handleLeave = async () => {
    await leaveStage();
    if (onLeave) onLeave();
  };

  const toggleAudio = async () => {
    if (!publishOnJoin) {
      setError('Audio controls are disabled for view-only participants.');
      return;
    }
    const willMute = !isAudioMuted;
    await setMicrophoneMuted(willMute);
    setIsAudioMuted(willMute);
  };

  const toggleVideo = async () => {
    if (!publishOnJoin) {
      setError('Video controls are disabled for view-only participants.');
      return;
    }
    const willMute = !isVideoMuted;
    await setCameraMuted(willMute);
    setIsVideoMuted(willMute);
  };

  // not in session yet, show join screen
  if (!isInStage) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Welcome to Class</Text>
        <Text style={styles.heading}>Click Join Session When Ready</Text>
        <View style={styles.spacer} />
        {!!status && <Text style={styles.status}>{status}</Text>}
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Button title={isJoining ? 'Joining...' : 'Join Session'} onPress={join} disabled={isJoining} />
      </View>
    );
  }

  // show stage view with other participants
  return (
    <View style={styles.container}>
      <ScrollView style={styles.videoContainer}>
        
        {publishOnJoin && (
          <View style={styles.participantWrapper}>
            <Text style={styles.participantLabel}>You</Text>
            <ExpoIVSStagePreviewView style={styles.videoFrame} />
          </View>
        )}

        {/* other participants */}
        {participants.map((participant) => {
          const videoStream = participant.streams.find((stream) => stream.mediaType === 'video');
          if (!videoStream) {
            return null;
          }
          return (
            <View key={participant.id} style={styles.participantWrapper}>
              <Text style={styles.participantLabel}>{participant.id}</Text>
              <ExpoIVSRemoteStreamView
                participantId={participant.id}
                deviceUrn={videoStream.deviceUrn}
                style={styles.videoFrame}
                scaleMode="fill"
              />
            </View>
          );
        })}

      </ScrollView>

      <View style={styles.buttonHolder}>
        <Button
          title={isAudioMuted ? 'Unmute Audio' : 'Mute Audio'}
          onPress={toggleAudio}
          disabled={!publishOnJoin}
        />
        <View style={styles.spacer} />
        <Button
          title={isVideoMuted ? 'Start Video' : 'Stop Video'}
          onPress={toggleVideo}
          disabled={!publishOnJoin}
        />
      </View>
      
      <View style={styles.spacer} />
      <Button title="Leave Session" color="#f01040" onPress={handleLeave} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', alignSelf: 'center', justifyContent: 'center', paddingVertical: 24 },
  videoContainer: { flex: 1, width: '100%', paddingHorizontal: 16 },
  participantWrapper: { marginBottom: 16, borderRadius: 8, overflow: 'hidden', backgroundColor: '#000' },
  participantLabel: { position: 'absolute', top: 8, left: 8, zIndex: 10, color: '#fff', backgroundColor: 'rgba(0,0,0,0.5)', padding: 4 },
  videoFrame: { width: '100%', height: 250 },
  heading: { fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  status: { color: 'gray', textAlign: 'center', marginBottom: 8 },
  error: { color: 'red', textAlign: 'center', marginBottom: 8 },
  buttonHolder: { flexDirection: 'row', justifyContent: 'center', width: '100%', marginTop: 16 },
  spacer: { height: 16, width: 16 }
});
