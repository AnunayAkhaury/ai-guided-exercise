import { describe, expect, it } from 'vitest';
import {
  isAutoStartRecordingProcessingEnabled,
  isLikelyIvsSessionId,
  parseS3Prefix,
  parseS3Uri,
  getRecordingProcessingEligibility,
  resolvePlaybackTarget,
  shouldAutoStartRecordingProcessing,
  shouldPreserveExistingStatus
} from './recording-utils.js';
import type { RecordingDocument } from '@/services/Firebase/firebase-recordings-v2.js';

function recording(overrides: Partial<RecordingDocument> = {}): RecordingDocument {
  const now = new Date('2026-05-20T12:00:00.000Z');

  return {
    recordingId: 'recording-1',
    sessionId: 'session-1',
    participantId: 'participant-1',
    userId: 'user-1',
    rawS3Prefix: 'raw-bucket/ivs/session/recording',
    recordingStart: now,
    recordingEnd: now,
    durationMs: 1000,
    status: 'completed',
    processedVideoUrl: null,
    feedbackJsonUrl: null,
    error: null,
    source: 'eventbridge',
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe('recording utils', () => {
  describe('isLikelyIvsSessionId', () => {
    it('detects IVS realtime session ids', () => {
      expect(isLikelyIvsSessionId('st-123')).toBe(true);
      expect(isLikelyIvsSessionId('app-session-123')).toBe(false);
    });
  });

  describe('parseS3Prefix', () => {
    it('parses bucket and prefix with or without s3 scheme', () => {
      expect(parseS3Prefix('s3://bucket-name/path/to/object/')).toEqual({
        bucket: 'bucket-name',
        keyPrefix: 'path/to/object'
      });
      expect(parseS3Prefix('bucket-name/path/to/object')).toEqual({
        bucket: 'bucket-name',
        keyPrefix: 'path/to/object'
      });
    });

    it('rejects invalid prefixes', () => {
      expect(parseS3Prefix('bucket-only')).toBeNull();
      expect(parseS3Prefix('/missing-bucket')).toBeNull();
      expect(parseS3Prefix('bucket/')).toBeNull();
    });
  });

  describe('parseS3Uri', () => {
    it('returns AWS GetObject bucket and key fields', () => {
      expect(parseS3Uri('s3://clip-bucket/processed/users/user-1/clip.mp4')).toEqual({
        Bucket: 'clip-bucket',
        Key: 'processed/users/user-1/clip.mp4'
      });
    });
  });

  describe('resolvePlaybackTarget', () => {
    it('prefers processed MP4 playback when available', () => {
      expect(
        resolvePlaybackTarget(
          recording({
            processedVideoUrl: 's3://processed-bucket/processed/users/user-1/final_fixed.mp4'
          })
        )
      ).toEqual({
        bucket: 'processed-bucket',
        key: 'processed/users/user-1/final_fixed.mp4',
        source: 'processed'
      });
    });

    it('falls back to the raw high-quality HLS playlist', () => {
      expect(resolvePlaybackTarget(recording())).toEqual({
        bucket: 'raw-bucket',
        key: 'ivs/session/recording/media/hls/high/playlist.m3u8',
        source: 'raw_hls'
      });
    });

    it('returns null for invalid raw prefix without a processed video', () => {
      expect(resolvePlaybackTarget(recording({ rawS3Prefix: 'invalid-prefix' }))).toBeNull();
    });
  });

  describe('isAutoStartRecordingProcessingEnabled', () => {
    it('only enables on true, ignoring case and surrounding spaces', () => {
      expect(isAutoStartRecordingProcessingEnabled(' true ')).toBe(true);
      expect(isAutoStartRecordingProcessingEnabled('TRUE')).toBe(true);
      expect(isAutoStartRecordingProcessingEnabled('false')).toBe(false);
      expect(isAutoStartRecordingProcessingEnabled(undefined)).toBe(false);
    });
  });

  describe('shouldPreserveExistingStatus', () => {
    it('preserves processing recordings from duplicate completed EventBridge updates', () => {
      expect(
        shouldPreserveExistingStatus(
          { status: 'processing', processedVideoUrl: null },
          { source: 'eventbridge', status: 'completed' }
        )
      ).toBe(true);
    });

    it('preserves already processed recordings from duplicate completed EventBridge updates', () => {
      expect(
        shouldPreserveExistingStatus(
          { status: 'completed', processedVideoUrl: 's3://bucket/key.mp4' },
          { source: 'eventbridge', status: 'completed' }
        )
      ).toBe(true);
    });

    it('does not preserve status for non-completed or non-EventBridge updates', () => {
      expect(
        shouldPreserveExistingStatus(
          { status: 'processing', processedVideoUrl: null },
          { source: 'manual', status: 'completed' }
        )
      ).toBe(false);
      expect(
        shouldPreserveExistingStatus(
          { status: 'processing', processedVideoUrl: null },
          { source: 'eventbridge', status: 'queued' }
        )
      ).toBe(false);
    });
  });

  describe('shouldAutoStartRecordingProcessing', () => {
    it('starts only completed EventBridge recordings that have not been processed', () => {
      expect(shouldAutoStartRecordingProcessing(recording(), true)).toBe(true);
    });

    it('does not start when disabled or when required recording data is missing', () => {
      expect(shouldAutoStartRecordingProcessing(recording(), false)).toBe(false);
      expect(shouldAutoStartRecordingProcessing(recording({ source: 'manual' }), true)).toBe(false);
      expect(shouldAutoStartRecordingProcessing(recording({ status: 'queued' }), true)).toBe(false);
      expect(shouldAutoStartRecordingProcessing(recording({ processedVideoUrl: 's3://bucket/key.mp4' }), true)).toBe(false);
      expect(shouldAutoStartRecordingProcessing(recording({ userId: null }), true)).toBe(false);
      expect(shouldAutoStartRecordingProcessing(recording({ rawS3Prefix: ' ' }), true)).toBe(false);
    });
  });

  describe('getRecordingProcessingEligibility', () => {
    it('allows recordings that have a user, raw prefix, and no processed output', () => {
      expect(getRecordingProcessingEligibility(recording())).toEqual({ allowed: true });
    });

    it('rejects recordings without a user id', () => {
      expect(getRecordingProcessingEligibility(recording({ userId: null }))).toEqual({
        allowed: false,
        status: 400,
        message: 'Recording is missing userId and cannot be processed.'
      });
      expect(getRecordingProcessingEligibility(recording({ userId: '   ' }))).toEqual({
        allowed: false,
        status: 400,
        message: 'Recording is missing userId and cannot be processed.'
      });
    });

    it('rejects recordings without a raw S3 prefix', () => {
      expect(getRecordingProcessingEligibility(recording({ rawS3Prefix: '' }))).toEqual({
        allowed: false,
        status: 400,
        message: 'Recording is missing rawS3Prefix and cannot be processed.'
      });
      expect(getRecordingProcessingEligibility(recording({ rawS3Prefix: '   ' }))).toEqual({
        allowed: false,
        status: 400,
        message: 'Recording is missing rawS3Prefix and cannot be processed.'
      });
    });

    it('rejects recordings that are already processing', () => {
      expect(getRecordingProcessingEligibility(recording({ status: 'processing' }))).toEqual({
        allowed: false,
        status: 409,
        message: 'Recording is already processing.'
      });
    });

    it('rejects recordings that already have processed video', () => {
      expect(
        getRecordingProcessingEligibility(
          recording({
            processedVideoUrl: 's3://processed-bucket/processed/users/user-1/final_fixed.mp4'
          })
        )
      ).toEqual({
        allowed: false,
        status: 409,
        message: 'Recording has already been processed.'
      });
    });
  });
});
