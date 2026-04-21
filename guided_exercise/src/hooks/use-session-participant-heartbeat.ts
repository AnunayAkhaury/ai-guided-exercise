import { useEffect } from 'react';
import { heartbeatIvsSessionParticipant } from '@/src/api/ivs';

const PARTICIPANT_HEARTBEAT_INTERVAL_MS = 25 * 1000;

type UseSessionParticipantHeartbeatInput = {
  enabled: boolean;
  sessionId?: string;
  participantId?: string;
  logPrefix: string;
};

export function useSessionParticipantHeartbeat({
  enabled,
  sessionId,
  participantId,
  logPrefix
}: UseSessionParticipantHeartbeatInput) {
  useEffect(() => {
    const normalizedSessionId = sessionId?.trim();
    const normalizedParticipantId = participantId?.trim();

    if (!enabled || !normalizedSessionId || !normalizedParticipantId) {
      return;
    }

    let cancelled = false;

    const sendHeartbeat = async () => {
      try {
        await heartbeatIvsSessionParticipant({
          sessionId: normalizedSessionId,
          participantId: normalizedParticipantId
        });
      } catch (error) {
        if (!cancelled) {
          console.log(`${logPrefix} participant heartbeat error`, error);
        }
      }
    };

    void sendHeartbeat();
    const interval = setInterval(() => {
      void sendHeartbeat();
    }, PARTICIPANT_HEARTBEAT_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled, logPrefix, participantId, sessionId]);
}
