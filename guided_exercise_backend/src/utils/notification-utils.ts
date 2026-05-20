import type { SessionDocument } from '@/services/Firebase/firebase-session.js';
import type { PushPlatform, PushTokenType } from '@/services/Firebase/firebase-push-tokens.js';

export type CronSecretStatus = 'missing' | 'valid' | 'invalid';
export type PushTokenValidationResult =
  | {
      valid: true;
      uid: string;
      token: string;
      type: PushTokenType;
      platform: PushPlatform;
      deviceName?: string;
    }
  | { valid: false; message: string };

export type UnregisterPushTokenValidationResult =
  | {
      valid: true;
      uid: string;
      token: string;
    }
  | { valid: false; message: string };

const VALID_TOKEN_TYPES: PushTokenType[] = ['expo', 'fcm_web'];
const VALID_PLATFORMS: PushPlatform[] = ['ios', 'android', 'web'];

export function validatePushTokenRegistration(input: {
  uid?: string | null;
  token?: string | null;
  type?: unknown;
  platform?: unknown;
  deviceName?: string | null;
}): PushTokenValidationResult {
  const uid = input.uid?.trim();
  const token = input.token?.trim();
  const deviceName = input.deviceName?.trim();

  if (!uid) {
    return { valid: false, message: 'uid is required.' };
  }
  if (!token) {
    return { valid: false, message: 'token is required.' };
  }
  if (!input.type || !VALID_TOKEN_TYPES.includes(input.type as PushTokenType)) {
    return { valid: false, message: 'type must be expo or fcm_web.' };
  }
  if (!input.platform || !VALID_PLATFORMS.includes(input.platform as PushPlatform)) {
    return { valid: false, message: 'platform must be ios, android, or web.' };
  }

  return {
    valid: true,
    uid,
    token,
    type: input.type as PushTokenType,
    platform: input.platform as PushPlatform,
    ...(deviceName ? { deviceName } : {})
  };
}

export function validatePushTokenUnregistration(input: {
  uid?: string | null;
  token?: string | null;
}): UnregisterPushTokenValidationResult {
  const uid = input.uid?.trim();
  const token = input.token?.trim();

  if (!uid) {
    return { valid: false, message: 'uid is required.' };
  }
  if (!token) {
    return { valid: false, message: 'token is required.' };
  }

  return { valid: true, uid, token };
}

export function getCronSecretStatus(expectedSecret: string | undefined, providedSecret: string | undefined): CronSecretStatus {
  const normalizedExpectedSecret = expectedSecret?.trim();
  if (!normalizedExpectedSecret) {
    return 'missing';
  }

  return providedSecret === normalizedExpectedSecret ? 'valid' : 'invalid';
}

export function isSessionDueForReminder(
  session: Pick<SessionDocument, 'scheduledStartAt' | 'reminderSentAt'>,
  nowMs: number,
  leadMs: number
): boolean {
  if (!session.scheduledStartAt || session.reminderSentAt) {
    return false;
  }

  const startMs = session.scheduledStartAt.getTime();
  return startMs > nowMs && startMs <= nowMs + leadMs;
}

export function getDueReminderSessions<T extends Pick<SessionDocument, 'scheduledStartAt' | 'reminderSentAt'>>(
  sessions: T[],
  nowMs: number,
  leadMs: number
): T[] {
  return sessions.filter((session) => isSessionDueForReminder(session, nowMs, leadMs));
}

export function summarizeSettledResults(results: PromiseSettledResult<unknown>[]) {
  return {
    sent: results.filter((result) => result.status === 'fulfilled').length,
    failed: results.filter((result) => result.status === 'rejected').length
  };
}
