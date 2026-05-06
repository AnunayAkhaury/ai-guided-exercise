import React, { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import type { IvsCallProps } from './IvsCall.types';

type IvsBroadcastSdk = {
  Stage: new (token: string, strategy: IvsStageStrategy) => IvsStage;
  LocalStageStream: new (track: MediaStreamTrack, config?: Record<string, unknown>) => IvsLocalStageStream;
  SubscribeType: {
    AUDIO_VIDEO: unknown;
    AUDIO_ONLY: unknown;
    NONE: unknown;
  };
  InitialLayerPreference?: {
    HIGHEST_QUALITY?: unknown;
    LOWEST_QUALITY?: unknown;
  };
  StageEvents: {
    ERROR: string;
    STAGE_CONNECTION_STATE_CHANGED: string;
    STAGE_LEFT?: string;
    STAGE_PARTICIPANT_JOINED: string;
    STAGE_PARTICIPANT_LEFT: string;
    STAGE_PARTICIPANT_STREAMS_ADDED: string;
    STAGE_PARTICIPANT_STREAMS_REMOVED: string;
    STAGE_STREAM_MUTE_CHANGED: string;
  };
};

type IvsStage = {
  join(): Promise<void>;
  leave(): void;
  refreshStrategy(): void;
  on(eventName: string, handler: (...args: any[]) => void): void;
  off?(eventName: string, handler: (...args: any[]) => void): void;
};

type IvsStageParticipant = {
  id: string;
  isLocal?: boolean;
  attributes?: Record<string, string>;
  audioMuted?: boolean;
  videoStopped?: boolean;
  userInfo?: {
    isLocal?: boolean;
    attributes?: Record<string, string>;
  };
};

type IvsStageStream = {
  streamType?: string;
  mediaStreamTrack: MediaStreamTrack;
  isMuted?: boolean;
};

type IvsLocalStageStream = {
  setMuted(mute: boolean): void;
  isMuted?: boolean;
  mediaStreamTrack?: MediaStreamTrack;
};

type IvsStageStrategy = {
  stageStreamsToPublish: () => IvsLocalStageStream[];
  shouldPublishParticipant: (participant: IvsStageParticipant) => boolean;
  shouldSubscribeToParticipant: (participant: IvsStageParticipant) => unknown;
  subscribeConfiguration?: (participant: IvsStageParticipant) => Record<string, unknown> | undefined;
  preferredLayerForStream?: (participant: IvsStageParticipant, stream: IvsStageStream & Record<string, any>) => unknown;
};

type RegisteredStageListener = {
  eventName: string;
  handler: (...args: any[]) => void;
};

type RemoteParticipantState = {
  participantId: string;
  lookupKeys: string[];
  role?: string;
  displayName: string;
  mediaStream: MediaStream;
  hasVideo: boolean;
  audioMuted: boolean;
  videoMuted: boolean;
  streamVersion: number;
};

declare global {
  interface Window {
    IVSBroadcastClient?: IvsBroadcastSdk;
    __ivsWebBroadcastClientPromise__?: Promise<IvsBroadcastSdk>;
  }
}

const IVS_WEB_BROADCAST_SDK_URL = 'https://web-broadcast.live-video.net/1.34.0/amazon-ivs-web-broadcast.js';
const REMOTE_TILE_MIN_WIDTH = 260;
const WEB_CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  },
  video: {
    width: { min: 960, ideal: 1280, max: 1280 },
    height: { min: 540, ideal: 720, max: 720 },
    frameRate: { ideal: 30, max: 30 }
  }
};
const WEB_CAMERA_FALLBACK_CONSTRAINTS: MediaStreamConstraints = {
  audio: true,
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 }
  }
};
const WEB_VIDEO_STAGE_STREAM_CONFIG = {
  maxFramerate: 30,
  simulcast: {
    enabled: true
  }
};

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function isLocalParticipant(participant: IvsStageParticipant): boolean {
  return Boolean(participant.isLocal ?? participant.userInfo?.isLocal);
}

