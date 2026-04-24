export type IvsCallProps = {
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
};
