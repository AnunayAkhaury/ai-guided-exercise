import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Camera } from 'expo-camera';
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
  participantRolesById?: Record<string, string>;
  localParticipantRole?: 'student' | 'instructor';
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

function selectPreferredVideoStream(streams: ({ mediaType: string; deviceUrn: string } & Record<string, any>)[]) {
  if (!streams.length) return null;
  const activeStream = streams.find((stream) => {
    const muted = stream?.isMuted ?? stream?.muted ?? false;
    const disabled = stream?.isDisabled ?? false;
    return !muted && !disabled;
  });
  // Fallback only when muted/disabled flags are not exposed by the SDK object.
  const streamWithoutFlags = streams.find((stream) => stream?.isMuted == null && stream?.isDisabled == null);
  return activeStream ?? streamWithoutFlags ?? null;
}

function isLocalParticipant(participant: Participant): boolean {
  const candidate = participant as any;
  return Boolean(
    candidate?.isLocal ??
      candidate?.local ??
      candidate?.info?.isLocal ??
      candidate?.userInfo?.isLocal ??
      candidate?.participantInfo?.isLocal
  );
}

export default function IvsCall({
  token,
  publishOnJoin = true,
  onLeave,
  onInStageChange,
  localParticipantLabel,
  participantNamesById,
  participantRolesById,
  localParticipantRole
}: IvsCallProps) {
  const { width, height } = useWindowDimensions();
  const isSmallPhone = width < 380 || height < 760;
  const isLargePhone = width >= 430;
  const localVideoHeight = isSmallPhone ? 190 : isLargePhone ? 250 : 220;
  const remoteVideoHeight = isSmallPhone ? 170 : isLargePhone ? 220 : 200;
  const gridVideoHeight = isSmallPhone ? 135 : isLargePhone ? 185 : 165;
  const controlBarPaddingBottom = isSmallPhone ? 6 : 10;
  const contentBottomPadding = isSmallPhone ? 6 : 14;

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
        if (isLocalParticipant(participant)) {
          return null;
        }
        const candidate = participant as any;
        const attributes =
          candidate?.attributes ??
          candidate?.info?.attributes ??
          candidate?.userInfo?.attributes ??
          candidate?.participantInfo?.attributes;
        const lookupKeys = [
          participant.id,
          candidate?.userId,
          candidate?.info?.userId,
          candidate?.participantId,
          candidate?.info?.participantId
        ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
        const resolvedRole =
          lookupKeys.map((key) => participantRolesById?.[key]).find(Boolean) ||
          firstNonEmptyString(
            attributes?.role,
            candidate?.role,
            candidate?.info?.role,
            candidate?.userInfo?.role,
            candidate?.participantInfo?.role
          );
        const videoStreams = participant.streams.filter((stream) => stream.mediaType === 'video') as ({
          mediaType: string;
          deviceUrn: string;
        } & Record<string, any>)[];
        const videoStream = selectPreferredVideoStream(videoStreams);
        return {
          participantId: participant.id,
          lookupKeys,
          role: typeof resolvedRole === 'string' ? resolvedRole.toLowerCase() : undefined,
          displayName: getParticipantDisplayName(participant),
          deviceUrn: videoStream?.deviceUrn ?? null,
          hasVideo: Boolean(videoStream)
        };
      })
      .filter(
        (
          value
        ): value is {
          participantId: string;
          lookupKeys: string[];
          role?: string;
          displayName: string;
          deviceUrn: string | null;
          hasVideo: boolean;
        } =>
          Boolean(value)
      )
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [participantRolesById, participants]);
  const localIsInstructor = localParticipantRole === 'instructor';
  const instructorRemote = useMemo(
    () => remoteParticipants.find((participant) => participant.role === 'instructor') ?? null,
    [remoteParticipants]
  );
  const remainingRemoteParticipants = useMemo(() => {
    if (!instructorRemote) return remoteParticipants;
    return remoteParticipants.filter((participant) => participant.participantId !== instructorRemote.participantId);
  }, [instructorRemote, remoteParticipants]);
  const includeLocalInGrid = publishOnJoin && !localIsInstructor;
  const totalStudentTiles = remainingRemoteParticipants.length + (includeLocalInGrid ? 1 : 0);
  const useGridForStudents = totalStudentTiles > 1;

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
      // prepare SDK configurations
      await initializeStage();
      
      // Only publishers need local camera/microphone streams.
      if (publishOnJoin) {
        const cameraPermission = await Camera.requestCameraPermissionsAsync();
        const microphonePermission = await Camera.requestMicrophonePermissionsAsync();
        if (cameraPermission.status !== 'granted' || microphonePermission.status !== 'granted') {
          throw new Error('Camera and microphone permissions are required to join the call.');
        }
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
    try {
      await setMicrophoneMuted(willMute);
      setIsAudioMuted(willMute);
    } catch (err: any) {
      setError(err?.message || 'Failed to update microphone state.');
    }
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
      <View style={[styles.preJoinContainer, isSmallPhone && styles.preJoinContainerCompact]}>
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
    <View style={[styles.container, { paddingBottom: contentBottomPadding }]}>
      <ScrollView style={styles.videoContainer} contentContainerStyle={styles.videoContent}>
        {publishOnJoin && localIsInstructor && (
          <View style={[styles.participantWrapper, styles.localParticipantWrapper]}>
            <View style={styles.participantLabelPill}>
              <Text style={styles.participantLabel}>{localParticipantLabel?.trim() || 'You'}</Text>
            </View>
            <View style={[styles.localVideoFrame, { height: localVideoHeight }]}>
              <ExpoIVSStagePreviewView style={StyleSheet.absoluteFillObject} />
              {isVideoMuted && (
                <View style={styles.cameraOffOverlay}>
                  <Ionicons name="videocam-off" size={30} color="#FFFFFF" />
                  <Text style={styles.cameraOffText}>Camera Off</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {!localIsInstructor && instructorRemote && (
          <View style={[styles.participantWrapper, styles.localParticipantWrapper]}>
            <View style={styles.participantLabelPill}>
              <Text style={styles.participantLabel}>
                {instructorRemote.lookupKeys.map((key) => participantNamesById?.[key]).find(Boolean) ||
                  instructorRemote.displayName}
              </Text>
            </View>
            {instructorRemote.hasVideo && instructorRemote.deviceUrn ? (
              <ExpoIVSRemoteStreamView
                participantId={instructorRemote.participantId}
                deviceUrn={instructorRemote.deviceUrn}
                style={[styles.remoteVideoFrame, { height: remoteVideoHeight }]}
                scaleMode="fill"
              />
            ) : (
              <View style={[styles.remoteVideoFrame, { height: remoteVideoHeight }]}>
                <View style={styles.cameraOffOverlay}>
                  <Ionicons name="videocam-off" size={30} color="#FFFFFF" />
                  <Text style={styles.cameraOffText}>Camera Off</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {includeLocalInGrid && (
          <View style={[styles.participantWrapper, useGridForStudents && styles.gridParticipantWrapper]}>
            <View style={styles.participantLabelPill}>
              <Text style={styles.participantLabel}>{localParticipantLabel?.trim() || 'You'}</Text>
            </View>
            <View
              style={[
                useGridForStudents ? styles.gridVideoFrame : styles.remoteVideoFrame,
                { height: useGridForStudents ? gridVideoHeight : remoteVideoHeight }
              ]}
            >
              <ExpoIVSStagePreviewView style={StyleSheet.absoluteFillObject} />
              {isVideoMuted && (
                <View style={styles.cameraOffOverlay}>
                  <Ionicons name="videocam-off" size={30} color="#FFFFFF" />
                  <Text style={styles.cameraOffText}>Camera Off</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {remainingRemoteParticipants.map((participant) => (
          <View
            key={`${participant.participantId}:${participant.deviceUrn}`}
            style={[styles.participantWrapper, useGridForStudents && styles.gridParticipantWrapper]}
          >
            <View style={styles.participantLabelPill}>
              <Text style={styles.participantLabel}>
                {participant.lookupKeys.map((key) => participantNamesById?.[key]).find(Boolean) || participant.displayName}
              </Text>
            </View>
            {participant.hasVideo && participant.deviceUrn ? (
              <ExpoIVSRemoteStreamView
                participantId={participant.participantId}
                deviceUrn={participant.deviceUrn}
                style={[
                  useGridForStudents ? styles.gridVideoFrame : styles.remoteVideoFrame,
                  { height: useGridForStudents ? gridVideoHeight : remoteVideoHeight }
                ]}
                scaleMode="fill"
              />
            ) : (
              <View
                style={[
                  useGridForStudents ? styles.gridVideoFrame : styles.remoteVideoFrame,
                  { height: useGridForStudents ? gridVideoHeight : remoteVideoHeight }
                ]}
              >
                <View style={styles.cameraOffOverlay}>
                  <Ionicons name="videocam-off" size={30} color="#FFFFFF" />
                  <Text style={styles.cameraOffText}>Camera Off</Text>
                </View>
              </View>
            )}
          </View>
        ))}

        {remainingRemoteParticipants.length === 0 && !includeLocalInGrid && (
          <View style={styles.emptyState}>
            <MaterialIcons name="groups-2" size={28} color="#6155F5" />
            <Text style={styles.emptyStateTitle}>Waiting for others</Text>
            <Text style={styles.emptyStateText}>Other participants will appear here once they join.</Text>
          </View>
        )}
      </ScrollView>

      {!!error && <Text style={styles.errorInline}>{error}</Text>}

      <View style={[styles.controlBar, { paddingBottom: controlBarPaddingBottom }]}>
        <Pressable
          style={[styles.controlButton, isAudioMuted && styles.controlButtonMuted, !publishOnJoin && styles.disabledButton]}
          onPress={toggleAudio}
          disabled={!publishOnJoin}
        >
          <Ionicons name={isAudioMuted ? 'mic-off' : 'mic'} size={18} color="#fff" />
          <Text style={styles.controlButtonText}>{isAudioMuted ? 'Unmute' : 'Mute'}</Text>
        </Pressable>
        <Pressable
          style={[styles.controlButton, isVideoMuted && styles.controlButtonMuted, !publishOnJoin && styles.disabledButton]}
          onPress={toggleVideo}
          disabled={!publishOnJoin}
        >
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
  preJoinContainerCompact: {
    paddingBottom: '8%'
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingBottom: 10
  },
  participantWrapper: {
    width: '100%',
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#101015',
    borderWidth: 2,
    borderColor: '#E5E3FF'
  },
  localParticipantWrapper: {
    marginBottom: 14
  },
  gridParticipantWrapper: {
    width: '48%',
    marginHorizontal: '1%'
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
  localVideoFrame: { width: '100%' },
  remoteVideoFrame: { width: '100%' },
  gridVideoFrame: { width: '100%' },
  cameraOffOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  cameraOffText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13
  },
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
  errorInline: {
    color: '#7A3FF2',
    textAlign: 'center',
    marginBottom: 6
  },
  controlBar: {
    paddingHorizontal: 12,
    paddingTop: 4,
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
  controlButtonMuted: {
    backgroundColor: '#D64562'
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
