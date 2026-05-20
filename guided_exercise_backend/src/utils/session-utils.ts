import type { SessionDocument } from '@/services/Firebase/firebase-session.js';

export type SessionStartEligibility =
  | { allowed: true }
  | { allowed: false; status: 403 | 409; message: string };

export type SessionParticipantRole = 'student' | 'instructor';
export type IvsCapability = 'PUBLISH' | 'SUBSCRIBE';
export type IvsDurationValidation =
  | { valid: true }
  | { valid: false; message: string };

export const IVS_USER_NAME_MAX = 128;
export const IVS_MAX_DURATION_MINUTES = 720;

export function parseOptionalDate(value: string | undefined, fieldName: string): Date | { error: string } | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { error: `${fieldName} must be a valid ISO date string.` };
  }

  return parsed;
}

export function validateScheduleRange(
  scheduledStartAt: Date | undefined,
  scheduledEndAt: Date | undefined
): string | null {
  if (scheduledStartAt && scheduledEndAt && scheduledEndAt <= scheduledStartAt) {
    return 'scheduledEndAt must be after scheduledStartAt.';
  }

  return null;
}

export function getSessionStartEligibility(input: {
  session: Pick<SessionDocument, 'instructorUid' | 'status' | 'scheduledStartAt'>;
  requesterUid: string;
  nowMs: number;
  startWindowMinutes: number;
}): SessionStartEligibility {
  if (input.session.instructorUid !== input.requesterUid.trim()) {
    return { allowed: false, status: 403, message: 'Only the session creator can start this class.' };
  }

  if (input.session.status === 'ended') {
    return { allowed: false, status: 409, message: 'Cannot start an ended session.' };
  }

  if (input.session.scheduledStartAt) {
    const earliestStart = input.session.scheduledStartAt.getTime() - input.startWindowMinutes * 60 * 1000;
    if (input.nowMs < earliestStart) {
      return {
        allowed: false,
        status: 409,
        message: `This class can only be started ${input.startWindowMinutes} minutes before the scheduled time.`
      };
    }
  }

  return { allowed: true };
}

export function getSessionParticipantRole(input: {
  sessionInstructorUid?: string | null | undefined;
  userId?: string | null | undefined;
}): SessionParticipantRole {
  const sessionInstructorUid = input.sessionInstructorUid?.trim();
  const userId = input.userId?.trim();

  if (sessionInstructorUid && userId && sessionInstructorUid === userId) {
    return 'instructor';
  }

  return 'student';
}

export function resolveSessionScopedTokenAttributes(input: {
  attributes?: Record<string, string>;
  sessionInstructorUid?: string | null | undefined;
  userId?: string | null | undefined;
}): Record<string, string> {
  const attributes = { ...(input.attributes ?? {}) };
  const userId = input.userId?.trim() || attributes.userId?.trim();

  if (!userId) {
    return attributes;
  }

  attributes.role = getSessionParticipantRole({
    sessionInstructorUid: input.sessionInstructorUid,
    userId
  });
  attributes.userId = userId;
  return attributes;
}

export function validateIvsUserName(userName: string | undefined): string | null {
  if (userName && userName.length > IVS_USER_NAME_MAX) {
    return 'userName must be 128 characters or fewer.';
  }

  return null;
}

export function validateIvsDurationMinutes(durationMinutes: number | undefined): IvsDurationValidation {
  if (
    durationMinutes !== undefined &&
    (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > IVS_MAX_DURATION_MINUTES)
  ) {
    return {
      valid: false,
      message: `durationMinutes must be an integer between 1 and ${IVS_MAX_DURATION_MINUTES}.`
    };
  }

  return { valid: true };
}

export function resolveIvsCapabilities(input: {
  requestedCapabilities?: IvsCapability[] | undefined;
  publish?: boolean | undefined;
  subscribe?: boolean | undefined;
}): IvsCapability[] {
  if (input.requestedCapabilities && input.requestedCapabilities.length > 0) {
    return input.requestedCapabilities;
  }

  const capabilities: IvsCapability[] = [];
  if (input.publish !== false) {
    capabilities.push('PUBLISH');
  }
  if (input.subscribe !== false) {
    capabilities.push('SUBSCRIBE');
  }
  return capabilities;
}

export function resolveIvsEffectiveUserId(input: {
  userId?: string | undefined;
  userName?: string | undefined;
  fallbackUserId: string;
}): string {
  return input.userId ?? input.userName ?? input.fallbackUserId;
}

export function mergeIvsTokenAttributes(input: {
  attributes: Record<string, string>;
  userName?: string | undefined;
}): Record<string, string> | undefined {
  const mergedAttributes = {
    ...input.attributes,
    ...(input.userName ? { username: input.userName } : {})
  };

  return Object.keys(mergedAttributes).length > 0 ? mergedAttributes : undefined;
}
