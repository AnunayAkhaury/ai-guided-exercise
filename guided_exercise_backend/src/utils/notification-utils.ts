import type { SessionDocument } from '@/services/Firebase/firebase-session.js';

export type CronSecretStatus = 'missing' | 'valid' | 'invalid';

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
