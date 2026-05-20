import type { IvsClip } from '@/src/api/ivs';
import { EXERCISE_TITLE_MAP } from '@/src/constants/exerciseMap';

export type ClipSessionGroup = {
  key: string;
  title: string;
  latestStart: number;
  items: IvsClip[];
  exercises: string[];
};

export function toTimestamp(value?: string | null): number {
  if (!value) return 0;
  const timestamp = Number(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function formatDate(value?: string | null) {
  const timestamp = toTimestamp(value);
  if (!timestamp) return 'Unknown date';

  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return 'Unknown date';

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function formatTime(value?: string | null) {
  const timestamp = toTimestamp(value);
  if (!timestamp) return 'Unknown time';

  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return 'Unknown time';

  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function formatDuration(value?: string | null) {
  const durationMs = Number(value);
  if (!value || !Number.isFinite(durationMs) || durationMs < 1000) return '0s';

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

export function formatClipTimeRange(clip: IvsClip) {
  const startMs = toTimestamp(clip.starttime);
  const durationMs = Number(clip.duration);

  if (!startMs || !Number.isFinite(durationMs) || durationMs <= 0) {
    return formatTime(clip.starttime);
  }

  return `${formatTime(clip.starttime)} - ${formatTime(String(startMs + durationMs))}`;
}

export function formatExercise(exercise: string) {
  return EXERCISE_TITLE_MAP[exercise] ?? exercise;
}

export function buildSessionGroups(clips: IvsClip[]): ClipSessionGroup[] {
  const sortedClips = [...clips].sort((a, b) => toTimestamp(b.starttime) - toTimestamp(a.starttime));
  const groups = new Map<string, ClipSessionGroup>();

  sortedClips.forEach((clip) => {
    const sessionId = clip.sessionId?.trim();
    const recordingId = clip.recordingId?.trim();
    const key = sessionId || recordingId || 'legacy-clips';
    const existing = groups.get(key);
    const title = clip.sessionName?.trim() || (sessionId ? 'Untitled session' : 'Legacy clips');
    const startTime = toTimestamp(clip.starttime);
    const exerciseTitle = formatExercise(clip.exercise);

    if (existing) {
      existing.items.push(clip);
      existing.latestStart = Math.max(existing.latestStart, startTime);
      if (!existing.exercises.includes(exerciseTitle)) existing.exercises.push(exerciseTitle);
      if (existing.title === 'Untitled session' && title !== 'Untitled session') existing.title = title;
      return;
    }

    groups.set(key, {
      key,
      title,
      latestStart: startTime,
      items: [clip],
      exercises: [exerciseTitle]
    });
  });

  return Array.from(groups.values()).sort((a, b) => b.latestStart - a.latestStart);
}
