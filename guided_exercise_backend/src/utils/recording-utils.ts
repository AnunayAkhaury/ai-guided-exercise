import type { RecordingDocument, RecordingStatus } from '@/services/Firebase/firebase-recordings-v2.js';

type RecordingPlaybackTarget = {
  bucket: string;
  key: string;
  source: 'processed' | 'raw_hls';
};

type RecordingStatusInput = {
  source?: 'manual' | 'eventbridge' | 'worker';
  status?: RecordingStatus;
};

type AutoStartRecordingInput = Pick<
  RecordingDocument,
  'source' | 'status' | 'processedVideoUrl' | 'userId' | 'rawS3Prefix'
>;

type ProcessingEligibilityInput = Pick<
  RecordingDocument,
  'status' | 'processedVideoUrl' | 'userId' | 'rawS3Prefix'
>;

export type RecordingProcessingEligibility =
  | { allowed: true }
  | { allowed: false; status: 400 | 409; message: string };

export function isLikelyIvsSessionId(value: string): boolean {
  return value.startsWith('st-');
}

export function parseS3Prefix(rawS3Prefix: string): { bucket: string; keyPrefix: string } | null {
  const normalized = rawS3Prefix.trim().replace(/^s3:\/\//, '');
  const separatorIdx = normalized.indexOf('/');
  if (separatorIdx <= 0 || separatorIdx === normalized.length - 1) {
    return null;
  }
  return {
    bucket: normalized.slice(0, separatorIdx),
    keyPrefix: normalized.slice(separatorIdx + 1).replace(/\/+$/, '')
  };
}

export function parseS3Uri(uri: string) {
  const url = new URL(uri.replace('s3://', 'https://'));
  return {
    Bucket: url.hostname,
    Key: url.pathname.slice(1)
  };
}

export function resolvePlaybackTarget(
  recording: Pick<RecordingDocument, 'processedVideoUrl' | 'rawS3Prefix'>
): RecordingPlaybackTarget | null {
  const processed = recording.processedVideoUrl ? parseS3Prefix(recording.processedVideoUrl) : null;
  if (processed) {
    return {
      bucket: processed.bucket,
      key: processed.keyPrefix,
      source: 'processed'
    };
  }

  const raw = parseS3Prefix(recording.rawS3Prefix);
  if (!raw) {
    return null;
  }

  return {
    bucket: raw.bucket,
    key: `${raw.keyPrefix}/media/hls/high/playlist.m3u8`,
    source: 'raw_hls'
  };
}

export function isAutoStartRecordingProcessingEnabled(value = process.env.AUTO_START_RECORDING_PROCESSING): boolean {
  return value?.trim().toLowerCase() === 'true';
}

export function shouldPreserveExistingStatus(
  existingRecording: Pick<RecordingDocument, 'status' | 'processedVideoUrl'> | null,
  body: RecordingStatusInput
): boolean {
  if (body.source !== 'eventbridge' || body.status !== 'completed') {
    return false;
  }

  return existingRecording?.status === 'processing' || Boolean(existingRecording?.processedVideoUrl);
}

export function shouldAutoStartRecordingProcessing(
  recording: AutoStartRecordingInput,
  autoStartEnabled: boolean
): boolean {
  return Boolean(
    autoStartEnabled &&
    recording.source === 'eventbridge' &&
    recording.status === 'completed' &&
    !recording.processedVideoUrl &&
    recording.userId?.trim() &&
    recording.rawS3Prefix?.trim()
  );
}

export function getRecordingProcessingEligibility(
  recording: ProcessingEligibilityInput
): RecordingProcessingEligibility {
  if (!recording.userId?.trim()) {
    return { allowed: false, status: 400, message: 'Recording is missing userId and cannot be processed.' };
  }

  if (!recording.rawS3Prefix?.trim()) {
    return { allowed: false, status: 400, message: 'Recording is missing rawS3Prefix and cannot be processed.' };
  }

  if (recording.status === 'processing') {
    return { allowed: false, status: 409, message: 'Recording is already processing.' };
  }

  if (recording.processedVideoUrl) {
    return { allowed: false, status: 409, message: 'Recording has already been processed.' };
  }

  return { allowed: true };
}
