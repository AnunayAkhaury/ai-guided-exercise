import type { SessionDocument } from '@/services/Firebase/firebase-session.js';

export type SessionStartEligibility =
  | { allowed: true }
  | { allowed: false; status: 403 | 409; message: string };

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
