import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
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
  onInStageChange?: (inStage: boolean) => void;
  localParticipantLabel?: string;
  participantNamesById?: Record<string, string>;
};

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function getParticipantDisplayName(participant: Participant): string {
  const candidate = participant as any;
  const attributes =
    candidate?.attributes ??
    candidate?.info?.attributes ??
    candidate?.userInfo?.attributes ??
    candidate?.participantInfo?.attributes;

  return (
    firstNonEmptyString(
      attributes?.username,
      attributes?.userName,
      attributes?.displayName,
      candidate?.userName,
      candidate?.userId,
      candidate?.displayName,
      candidate?.info?.userName,
      candidate?.info?.userId,
      candidate?.info?.displayName,
      candidate?.userInfo?.userName,
      candidate?.userInfo?.userId,
      candidate?.participantInfo?.userName,
      candidate?.participantInfo?.userId
    ) ?? participant.id
  );
}

export default function IvsCall({
  token,
  publishOnJoin = true,
  onLeave,
  onInStageChange,
  localParticipantLabel,
  participantNamesById
}: IvsCallProps) {
  const [isInStage, setIsInStage] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(true);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const publishOnJoinRef = useRef(publishOnJoin);
  const isAudioMutedRef = useRef(isAudioMuted);
  const hasJoinAttemptRef = useRef(false);

  const { participants } = useStageParticipants() as { participants: Participant[] };
  const remoteParticipants = useMemo(() => {
    return participants
      .map((participant) => {
        const videoStreams = participant.streams.filter((stream) => stream.mediaType === 'video');
        const videoStream = videoStreams[videoStreams.length - 1];
        if (!videoStream) {
          return null;
        }
        return {
          participantId: participant.id,
          displayName: getParticipantDisplayName(participant),
          deviceUrn: videoStream.deviceUrn
        };
      })
      .filter((value): value is { participantId: string; displayName: string; deviceUrn: string } => Boolean(value));
  }, [participants]);

  useEffect(() => {
    publishOnJoinRef.current = publishOnJoin;
  }, [publishOnJoin]);

  useEffect(() => {
    isAudioMutedRef.current = isAudioMuted;
  }, [isAudioMuted]);

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
        if (!hasJoinAttemptRef.current) {
          // Ignore stale/shared-stage connection events until user explicitly joins this screen.
          return;
        }
        setIsInStage(true);
        setIsJoining(false);
        if (publishOnJoinRef.current) {
          // Ensure publish state is applied after the stage is actually connected.
          void (async () => {
            try {
              await setStreamsPublished(true);
              await setCameraMuted(false);
              await setMicrophoneMuted(isAudioMutedRef.current);
              setIsVideoMuted(false);
              setIsAudioMuted(isAudioMutedRef.current);
            } catch (publishError: any) {
              setError(publishError?.message || 'Failed to start publishing.');
            }
          })();
        }
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

  useEffect(() => {
    onInStageChange?.(isInStage);
  }, [isInStage, onInStageChange]);

  const join = async () => {
    if (!token) {
      setError('No token provided.');
      return;
    }

    setIsJoining(true);
    setStatus('Initializing Stage...');
    setError('');
    hasJoinAttemptRef.current = true;

    try {
      // Ensure stale connections are cleared before joining a new class on shared stage.
      await leaveStage();

      // prepare SDK configurations
      await initializeStage();
      
      // Only publishers need local camera/microphone streams.
      if (publishOnJoin) {
        await initializeLocalStreams();
      }

      // connect to the stage using token
      await joinStage(token);

    } catch (err: any) {
      setError(err.message || 'Failed to join stage.');
      setIsJoining(false);
      hasJoinAttemptRef.current = false;
    }
  };

  const handleLeave = async () => {
    hasJoinAttemptRef.current = false;
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
      <View style={styles.preJoinContainer}>
        <View style={styles.joinCard}>
          <Text style={styles.joinTitle}>Welcome to Class</Text>
          <Text style={styles.joinSubtitle}>Join when you are ready.</Text>
          {!!status && <Text style={styles.status}>{status}</Text>}
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Pressable style={[styles.primaryButton, isJoining && styles.disabledButton]} onPress={join} disabled={isJoining}>
            <Text style={styles.primaryButtonText}>{isJoining ? 'Joining...' : 'Join Session'}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // show stage view with other participants
  return (
    <View style={styles.container}>
      <ScrollView style={styles.videoContainer} contentContainerStyle={styles.videoContent}>
        {publishOnJoin && (
          <View style={styles.participantWrapper}>
            <View style={styles.participantLabelPill}>
              <Text style={styles.participantLabel}>{localParticipantLabel?.trim() || 'You'}</Text>
            </View>
            <ExpoIVSStagePreviewView style={styles.videoFrame} />
          </View>
        )}

        {remoteParticipants.map((participant) => (
          <View key={`${participant.participantId}:${participant.deviceUrn}`} style={styles.participantWrapper}>
            <View style={styles.participantLabelPill}>
              <Text style={styles.participantLabel}>
                {participantNamesById?.[participant.participantId] || participant.displayName}
              </Text>
            </View>
            <ExpoIVSRemoteStreamView
              participantId={participant.participantId}
              deviceUrn={participant.deviceUrn}
              style={styles.videoFrame}
              scaleMode="fit"
            />
          </View>
        ))}

        {remoteParticipants.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialIcons name="groups-2" size={28} color="#6155F5" />
            <Text style={styles.emptyStateTitle}>Waiting for others</Text>
            <Text style={styles.emptyStateText}>Other participants will appear here once they join.</Text>
          </View>
        )}
      </ScrollView>

      {!!status && <Text style={styles.statusInline}>{status}</Text>}
      {!!error && <Text style={styles.errorInline}>{error}</Text>}

      <View style={styles.controlBar}>
        <Pressable style={[styles.controlButton, !publishOnJoin && styles.disabledButton]} onPress={toggleAudio} disabled={!publishOnJoin}>
          <Ionicons name={isAudioMuted ? 'mic-off' : 'mic'} size={18} color="#fff" />
          <Text style={styles.controlButtonText}>{isAudioMuted ? 'Unmute' : 'Mute'}</Text>
        </Pressable>
        <Pressable style={[styles.controlButton, !publishOnJoin && styles.disabledButton]} onPress={toggleVideo} disabled={!publishOnJoin}>
          <Ionicons name={isVideoMuted ? 'videocam-off' : 'videocam'} size={18} color="#fff" />
          <Text style={styles.controlButtonText}>{isVideoMuted ? 'Start Cam' : 'Stop Cam'}</Text>
        </Pressable>
        <Pressable style={styles.endCallButton} onPress={handleLeave}>
          <Ionicons name="call" size={18} color="#fff" />
          <Text style={styles.controlButtonText}>Leave</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    paddingTop: 12,
    paddingBottom: 14
  },
  preJoinContainer: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'center',
    paddingBottom: '16%'
  },
  joinCard: {
    marginHorizontal: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 26,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#E3E2FF',
    shadowColor: '#4C40D9',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 6
  },
  joinTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1D1C2B',
    textAlign: 'center'
  },
  joinSubtitle: {
    marginTop: 6,
    textAlign: 'center',
    color: '#5D5A7A'
  },
  primaryButton: {
    backgroundColor: '#6155F5',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 14
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15
  },
  videoContainer: { flex: 1, width: '100%' },
  videoContent: {
    paddingHorizontal: 14,
    paddingBottom: 10
  },
  participantWrapper: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#101015',
    borderWidth: 2,
    borderColor: '#E5E3FF'
  },
  participantLabelPill: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 10,
    backgroundColor: 'rgba(97, 85, 245, 0.85)',
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 4
  },
  participantLabel: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12
  },
  videoFrame: { width: '100%', height: 220 },
  emptyState: {
    borderWidth: 1,
    borderColor: '#D8D5FF',
    backgroundColor: '#F7F6FF',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center'
  },
  emptyStateTitle: {
    marginTop: 8,
    fontWeight: '700',
    color: '#302E47'
  },
  emptyStateText: {
    marginTop: 4,
    color: '#5D5A7A',
    textAlign: 'center'
  },
  status: { color: '#5A5678', textAlign: 'center', marginTop: 10 },
  error: { color: '#7A3FF2', textAlign: 'center', marginTop: 8 },
  statusInline: {
    color: '#4E4A75',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 6
  },
  errorInline: {
    color: '#7A3FF2',
    textAlign: 'center',
    marginBottom: 6
  },
  controlBar: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 8
  },
  controlButton: {
    flex: 1,
    backgroundColor: '#6155F5',
    borderRadius: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  endCallButton: {
    flex: 1,
    backgroundColor: '#A980FE',
    borderRadius: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  controlButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13
  },
  disabledButton: {
    opacity: 0.5
  }
});