function getParticipantLookupKeys(participant: IvsStageParticipant): string[] {
  return Array.from(
    new Set(
      [
        participant.id,
        (participant as any)?.participantId,
        (participant as any)?.info?.participantId,
        (participant as any)?.participantInfo?.participantId
      ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    )
  );
}

function getParticipantAttributes(participant: IvsStageParticipant): Record<string, string> | undefined {
  return (
    participant.attributes ??
    participant.userInfo?.attributes ??
    (participant as any)?.info?.attributes ??
    (participant as any)?.participantInfo?.attributes
  );
}

function getParticipantDisplayName(
  participant: IvsStageParticipant,
  participantNamesById?: Record<string, string>
): string {
  const lookupKeys = getParticipantLookupKeys(participant);
  const mappedName = lookupKeys.map((key) => participantNamesById?.[key]).find(Boolean);
  if (mappedName) {
    return mappedName;
  }

  const attributes = getParticipantAttributes(participant);
  return (
    firstNonEmptyString(
      attributes?.username,
      attributes?.userName,
      attributes?.displayName,
      (participant as any)?.displayName,
      (participant as any)?.userName
    ) ?? participant.id
  );
}

function getParticipantRole(
  participant: IvsStageParticipant,
  participantRolesById?: Record<string, string>
): string | undefined {
  const lookupKeys = getParticipantLookupKeys(participant);
  const mappedRole = lookupKeys.map((key) => participantRolesById?.[key]).find(Boolean);
  if (mappedRole) {
    return mappedRole.toLowerCase();
  }

  const attributes = getParticipantAttributes(participant);
  const candidate = firstNonEmptyString(
    attributes?.role,
    (participant as any)?.role,
    (participant as any)?.info?.role,
    (participant as any)?.participantInfo?.role
  );

  return candidate?.toLowerCase();
}

function hasTrack(stream: MediaStream, track: MediaStreamTrack): boolean {
  return stream.getTracks().some((existingTrack) => existingTrack.id === track.id);
}

function loadIvsBroadcastSdk(): Promise<IvsBroadcastSdk> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Amazon IVS web classes can only load in a browser.'));
  }

  if (window.IVSBroadcastClient) {
    return Promise.resolve(window.IVSBroadcastClient);
  }

  if (window.__ivsWebBroadcastClientPromise__) {
    return window.__ivsWebBroadcastClientPromise__;
  }

  window.__ivsWebBroadcastClientPromise__ = new Promise<IvsBroadcastSdk>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-ivs-web-broadcast-sdk="true"]');

    const handleReady = () => {
      if (window.IVSBroadcastClient) {
        resolve(window.IVSBroadcastClient);
        return;
      }
      window.__ivsWebBroadcastClientPromise__ = undefined;
      reject(new Error('Amazon IVS web SDK loaded but the browser global was not available.'));
    };

    const handleError = () => {
      window.__ivsWebBroadcastClientPromise__ = undefined;
      reject(new Error('Failed to load the Amazon IVS web SDK.'));
    };

    if (existingScript) {
      if (existingScript.dataset.loaded === 'true') {
        handleReady();
        return;
      }
      existingScript.addEventListener('load', handleReady, { once: true });
      existingScript.addEventListener('error', handleError, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = IVS_WEB_BROADCAST_SDK_URL;
    script.async = true;
    script.dataset.ivsWebBroadcastSdk = 'true';
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      handleReady();
    }, { once: true });
    script.addEventListener('error', handleError, { once: true });
    document.head.appendChild(script);
  });

  return window.__ivsWebBroadcastClientPromise__;
}

async function getPreferredLocalMediaStream(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia(WEB_CAMERA_CONSTRAINTS);
  } catch (error) {
    const errorName = error instanceof DOMException ? error.name : '';
    if (errorName !== 'OverconstrainedError' && errorName !== 'ConstraintNotSatisfiedError') {
      throw error;
    }
    return navigator.mediaDevices.getUserMedia(WEB_CAMERA_FALLBACK_CONSTRAINTS);
  }
}

function resolveJoinPrerequisiteError(publishOnJoin: boolean): string | null {
  if (typeof window === 'undefined') {
    return 'The browser call experience is only available on the web client.';
  }

  if (!window.isSecureContext) {
    return 'Camera and microphone access require HTTPS or localhost in the browser.';
  }

  if (publishOnJoin && typeof navigator !== 'undefined' && !navigator.mediaDevices?.getUserMedia) {
    return 'This browser does not support camera and microphone access for IVS sessions.';
  }

  return null;
}

function isAuthTokenFailure(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('token') ||
    normalized.includes('expired') ||
    normalized.includes('unauthorized') ||
    normalized.includes('forbidden') ||
    normalized.includes('authentication')
  );
}

function sortParticipants(participants: RemoteParticipantState[]) {
  return [...participants].sort((a, b) => {
    if (a.role === 'instructor' && b.role !== 'instructor') return -1;
    if (a.role !== 'instructor' && b.role === 'instructor') return 1;
    return a.displayName.localeCompare(b.displayName);
  });
}

type ParticipantTileProps = {
  label: string;
  roleLabel?: string;
  mediaStream: MediaStream | null;
  streamVersion?: number;
  showCameraOff: boolean;
  height: number;
  isLocal?: boolean;
  accent?: 'primary' | 'secondary';
};

