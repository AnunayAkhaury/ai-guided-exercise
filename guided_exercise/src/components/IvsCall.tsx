import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Camera } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExerciseSheet, ExerciseType } from './session/exercise-sheet';
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
import BottomSheetModal from '@gorhom/bottom-sheet/lib/typescript/components/bottomSheetModal/BottomSheetModal';
import { addExerciseTimestamp, ExerciseTimestamp } from '../api/Firebase/firebase-feedback';

type IvsCallProps = {
  token?: string;
  publishOnJoin?: boolean;
  onLeave?: () => void | Promise<void>;
  onInfoPress?: () => void;
  onEndSession?: () => void;
  endSessionLabel?: string;
  endSessionDisabled?: boolean;
  onInStageChange?: (inStage: boolean) => void;
  onRequestFreshToken?: () => Promise<{ token: string; participantId?: string } | null>;
  onJoinAttempt?: () => void | Promise<void>;
  onJoinFailed?: (message: string) => void | Promise<void>;
  localParticipantLabel?: string;
  participantNamesById?: Record<string, string>;
  participantRolesById?: Record<string, string>;
  localParticipantRole?: 'student' | 'instructor';
  sessionId: string;
};

type RemoteParticipantInfo = {
  participantId: string;
  lookupKeys: string[];
  role: string | undefined;
  displayName: string;
  deviceUrn: string | null;
  hasVideo: boolean;
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
      candidate?.displayName,
      candidate?.info?.userName,
      candidate?.info?.displayName,
      candidate?.userInfo?.userName,
      candidate?.participantInfo?.userName
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
  onInfoPress,
  onEndSession,
  endSessionLabel = 'End Session',
  endSessionDisabled = false,
  onInStageChange,
  onRequestFreshToken,
  onJoinAttempt,
  onJoinFailed,
  localParticipantLabel,
  participantNamesById,
  participantRolesById,
  localParticipantRole,
  sessionId
}: IvsCallProps) {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isSmallPhone = width < 380 || height < 760;
  const compactControls = isSmallPhone || fontScale > 1.15;
  const localVideoHeight = Math.max(190, Math.min(260, Math.round(width * 0.56)));
  const remoteVideoHeight = Math.max(190, Math.min(260, Math.round(width * 0.56)));
  const gridVideoHeight = Math.max(190, Math.min(260, Math.round(((width - 38) / 2) * 1.35)));
  const controlBarPaddingBottom = isSmallPhone ? 6 : 10;
  const contentBottomPadding = isSmallPhone ? 6 : 14;

  const [isInStage, setIsInStage] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(true);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [activeToken, setActiveToken] = useState(token);
  const publishOnJoinRef = useRef(publishOnJoin);
  const isAudioMutedRef = useRef(isAudioMuted);
  const hasJoinAttemptRef = useRef(false);
  const [exerciseTimestamp, setExerciseTimestamp] = useState<ExerciseTimestamp | null>(null);

  const sheetRef = useRef<BottomSheetModal>(null);
  const [exercise, setExercise] = useState<ExerciseType | null>(null);
  const handlePresentModalPress = () => {
    sheetRef.current?.present();
  };

  const { participants } = useStageParticipants() as { participants: Participant[] };
  const remoteParticipants = useMemo<RemoteParticipantInfo[]>(() => {
    return participants
      .map<RemoteParticipantInfo | null>((participant) => {
        if (isLocalParticipant(participant)) {
          return null;
        }
        const candidate = participant as any;
        const attributes =
          candidate?.attributes ??
          candidate?.info?.attributes ??
          candidate?.userInfo?.attributes ??
          candidate?.participantInfo?.attributes;
        const lookupKeys = [participant.id, candidate?.participantId, candidate?.info?.participantId].filter(
          (value): value is string => typeof value === 'string' && value.trim().length > 0
        );
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
      .filter((value): value is RemoteParticipantInfo => value !== null)
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
    if (exerciseTimestamp?.starttime && exerciseTimestamp?.endtime) {
      if (exerciseTimestamp.endtime - exerciseTimestamp.starttime > 3000) {
        // 3 seconds
        addExerciseTimestamp(exerciseTimestamp);
      } else {
        // Exercise too short
        setExerciseTimestamp(null);
      }
    }
  }, [exerciseTimestamp]);

  useEffect(() => {
    publishOnJoinRef.current = publishOnJoin;
  }, [publishOnJoin]);

  useEffect(() => {
    setActiveToken(token);
  }, [token]);

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
              await setMicrophoneMuted(isAudioMutedRef.current);
              await setCameraMuted(false);
              await setStreamsPublished(true);
              // IVS may briefly unmute during publish init on some devices; enforce mute again.
              setTimeout(() => {
                void setMicrophoneMuted(isAudioMutedRef.current).catch(() => undefined);
              }, 350);
              setTimeout(() => {
                void setMicrophoneMuted(isAudioMutedRef.current).catch(() => undefined);
              }, 1200);
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
    if (!activeToken) {
      setError('No token provided.');
      return;
    }

    setIsJoining(true);
    setStatus('Initializing Stage...');
    setError('');
    hasJoinAttemptRef.current = true;
    await Promise.resolve(onJoinAttempt?.());

    const isAuthTokenFailure = (message: string) => {
      const normalized = message.toLowerCase();
      return (
        normalized.includes('token') ||
        normalized.includes('expired') ||
        normalized.includes('unauthorized') ||
        normalized.includes('forbidden') ||
        normalized.includes('authentication')
      );
    };

    const runJoin = async (joinToken: string) => {
      await initializeStage();
      // Always join as non-publishing first to avoid accidental open-mic moments.
      await setStreamsPublished(false);

      // Only publishers need local camera/microphone streams.
      if (publishOnJoin) {
        const cameraPermission = await Camera.requestCameraPermissionsAsync();
        const microphonePermission = await Camera.requestMicrophonePermissionsAsync();
        if (cameraPermission.status !== 'granted' || microphonePermission.status !== 'granted') {
          throw new Error('Camera and microphone permissions are required to join the call.');
        }
        await initializeLocalStreams();
        // Force "join muted" before connecting.
        await setMicrophoneMuted(true);
        setIsAudioMuted(true);
      }

      // connect to the stage using token
      await joinStage(joinToken);
    };

    try {
      await runJoin(activeToken);
    } catch (err: any) {
      const message = err?.message || 'Failed to join stage.';
      if (onRequestFreshToken && isAuthTokenFailure(message)) {
        try {
          const refreshed = await onRequestFreshToken();
          if (refreshed?.token) {
            setActiveToken(refreshed.token);
            await runJoin(refreshed.token);
            return;
          }
        } catch (refreshError: any) {
          setError(refreshError?.message || message);
          setIsJoining(false);
          hasJoinAttemptRef.current = false;
          return;
        }
      }
      setError(message);
      await Promise.resolve(onJoinFailed?.(message));
      setIsJoining(false);
      hasJoinAttemptRef.current = false;
    }
  };

  const handleLeave = async () => {
    hasJoinAttemptRef.current = false;
    await leaveStage();
    if (onLeave) {
      await Promise.resolve(onLeave());
    }
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
          <Pressable
            style={[styles.primaryButton, isJoining && styles.disabledButton]}
            onPress={join}
            disabled={isJoining}>
            <Text style={styles.primaryButtonText}>{isJoining ? 'Joining...' : 'Join Session'}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // show stage view with other participants
  return (
    <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: contentBottomPadding }]}>
      <ScrollView
        style={styles.videoContainer}
        contentContainerStyle={styles.videoContent}
        showsVerticalScrollIndicator={false}
        bounces>
        {publishOnJoin && localIsInstructor && (
          <View style={[styles.participantWrapper, styles.localParticipantWrapper]}>
            <View style={styles.participantLabelPill}>
              <Text style={styles.participantLabel}>{localParticipantLabel?.trim() || 'You'}</Text>
            </View>
            <View style={[styles.localVideoFrame, { height: localVideoHeight }]}>
              <ExpoIVSStagePreviewView style={StyleSheet.absoluteFillObject} scaleMode="fill" />
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
              <View style={[styles.remoteVideoFrame, { height: remoteVideoHeight }]}>
                <ExpoIVSRemoteStreamView
                  participantId={instructorRemote.participantId}
                  deviceUrn={instructorRemote.deviceUrn}
                  style={StyleSheet.absoluteFillObject}
                  scaleMode="fill"
                />
              </View>
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
              ]}>
              <ExpoIVSStagePreviewView style={StyleSheet.absoluteFillObject} scaleMode="fill" />
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
            style={[styles.participantWrapper, useGridForStudents && styles.gridParticipantWrapper]}>
            <View style={styles.participantLabelPill}>
              <Text style={styles.participantLabel}>
                {participant.lookupKeys.map((key) => participantNamesById?.[key]).find(Boolean) ||
                  participant.displayName}
              </Text>
            </View>
            {participant.hasVideo && participant.deviceUrn ? (
              <View
                style={[
                  useGridForStudents ? styles.gridVideoFrame : styles.remoteVideoFrame,
                  { height: useGridForStudents ? gridVideoHeight : remoteVideoHeight }
                ]}>
                <ExpoIVSRemoteStreamView
                  participantId={participant.participantId}
                  deviceUrn={participant.deviceUrn}
                  style={StyleSheet.absoluteFillObject}
                  scaleMode="fill"
                />
              </View>
            ) : (
              <View
                style={[
                  useGridForStudents ? styles.gridVideoFrame : styles.remoteVideoFrame,
                  { height: useGridForStudents ? gridVideoHeight : remoteVideoHeight }
                ]}>
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

      <View
        style={[
          styles.controlBar,
          compactControls && styles.compactControlBar,
          { paddingBottom: controlBarPaddingBottom }
        ]}>
        <Pressable
          style={[
            styles.controlButton,
            compactControls && styles.compactControlButton,
            isAudioMuted && styles.controlButtonMuted,
            !publishOnJoin && styles.disabledButton
          ]}
          onPress={toggleAudio}
          disabled={!publishOnJoin}>
          <Ionicons name={isAudioMuted ? 'mic-off' : 'mic'} size={18} color="#fff" />
          <Text style={styles.controlButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            {isAudioMuted ? (compactControls ? 'Mic On' : 'Unmute') : 'Mute'}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.controlButton,
            compactControls && styles.compactControlButton,
            isVideoMuted && styles.controlButtonMuted,
            !publishOnJoin && styles.disabledButton
          ]}
          onPress={toggleVideo}
          disabled={!publishOnJoin}>
          <Ionicons name={isVideoMuted ? 'videocam-off' : 'videocam'} size={18} color="#fff" />
          <Text style={styles.controlButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            {isVideoMuted ? 'Start Cam' : compactControls ? 'Cam Off' : 'Stop Cam'}
          </Text>
        </Pressable>
        {onInfoPress && !onEndSession && (
          <Pressable style={[styles.infoButton, compactControls && styles.compactControlButton]} onPress={onInfoPress}>
            <Ionicons name="information-circle-outline" size={18} color="#fff" />
            <Text style={styles.controlButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              Info
            </Text>
          </Pressable>
        )}
        {!onEndSession && (
          <Pressable
            style={[styles.endCallButton, compactControls && styles.compactControlButton]}
            onPress={handleLeave}>
            <Ionicons name="call" size={18} color="#fff" />
            <Text style={styles.controlButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              Leave
            </Text>
          </Pressable>
        )}
      </View>

      {onEndSession && (
        <View
          style={[
            styles.controlBarSecondary,
            compactControls && styles.compactControlBar,
            { paddingBottom: controlBarPaddingBottom }
          ]}>
          {onInfoPress && (
            <Pressable
              style={[styles.infoButtonSecondary, compactControls && styles.compactControlButton]}
              onPress={onInfoPress}>
              <Ionicons name="information-circle-outline" size={18} color="#fff" />
              <Text style={styles.controlButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                Info
              </Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.endCallButton, compactControls && styles.compactControlButton]}
            onPress={handleLeave}>
            <Ionicons name="call" size={18} color="#fff" />
            <Text style={styles.controlButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              Leave
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.controlButton,
              compactControls && styles.compactControlButton,
              styles.controlButtonMuted,
              endSessionDisabled && styles.disabledButton
            ]}
            onPress={onEndSession}
            disabled={endSessionDisabled}>
            <Ionicons name="stop-circle-outline" size={18} color="#fff" />
            <Text style={styles.controlButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {compactControls && endSessionLabel === 'End Session' ? 'End' : endSessionLabel}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Select Exercise */}
      {localIsInstructor && (
        <View>
          {exercise ? (
            // Cancel/stop exercise
            <Pressable
              style={[styles.primaryButton, { backgroundColor: '#D64562' }]}
              onPress={() => {
                setExercise(null);
                setExerciseTimestamp((prev) =>
                  prev
                    ? {
                        ...prev,
                        endtime: Date.now()
                      }
                    : null
                );
              }}>
              <Text style={styles.primaryButtonText}>Cancel: {exercise}</Text>
            </Pressable>
          ) : (
            // Start exercise
            <Pressable
              onPress={() => {
                sheetRef.current?.present();
              }}
              style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Pick Exercise</Text>
            </Pressable>
          )}

          <ExerciseSheet
            ref={sheetRef}
            onSelect={(selected) => {
              setExercise(selected);

              setExerciseTimestamp({
                sessionId,
                exercise: selected,
                starttime: Date.now(),
                endtime: null
              });
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    paddingTop: 0,
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
    paddingBottom: 18
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
    marginBottom: 14,
    marginTop: 2
  },
  gridParticipantWrapper: {
    width: '49%',
    marginHorizontal: '0.5%'
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
  localVideoFrame: { width: '100%', overflow: 'hidden' },
  remoteVideoFrame: { width: '100%', overflow: 'hidden' },
  gridVideoFrame: { width: '100%', overflow: 'hidden' },
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
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2
  },
  controlBarSecondary: {
    paddingHorizontal: 12,
    paddingTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  compactControlBar: {
    gap: 6
  },
  controlButton: {
    flex: 1,
    minWidth: 96,
    minHeight: 44,
    backgroundColor: '#6155F5',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  compactControlButton: {
    minWidth: 88
  },
  controlButtonMuted: {
    backgroundColor: '#D64562'
  },
  endCallButton: {
    flex: 1,
    minWidth: 96,
    minHeight: 44,
    backgroundColor: '#A980FE',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  infoButton: {
    flex: 1,
    minWidth: 96,
    minHeight: 44,
    backgroundColor: '#6A63A4',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  infoButtonSecondary: {
    flex: 1,
    minWidth: 96,
    minHeight: 44,
    backgroundColor: '#6A63A4',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  controlButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    flexShrink: 1
  },
  disabledButton: {
    opacity: 0.5
  }
});
