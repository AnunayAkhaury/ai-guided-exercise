import React, { useEffect, useState } from 'react';
import { Button, StyleSheet, Text, View, ScrollView } from 'react-native';
import {
  initializeStage,
  initializeLocalStreams,
  joinStage,
  leaveStage,
  setStreamsPublished,
  setMicrophoneMuted,
  useStageParticipants,
  ExpoIVSStagePreviewView,
  ExpoIVSRemoteStreamView,
  addOnStageConnectionStateChangedListener
} from 'expo-realtime-ivs-broadcast';

type IvsCallProps = {
  token?: string;
  onLeave?: () => void;
};

export default function IvsCall({ token, onLeave }: IvsCallProps) {
  const [isInStage, setIsInStage] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  // replaces Zoom's manual listener mapping for users.
  const remoteParticipants = useStageParticipants();

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
      
      // request perms and prep local cam/mic
      await initializeLocalStreams();

      // connect to the stage using token
      await joinStage(token);

      // start broadcasting local streams to others
      await setStreamsPublished(true);
      
      // Sync initial mute state
      await setMicrophoneMuted(isAudioMuted);

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
    const willMute = !isAudioMuted;
    await setMicrophoneMuted(willMute);
    setIsAudioMuted(willMute);
  };

  const toggleVideo = async () => {
    console.log("Toggle video triggered");
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
        
        {/* local participant */}
        <View style={styles.participantWrapper}>
          <Text style={styles.participantLabel}>You</Text>
          <ExpoIVSStagePreviewView style={styles.videoFrame} />
        </View>

        {/* other participants */}
        {remoteParticipants.map((participant) => (
          <View key={participant.participantId} style={styles.participantWrapper}>
             <Text style={styles.participantLabel}>{participant.participantId}</Text>
             {/* Render the remote streams natively */}
             <ExpoIVSRemoteStreamView 
               participantId={participant.participantId} 
               style={styles.videoFrame} 
             />
          </View>
        ))}

      </ScrollView>

      <View style={styles.buttonHolder}>
        <Button title={isAudioMuted ? 'Unmute Audio' : 'Mute Audio'} onPress={toggleAudio} />
        <View style={styles.spacer} />
        <Button title="Toggle Video" onPress={toggleVideo} />
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