function ParticipantTile({
  label,
  roleLabel,
  mediaStream,
  streamVersion = 0,
  showCameraOff,
  height,
  isLocal = false,
  accent = 'secondary'
}: ParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (!mediaStream) {
      if (videoElement.srcObject) {
        videoElement.srcObject = null;
      }
      return;
    }

    if (videoElement.srcObject !== mediaStream) {
      videoElement.srcObject = mediaStream;
    }

    const playPromise = videoElement.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => undefined);
    }
  }, [mediaStream, streamVersion]);

  const accentStyles = accent === 'primary'
    ? {
        border: '1px solid rgba(97, 85, 245, 0.24)',
        boxShadow: '0 18px 44px rgba(97, 85, 245, 0.14)'
      }
    : {
        border: '1px solid rgba(47, 40, 86, 0.08)',
        boxShadow: '0 16px 36px rgba(28, 22, 74, 0.08)'
      };

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: 28,
        padding: 18,
        ...accentStyles
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12
        }}
      >
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 999,
            background: accent === 'primary' ? '#E5DCFF' : '#F0ECFF',
            color: '#2F2856',
            fontWeight: 700,
            fontSize: 14,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {label}
        </div>
        {roleLabel ? (
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              color: '#756AB7'
            }}
          >
            {roleLabel}
          </div>
        ) : null}
      </div>

      <div
        style={{
          position: 'relative',
          width: '100%',
          height,
          borderRadius: 22,
          overflow: 'hidden',
          background: '#171428'
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
            background: '#171428',
            opacity: showCameraOff ? 0.2 : 1
          }}
        />

        {showCameraOff ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 12,
              background: 'linear-gradient(180deg, rgba(23, 20, 40, 0.32) 0%, rgba(23, 20, 40, 0.72) 100%)',
              color: '#FFFFFF'
            }}
          >
            <Ionicons name="videocam-off" size={32} color="#FFFFFF" />
            <div style={{ fontSize: 15, fontWeight: 700 }}>Camera Off</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function IvsCallWeb({
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
  localParticipantRole
}: IvsCallProps) {
  const [sdkReady, setSdkReady] = useState(false);
  const [isInStage, setIsInStage] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(true);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [status, setStatus] = useState('Loading browser call runtime...');
  const [error, setError] = useState('');
  const [activeToken, setActiveToken] = useState(token);
  const [localPreviewStream, setLocalPreviewStream] = useState<MediaStream | null>(null);
  const [remoteParticipantsById, setRemoteParticipantsById] = useState<Record<string, RemoteParticipantState>>({});

  const stageRef = useRef<IvsStage | null>(null);
  const registeredStageListenersRef = useRef<RegisteredStageListener[]>([]);
  const localMediaStreamRef = useRef<MediaStream | null>(null);
  const localAudioStageStreamRef = useRef<IvsLocalStageStream | null>(null);
  const localVideoStageStreamRef = useRef<IvsLocalStageStream | null>(null);

  const localIsInstructor = localParticipantRole === 'instructor';
  const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const isCompactDesktop = viewportWidth < 1180;
  const heroHeight = isCompactDesktop ? 360 : 560;
  const gridTileHeight = isCompactDesktop ? 180 : 220;

  useEffect(() => {
    setActiveToken(token);
  }, [token]);

  useEffect(() => {
    onInStageChange?.(isInStage);
  }, [isInStage, onInStageChange]);

  useEffect(() => {
    let cancelled = false;

    void loadIvsBroadcastSdk()
      .then(() => {
        if (cancelled) return;
        setSdkReady(true);
        setStatus('');
      })
      .catch((sdkError: any) => {
        if (cancelled) return;
        setSdkReady(false);
        setError(sdkError?.message || 'Failed to load the browser IVS runtime.');
        setStatus('');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      teardownStageRuntime({
        stageRef,
        registeredStageListenersRef,
        localMediaStreamRef,
        localAudioStageStreamRef,
        localVideoStageStreamRef,
        setLocalPreviewStream,
        setRemoteParticipantsById,
        setIsInStage,
        setIsJoining,
        setStatus,
        setError,
        leaveStage: true,
        stopLocalMedia: true,
        preserveStatus: false,
        preserveError: true,
        updateState: false
      });
    };
  }, []);

  useEffect(() => {
    setRemoteParticipantsById((previous) => {
      let hasChanges = false;
      const next = { ...previous };

      for (const [participantId, participant] of Object.entries(previous)) {
        const mappedName = participant.lookupKeys.map((key) => participantNamesById?.[key]).find(Boolean);
        const mappedRole = participant.lookupKeys.map((key) => participantRolesById?.[key]).find(Boolean);
        const nextDisplayName = mappedName || participant.displayName;
        const nextRole = mappedRole?.toLowerCase() || participant.role;

        if (nextDisplayName !== participant.displayName || nextRole !== participant.role) {
          next[participantId] = {
            ...participant,
            displayName: nextDisplayName,
            role: nextRole
          };
          hasChanges = true;
        }
      }

      return hasChanges ? next : previous;
    });
  }, [participantNamesById, participantRolesById]);

  const remoteParticipants = useMemo(
    () => sortParticipants(Object.values(remoteParticipantsById)),
    [remoteParticipantsById]
  );

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
  const studentGridTemplate = totalStudentTiles > 1
    ? `repeat(auto-fit, minmax(${REMOTE_TILE_MIN_WIDTH}px, 1fr))`
    : 'minmax(0, 720px)';

  const handleJoin = async () => {
    if (!activeToken) {
      const message = 'No token provided.';
      setError(message);
      await Promise.resolve(onJoinFailed?.(message));
      return;
    }

    const prerequisiteError = resolveJoinPrerequisiteError(publishOnJoin);
    if (prerequisiteError) {
      setError(prerequisiteError);
      await Promise.resolve(onJoinFailed?.(prerequisiteError));
      return;
    }

    setIsJoining(true);
    setError('');
    setStatus('Preparing browser session...');
    await Promise.resolve(onJoinAttempt?.());

    const runJoin = async (joinToken: string) => {
      const sdk = await loadIvsBroadcastSdk();
      setSdkReady(true);
      setStatus('Requesting browser media...');

      teardownStageRuntime({
        stageRef,
        registeredStageListenersRef,
        localMediaStreamRef,
        localAudioStageStreamRef,
        localVideoStageStreamRef,
        setLocalPreviewStream,
        setRemoteParticipantsById,
        setIsInStage,
        setIsJoining,
        setStatus,
        setError,
        leaveStage: true,
        stopLocalMedia: true,
        preserveStatus: true,
        preserveError: true,
        updateState: true
      });

      let localMediaStream: MediaStream | null = null;
      let audioStageStream: IvsLocalStageStream | null = null;
      let videoStageStream: IvsLocalStageStream | null = null;

      if (publishOnJoin) {
        localMediaStream = await getPreferredLocalMediaStream();

        const audioTrack = localMediaStream.getAudioTracks()[0];
        const videoTrack = localMediaStream.getVideoTracks()[0];

        if (!audioTrack || !videoTrack) {
          localMediaStream.getTracks().forEach((track) => track.stop());
          throw new Error('The browser did not return both an audio and video track.');
        }

        audioStageStream = new sdk.LocalStageStream(audioTrack);
        videoStageStream = new sdk.LocalStageStream(videoTrack, WEB_VIDEO_STAGE_STREAM_CONFIG);
        audioStageStream.setMuted(true);
        videoStageStream.setMuted(false);
      }

      const strategy: IvsStageStrategy = {
        stageStreamsToPublish() {
          if (!publishOnJoin) return [];
          return [videoStageStream, audioStageStream].filter(Boolean) as IvsLocalStageStream[];
        },
        shouldPublishParticipant() {
          return publishOnJoin;
        },
        shouldSubscribeToParticipant() {
          return sdk.SubscribeType.AUDIO_VIDEO;
        },
        subscribeConfiguration() {
          const highestQualityPreference = sdk.InitialLayerPreference?.HIGHEST_QUALITY;
          return highestQualityPreference
            ? {
                simulcast: {
                  initialLayerPreference: highestQualityPreference
                }
              }
            : undefined;
        },
        preferredLayerForStream(_participant, stream) {
          return typeof stream.getHighestQualityLayer === 'function'
            ? stream.getHighestQualityLayer()
            : undefined;
        }
      };

      const stage = new sdk.Stage(joinToken, strategy);
      stageRef.current = stage;
      localMediaStreamRef.current = localMediaStream;
      localAudioStageStreamRef.current = audioStageStream;
      localVideoStageStreamRef.current = videoStageStream;

      if (localMediaStream) {
        setLocalPreviewStream(new MediaStream(localMediaStream.getVideoTracks()));
      }

      setIsAudioMuted(true);
      setIsVideoMuted(false);
      setStatus('Connecting to class...');
      setRemoteParticipantsById({});

      const registerStageListener = (eventName: string, handler: (...args: any[]) => void) => {
        stage.on(eventName, handler);
        registeredStageListenersRef.current.push({ eventName, handler });
      };

      registerStageListener(sdk.StageEvents.STAGE_CONNECTION_STATE_CHANGED, (connectionState: string) => {
        if (connectionState === 'connected') {
          setStatus('Connected');
          setIsInStage(true);
          setIsJoining(false);
          return;
        }

        if (connectionState === 'connecting') {
          setStatus('Connecting to class...');
          return;
        }

        if (connectionState === 'disconnected') {
          teardownStageRuntime({
            stageRef,
            registeredStageListenersRef,
            localMediaStreamRef,
            localAudioStageStreamRef,
            localVideoStageStreamRef,
            setLocalPreviewStream,
            setRemoteParticipantsById,
            setIsInStage,
            setIsJoining,
            setStatus,
            setError,
            leaveStage: false,
            stopLocalMedia: true,
            preserveStatus: true,
            preserveError: true,
            updateState: true
          });
          setStatus('Disconnected from class. Join again to reconnect.');
          return;
        }

        if (connectionState === 'errored') {
          teardownStageRuntime({
            stageRef,
            registeredStageListenersRef,
            localMediaStreamRef,
            localAudioStageStreamRef,
            localVideoStageStreamRef,
            setLocalPreviewStream,
            setRemoteParticipantsById,
            setIsInStage,
            setIsJoining,
            setStatus,
            setError,
            leaveStage: false,
            stopLocalMedia: true,
            preserveStatus: true,
            preserveError: true,
            updateState: true
          });
          setStatus('The browser stage errored. Join again to recover.');
        }
      });

      registerStageListener(sdk.StageEvents.ERROR, (stageError: any) => {
        const message = stageError?.message || 'The browser stage encountered an error.';
        setError(message);
      });

      registerStageListener(sdk.StageEvents.STAGE_PARTICIPANT_JOINED, (participant: IvsStageParticipant) => {
        if (isLocalParticipant(participant)) return;
        syncParticipantMetadata({
          participant,
          participantNamesById,
          participantRolesById,
          setRemoteParticipantsById
        });
      });

      registerStageListener(sdk.StageEvents.STAGE_PARTICIPANT_LEFT, (participant: IvsStageParticipant) => {
        if (isLocalParticipant(participant)) return;
        setRemoteParticipantsById((previous) => {
          if (!previous[participant.id]) {
            return previous;
          }
          const next = { ...previous };
          delete next[participant.id];
          return next;
        });
      });

      registerStageListener(
        sdk.StageEvents.STAGE_PARTICIPANT_STREAMS_ADDED,
        (participant: IvsStageParticipant, streams: IvsStageStream[]) => {
          if (isLocalParticipant(participant)) return;
          syncParticipantStreams({
            participant,
            streams,
            mode: 'add',
            participantNamesById,
            participantRolesById,
            setRemoteParticipantsById
          });
        }
      );

      registerStageListener(
        sdk.StageEvents.STAGE_PARTICIPANT_STREAMS_REMOVED,
        (participant: IvsStageParticipant, streams: IvsStageStream[]) => {
          if (isLocalParticipant(participant)) return;
          syncParticipantStreams({
            participant,
            streams,
            mode: 'remove',
            participantNamesById,
            participantRolesById,
            setRemoteParticipantsById
          });
        }
      );

      registerStageListener(
        sdk.StageEvents.STAGE_STREAM_MUTE_CHANGED,
        (participant: IvsStageParticipant, stream: IvsStageStream) => {
          if (isLocalParticipant(participant)) return;
          setRemoteParticipantsById((previous) => {
            const existing = previous[participant.id];
            if (!existing) {
              return previous;
            }

            const next = { ...previous };
            next[participant.id] = {
              ...existing,
              audioMuted:
                stream.streamType === 'audio'
                  ? Boolean(stream.isMuted ?? participant.audioMuted)
                  : Boolean(participant.audioMuted ?? existing.audioMuted),
              videoMuted:
                stream.streamType === 'video'
                  ? Boolean(stream.isMuted ?? participant.videoStopped)
                  : Boolean(participant.videoStopped ?? existing.videoMuted)
            };
            return next;
          });
        }
      );

      await stage.join();
    };

    try {
      await runJoin(activeToken);
    } catch (joinError: any) {
      const joinMessage = joinError?.message || 'Failed to join the browser stage.';

      if (onRequestFreshToken && isAuthTokenFailure(joinMessage)) {
        try {
          setStatus('Refreshing IVS token...');
          const refreshed = await onRequestFreshToken();
          if (refreshed?.token) {
            setActiveToken(refreshed.token);
            await runJoin(refreshed.token);
            return;
          }
        } catch (refreshError: any) {
          const message = refreshError?.message || joinMessage;
          setError(message);
          setIsJoining(false);
          setStatus('');
          return;
        }
      }

      teardownStageRuntime({
        stageRef,
        registeredStageListenersRef,
        localMediaStreamRef,
        localAudioStageStreamRef,
        localVideoStageStreamRef,
        setLocalPreviewStream,
        setRemoteParticipantsById,
        setIsInStage,
        setIsJoining,
        setStatus,
        setError,
        leaveStage: true,
        stopLocalMedia: true,
        preserveStatus: false,
        preserveError: true,
        updateState: true
      });
      setError(joinMessage);
      await Promise.resolve(onJoinFailed?.(joinMessage));
    }
  };

  const handleLeave = async () => {
    setIsLeaving(true);
    try {
      teardownStageRuntime({
        stageRef,
        registeredStageListenersRef,
        localMediaStreamRef,
        localAudioStageStreamRef,
        localVideoStageStreamRef,
        setLocalPreviewStream,
        setRemoteParticipantsById,
        setIsInStage,
        setIsJoining,
        setStatus,
        setError,
        leaveStage: true,
        stopLocalMedia: true,
        preserveStatus: false,
        preserveError: false,
        updateState: true
      });

      if (onLeave) {
        await Promise.resolve(onLeave());
      }
    } catch (leaveError: any) {
      setError(leaveError?.message || 'Failed to leave the session.');
      setIsLeaving(false);
    }
  };

  const handleToggleAudio = () => {
    if (!publishOnJoin || !localAudioStageStreamRef.current) {
      setError('Audio controls are disabled for view-only participants.');
      return;
    }

    const willMute = !isAudioMuted;
    localAudioStageStreamRef.current.setMuted(willMute);
    setIsAudioMuted(willMute);
  };

  const handleToggleVideo = () => {
    if (!publishOnJoin || !localVideoStageStreamRef.current) {
      setError('Video controls are disabled for view-only participants.');
      return;
    }

    const willMute = !isVideoMuted;
    localVideoStageStreamRef.current.setMuted(willMute);
    setIsVideoMuted(willMute);
  };

  if (isLeaving) {
    return (
      <div style={shellStyle}>
        <div style={joinCardStyle}>
          <div style={joinEyebrowStyle}>Leaving Class</div>
          <h1 style={joinTitleStyle}>Returning to classes...</h1>
          <p style={joinSubtitleStyle}>The session stays live unless the instructor explicitly ends it.</p>
        </div>
      </div>
    );
  }

  if (!isInStage) {
    return (
      <div style={shellStyle}>
        <div style={joinCardStyle}>
          <div style={joinEyebrowStyle}>Desktop Web Class</div>
          <h1 style={joinTitleStyle}>Welcome to Class</h1>
          <p style={joinSubtitleStyle}>
            The browser client now joins the same IVS session as mobile. Camera and microphone access are requested only
            when you choose to join.
          </p>

          {status ? <div style={statusPillStyle}>{status}</div> : null}
          {error ? <div style={errorBoxStyle}>{error}</div> : null}

          <div style={joinChecklistStyle}>
            <div style={joinChecklistRowStyle}>
              <Ionicons name="laptop-outline" size={18} color="#6155F5" />
              <span>Desktop Chrome or Edge recommended for the first release.</span>
            </div>
            <div style={joinChecklistRowStyle}>
              <Ionicons name="videocam-outline" size={18} color="#6155F5" />
              <span>Join starts with microphone muted, matching the mobile experience.</span>
            </div>
            <div style={joinChecklistRowStyle}>
              <Ionicons name="sync-outline" size={18} color="#6155F5" />
              <span>Token refresh continues to use the existing backend session APIs.</span>
            </div>
          </div>

          <div style={joinActionsStyle}>
            <button
              type="button"
              onClick={() => void handleJoin()}
              disabled={isJoining}
              style={{
                ...primaryButtonStyle,
                ...(isJoining ? disabledButtonStyle : null)
              }}
            >
              {isJoining ? 'Joining...' : sdkReady ? 'Join Session' : 'Load IVS and Join'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <div style={stageContentStyle}>
        <div style={stageHeaderStyle}>
          <div>
            <div style={stageTitleStyle}>Live Class</div>
            <div style={stageSubtitleStyle}>
              {localIsInstructor ? 'You are leading this session.' : 'You are connected as a participant.'}
            </div>
          </div>
          {status ? <div style={statusPillStyle}>{status}</div> : null}
        </div>

        {localIsInstructor ? (
          <ParticipantTile
            label={localParticipantLabel?.trim() || 'You'}
            roleLabel="Instructor"
            mediaStream={localPreviewStream}
            showCameraOff={isVideoMuted || !localPreviewStream}
            height={heroHeight}
            isLocal
            accent="primary"
          />
        ) : instructorRemote ? (
          <ParticipantTile
            label={instructorRemote.displayName}
            roleLabel="Instructor"
            mediaStream={instructorRemote.mediaStream}
            streamVersion={instructorRemote.streamVersion}
            showCameraOff={instructorRemote.videoMuted || !instructorRemote.hasVideo}
            height={heroHeight}
            accent="primary"
          />
        ) : (
          <div style={emptyStateCardStyle}>
            <MaterialIcons name="groups-2" size={34} color="#6155F5" />
            <div style={emptyStateTitleStyle}>Waiting for the instructor</div>
            <div style={emptyStateSubtitleStyle}>
              You are connected. The instructor video will appear here as soon as they publish to the session.
            </div>
          </div>
        )}

        {error ? <div style={errorBoxStyle}>{error}</div> : null}

        <div style={sectionHeaderStyle}>Participants</div>
        {totalStudentTiles > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: studentGridTemplate,
              gap: 18,
              alignItems: 'start'
            }}
          >
            {includeLocalInGrid ? (
              <ParticipantTile
                label={localParticipantLabel?.trim() || 'You'}
                roleLabel="Student"
                mediaStream={localPreviewStream}
                showCameraOff={isVideoMuted || !localPreviewStream}
                height={gridTileHeight}
                isLocal
              />
            ) : null}

            {remainingRemoteParticipants.map((participant) => (
              <ParticipantTile
                key={participant.participantId}
                label={participant.displayName}
                roleLabel={participant.role}
                mediaStream={participant.mediaStream}
                streamVersion={participant.streamVersion}
                showCameraOff={participant.videoMuted || !participant.hasVideo}
                height={gridTileHeight}
              />
            ))}
          </div>
        ) : (
          <div style={emptyStateCardStyle}>
            <MaterialIcons name="groups-2" size={34} color="#6155F5" />
            <div style={emptyStateTitleStyle}>Waiting for others</div>
            <div style={emptyStateSubtitleStyle}>Other participants will appear here once they join the class.</div>
          </div>
        )}
      </div>

      <div style={controlBarStyle}>
        <div style={controlRowStyle}>
          <button
            type="button"
            onClick={handleToggleAudio}
            disabled={!publishOnJoin}
            style={{
              ...controlButtonStyle,
              ...(isAudioMuted ? controlButtonMutedStyle : null),
              ...(!publishOnJoin ? disabledButtonStyle : null)
            }}
          >
            <Ionicons name={isAudioMuted ? 'mic-off' : 'mic'} size={18} color="#FFFFFF" />
            <span>{isAudioMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleVideo}
            disabled={!publishOnJoin}
            style={{
              ...controlButtonStyle,
              ...(isVideoMuted ? controlButtonMutedStyle : null),
              ...(!publishOnJoin ? disabledButtonStyle : null)
            }}
          >
            <Ionicons name={isVideoMuted ? 'videocam-off' : 'videocam'} size={18} color="#FFFFFF" />
            <span>{isVideoMuted ? 'Start Camera' : 'Stop Camera'}</span>
          </button>

          {onInfoPress ? (
            <button type="button" onClick={onInfoPress} style={infoButtonStyle}>
              <Ionicons name="information-circle-outline" size={18} color="#FFFFFF" />
              <span>Info</span>
            </button>
          ) : null}

          <button type="button" onClick={() => void handleLeave()} style={leaveButtonStyle}>
            <Ionicons name="call" size={18} color="#FFFFFF" />
            <span>Leave</span>
          </button>

          {onEndSession ? (
            <button
              type="button"
              onClick={onEndSession}
              disabled={endSessionDisabled}
              style={{
                ...endSessionButtonStyle,
                ...(endSessionDisabled ? disabledButtonStyle : null)
              }}
            >
              <Ionicons name="stop-circle-outline" size={18} color="#FFFFFF" />
              <span>{endSessionLabel}</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function syncParticipantMetadata({
  participant,
  participantNamesById,
  participantRolesById,
  setRemoteParticipantsById
}: {
  participant: IvsStageParticipant;
  participantNamesById?: Record<string, string>;
  participantRolesById?: Record<string, string>;
  setRemoteParticipantsById: React.Dispatch<React.SetStateAction<Record<string, RemoteParticipantState>>>;
}) {
  const lookupKeys = getParticipantLookupKeys(participant);
  const displayName = getParticipantDisplayName(participant, participantNamesById);
  const role = getParticipantRole(participant, participantRolesById);

  setRemoteParticipantsById((previous) => {
    const existing = previous[participant.id];
    const next = { ...previous };
    next[participant.id] = {
      participantId: participant.id,
      lookupKeys,
      role,
      displayName,
      mediaStream: existing?.mediaStream ?? new MediaStream(),
      hasVideo: existing?.hasVideo ?? false,
      audioMuted: Boolean(participant.audioMuted ?? existing?.audioMuted),
      videoMuted: Boolean(participant.videoStopped ?? existing?.videoMuted ?? true),
      streamVersion: existing?.streamVersion ?? 0
    };
    return next;
  });
}

function syncParticipantStreams({
  participant,
  streams,
  mode,
  participantNamesById,
  participantRolesById,
  setRemoteParticipantsById
}: {
  participant: IvsStageParticipant;
  streams: IvsStageStream[];
  mode: 'add' | 'remove';
  participantNamesById?: Record<string, string>;
  participantRolesById?: Record<string, string>;
  setRemoteParticipantsById: React.Dispatch<React.SetStateAction<Record<string, RemoteParticipantState>>>;
}) {
  const lookupKeys = getParticipantLookupKeys(participant);
  const displayName = getParticipantDisplayName(participant, participantNamesById);
  const role = getParticipantRole(participant, participantRolesById);

  setRemoteParticipantsById((previous) => {
    const existing = previous[participant.id];
    const mediaStream = existing?.mediaStream ?? new MediaStream();

    for (const stream of streams) {
      const track = stream.mediaStreamTrack;
      if (!track) continue;

      if (mode === 'add') {
        if (!hasTrack(mediaStream, track)) {
          mediaStream.addTrack(track);
        }
        continue;
      }

      for (const existingTrack of mediaStream.getTracks()) {
        if (existingTrack.id === track.id) {
          mediaStream.removeTrack(existingTrack);
        }
      }
    }

    const videoTracks = mediaStream.getVideoTracks();
    const audioTracks = mediaStream.getAudioTracks();
    const latestVideoStream = [...streams].reverse().find((stream) => stream.streamType === 'video');
    const latestAudioStream = [...streams].reverse().find((stream) => stream.streamType === 'audio');

    return {
      ...previous,
      [participant.id]: {
        participantId: participant.id,
        lookupKeys,
        role,
        displayName,
        mediaStream,
        hasVideo: videoTracks.length > 0,
        audioMuted: Boolean(
          participant.audioMuted ??
            latestAudioStream?.isMuted ??
            (audioTracks.length === 0 ? true : existing?.audioMuted ?? false)
        ),
        videoMuted: Boolean(
          participant.videoStopped ??
            latestVideoStream?.isMuted ??
            (videoTracks.length === 0 ? true : existing?.videoMuted ?? false)
        ),
        streamVersion: (existing?.streamVersion ?? 0) + 1
      }
    };
  });
}

function teardownStageRuntime({
  stageRef,
  registeredStageListenersRef,
  localMediaStreamRef,
  localAudioStageStreamRef,
  localVideoStageStreamRef,
  setLocalPreviewStream,
  setRemoteParticipantsById,
  setIsInStage,
  setIsJoining,
  setStatus,
  setError,
  leaveStage,
  stopLocalMedia,
  preserveStatus,
  preserveError,
  updateState
}: {
  stageRef: React.MutableRefObject<IvsStage | null>;
  registeredStageListenersRef: React.MutableRefObject<RegisteredStageListener[]>;
  localMediaStreamRef: React.MutableRefObject<MediaStream | null>;
  localAudioStageStreamRef: React.MutableRefObject<IvsLocalStageStream | null>;
  localVideoStageStreamRef: React.MutableRefObject<IvsLocalStageStream | null>;
  setLocalPreviewStream: React.Dispatch<React.SetStateAction<MediaStream | null>>;
  setRemoteParticipantsById: React.Dispatch<React.SetStateAction<Record<string, RemoteParticipantState>>>;
  setIsInStage: React.Dispatch<React.SetStateAction<boolean>>;
  setIsJoining: React.Dispatch<React.SetStateAction<boolean>>;
  setStatus: React.Dispatch<React.SetStateAction<string>>;
  setError: React.Dispatch<React.SetStateAction<string>>;
  leaveStage: boolean;
  stopLocalMedia: boolean;
  preserveStatus: boolean;
  preserveError: boolean;
  updateState: boolean;
}) {
  const stage = stageRef.current;
  const registeredListeners = registeredStageListenersRef.current;

  if (stage && registeredListeners.length > 0) {
    for (const listener of registeredListeners) {
      try {
        stage.off?.(listener.eventName, listener.handler);
      } catch {
        // Some SDK versions may not expose .off in the same way; best-effort cleanup is sufficient here.
      }
    }
  }

  registeredStageListenersRef.current = [];
  stageRef.current = null;

  if (leaveStage && stage) {
    try {
      stage.leave();
    } catch {
      // Leaving during teardown should never block route cleanup.
    }
  }

  if (stopLocalMedia && localMediaStreamRef.current) {
    localMediaStreamRef.current.getTracks().forEach((track) => track.stop());
    localMediaStreamRef.current = null;
  }

  localAudioStageStreamRef.current = null;
  localVideoStageStreamRef.current = null;

  if (!updateState) {
    return;
  }

  setLocalPreviewStream(null);
  setRemoteParticipantsById({});
  setIsInStage(false);
  setIsJoining(false);

  if (!preserveStatus) {
    setStatus('');
  }

  if (!preserveError) {
    setError('');
  }
}

const shellStyle: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  padding: 24,
  paddingBottom: 112,
  boxSizing: 'border-box',
  background: 'radial-gradient(circle at top, rgba(229, 220, 255, 0.9) 0%, #F5F2FF 42%, #FFFFFF 100%)'
};

const joinCardStyle: CSSProperties = {
  width: '100%',
  maxWidth: 860,
  margin: '0 auto',
  background: '#FFFFFF',
  borderRadius: 30,
  padding: 32,
  border: '1px solid rgba(97, 85, 245, 0.16)',
  boxShadow: '0 24px 64px rgba(57, 43, 151, 0.12)',
  display: 'flex',
  flexDirection: 'column',
  gap: 18
};

const joinEyebrowStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: 1,
  textTransform: 'uppercase',
  color: '#756AB7'
};

const joinTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 42,
  lineHeight: 1.05,
  color: '#2F2856'
};

const joinSubtitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 17,
  lineHeight: 1.65,
  color: '#5F5994'
};

const joinChecklistStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 18,
  borderRadius: 22,
  background: '#F7F3FF'
};

const joinChecklistRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  color: '#3D3769',
  fontSize: 15
};

const joinActionsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12
};

const primaryButtonStyle: CSSProperties = {
  border: 'none',
  borderRadius: 16,
  background: '#6155F5',
  color: '#FFFFFF',
  fontWeight: 800,
  fontSize: 16,
  padding: '14px 20px',
  cursor: 'pointer',
  boxShadow: '0 16px 32px rgba(97, 85, 245, 0.24)'
};

const disabledButtonStyle: CSSProperties = {
  opacity: 0.56,
  cursor: 'not-allowed',
  boxShadow: 'none'
};

const statusPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  width: 'fit-content',
  padding: '10px 14px',
  borderRadius: 999,
  background: '#E5DCFF',
  color: '#433B7A',
  fontSize: 14,
  fontWeight: 700
};

const errorBoxStyle: CSSProperties = {
  borderRadius: 18,
  padding: '14px 16px',
  background: '#FFF0F1',
  color: '#A1263D',
  border: '1px solid rgba(190, 42, 74, 0.18)',
  fontWeight: 600
};

const stageContentStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  flex: '0 0 auto',
  width: '100%',
  maxWidth: 1280,
  margin: '0 auto',
  paddingBottom: 8,
  boxSizing: 'border-box'
};

const stageHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 16,
  flexWrap: 'wrap'
};

const stageTitleStyle: CSSProperties = {
  fontSize: 32,
  fontWeight: 800,
  color: '#2F2856'
};

const stageSubtitleStyle: CSSProperties = {
  marginTop: 6,
  fontSize: 15,
  color: '#6A6499'
};

const sectionHeaderStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: '#2F2856'
};

const emptyStateCardStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'column',
  gap: 12,
  minHeight: 220,
  padding: 24,
  borderRadius: 28,
  background: '#FFFFFF',
  border: '1px dashed rgba(97, 85, 245, 0.32)',
  textAlign: 'center'
};

const emptyStateTitleStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  color: '#2F2856'
};

const emptyStateSubtitleStyle: CSSProperties = {
  maxWidth: 560,
  fontSize: 15,
  lineHeight: 1.6,
  color: '#67618F'
};

const controlBarStyle: CSSProperties = {
  position: 'sticky',
  bottom: 0,
  zIndex: 20,
  width: '100%',
  maxWidth: 1280,
  margin: '0 auto',
  paddingTop: 12,
  paddingBottom: 4,
  boxSizing: 'border-box'
};

const controlRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  padding: 14,
  borderRadius: 22,
  background: 'rgba(47, 40, 86, 0.92)',
  boxShadow: '0 18px 40px rgba(21, 18, 44, 0.22)',
  backdropFilter: 'blur(14px)'
};

const controlButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
  border: 'none',
  borderRadius: 14,
  background: '#6155F5',
  color: '#FFFFFF',
  padding: '12px 16px',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer'
};

const controlButtonMutedStyle: CSSProperties = {
  background: '#8C354E'
};

const infoButtonStyle: CSSProperties = {
  ...controlButtonStyle,
  background: '#4B4384'
};

const leaveButtonStyle: CSSProperties = {
  ...controlButtonStyle,
  background: '#E45F79'
};

const endSessionButtonStyle: CSSProperties = {
  ...controlButtonStyle,
  background: '#2F2856'
};
