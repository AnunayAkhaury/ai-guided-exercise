import type { Request, Response } from 'express';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  findLatestSessionByParticipantId,
  getSessionById,
  getSessionByIvsSessionId,
  getSessionParticipantById,
  updateSessionIvsSessionId
} from '@/services/Firebase/firebase-session.js';
import {
  claimRecordingForProcessing,
  getRecordingById,
  listRecordingsBySessionId,
  listRecordingsByUserId,
  toRecordingId,
  updateRecordingById,
  upsertRecording
} from '@/services/Firebase/firebase-recordings-v2.js';
import type { RecordingDocument } from '@/services/Firebase/firebase-recordings-v2.js';
import { startRecordingWorkerTask } from '@/services/AWS/ecs.js';
import { getRequestId, logControllerError, sendErrorResponse } from '@/utils/request-logging.js';
import { getTimestamps } from '@/services/Firebase/firebase-feedback.js';

type UpsertRecordingRequest = {
  recordingId?: string;
  sessionId?: string;
  participantId?: string;
  rawS3Prefix?: string;
  recordingStart?: string;
  recordingEnd?: string;
  durationMs?: number;
  status?: 'queued' | 'processing' | 'completed' | 'failed';
  processedVideoUrl?: string;
  feedbackJsonUrl?: string;
  error?: string;
  source?: 'manual' | 'eventbridge' | 'worker';
};

type WorkerCompleteRequest = {
  recordingId?: string;
  processedVideoUrl?: string;
  feedbackJsonUrl?: string;
  status?: string;
  error?: string;
  outputBucket?: string;
  outputKey?: string;
};

const DEFAULT_REGION = process.env.AWS_REGION || 'us-west-2';
const PLAYBACK_URL_TTL_SECONDS = 10 * 60;

function isLikelyIvsSessionId(value: string): boolean {
  return value.startsWith('st-');
}

function parseS3Prefix(rawS3Prefix: string): { bucket: string; keyPrefix: string } | null {
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

function resolvePlaybackTarget(
  recording: RecordingDocument
): { bucket: string; key: string; source: 'processed' | 'raw_hls' } | null {
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

function isAutoStartRecordingProcessingEnabled(): boolean {
  return process.env.AUTO_START_RECORDING_PROCESSING?.trim().toLowerCase() === 'true';
}

function shouldPreserveExistingStatus(
  existingRecording: RecordingDocument | null,
  body: UpsertRecordingRequest
): boolean {
  if (body.source !== 'eventbridge' || body.status !== 'completed') {
    return false;
  }

  return existingRecording?.status === 'processing' || Boolean(existingRecording?.processedVideoUrl);
}

function shouldAutoStartRecordingProcessing(recording: RecordingDocument): boolean {
  return Boolean(
    isAutoStartRecordingProcessingEnabled() &&
    recording.source === 'eventbridge' &&
    recording.status === 'completed' &&
    !recording.processedVideoUrl &&
    recording.userId?.trim() &&
    recording.rawS3Prefix?.trim()
  );
}

async function autoStartRecordingProcessing(req: Request, recording: RecordingDocument): Promise<RecordingDocument> {
  if (!shouldAutoStartRecordingProcessing(recording)) {
    return recording;
  }

  const claimedRecording = await claimRecordingForProcessing(recording.recordingId);
  if (!claimedRecording) {
    return (await getRecordingById(recording.recordingId)) ?? recording;
  }

  const timestampInfo = await getTimestamps(claimedRecording.recordingId).catch(() => null);

  const safeTimestampInfo = timestampInfo ?? {
    recordingStartMs: null,
    timestamps: []
  };

  try {
    await startRecordingWorkerTask({
      recordingId: claimedRecording.recordingId,
      rawS3Prefix: claimedRecording.rawS3Prefix,
      userId: claimedRecording.userId!,
      recordingStart: safeTimestampInfo.recordingStartMs,
      timestamps: safeTimestampInfo.timestamps
    });

    return claimedRecording;
  } catch (err: any) {
    const failedRecording = await updateRecordingById(recording.recordingId, {
      status: 'failed',
      error: err?.message || 'Failed to start recording worker task.'
    });

    logControllerError(req, err, 'upsertRecordingController failed to auto-start ECS task');
    return failedRecording;
  }
}

export async function upsertRecordingController(req: Request, res: Response) {
  try {
    const expectedIngestSecret = process.env.RECORDING_INGEST_SECRET;
    if (!expectedIngestSecret) {
      return sendErrorResponse(req, res, 500, 'Recording ingest secret is not configured on server.');
    }

    const providedIngestSecret = req.header('x-ingest-secret');
    if (!providedIngestSecret || providedIngestSecret !== expectedIngestSecret) {
      return sendErrorResponse(req, res, 401, 'Unauthorized recording ingest request.');
    }

    const body = req.body as UpsertRecordingRequest;
    if (!body.sessionId?.trim()) {
      return sendErrorResponse(req, res, 400, 'sessionId is required.');
    }
    if (!body.participantId?.trim()) {
      return sendErrorResponse(req, res, 400, 'participantId is required.');
    }
    if (!body.rawS3Prefix?.trim()) {
      return sendErrorResponse(req, res, 400, 'rawS3Prefix is required.');
    }
    const sessionId = body.sessionId.trim();
    const participantId = body.participantId.trim();
    const rawS3Prefix = body.rawS3Prefix.trim();

    // Ingest first tries IVS session linkage, then app session id.
    let session = await getSessionByIvsSessionId(sessionId);
    if (!session) {
      session = await getSessionById(sessionId);
    }
    let effectiveSessionId = session?.sessionId ?? sessionId;
    if (!session) {
      // Fall back to resolving by participant linkage captured at join/rejoin.
      const inferredSession = await findLatestSessionByParticipantId(participantId);
      if (inferredSession) {
        session = inferredSession;
        effectiveSessionId = inferredSession.sessionId;
        // Backfill IVS session id mapping so subsequent events resolve directly.
        if (isLikelyIvsSessionId(sessionId) && inferredSession.ivsSessionId !== sessionId) {
          await updateSessionIvsSessionId(inferredSession.sessionId, sessionId);
        }
      }
    }

    if (!session) {
      return sendErrorResponse(req, res, 404, 'Session not found for provided sessionId/participantId.');
    }

    const participant = await getSessionParticipantById(effectiveSessionId, participantId);
    const userId = participant?.userId ?? null;

    const recordingStart = body.recordingStart ? new Date(body.recordingStart) : null;
    const recordingEnd = body.recordingEnd ? new Date(body.recordingEnd) : null;
    if (recordingStart && Number.isNaN(recordingStart.getTime())) {
      return sendErrorResponse(req, res, 400, 'recordingStart must be a valid ISO date string.');
    }
    if (recordingEnd && Number.isNaN(recordingEnd.getTime())) {
      return sendErrorResponse(req, res, 400, 'recordingEnd must be a valid ISO date string.');
    }

    const resolvedRecordingId = toRecordingId({
      recordingId: body.recordingId,
      rawS3Prefix
    });
    const existingRecording = await getRecordingById(resolvedRecordingId);
    const preserveExistingStatus = shouldPreserveExistingStatus(existingRecording, body);

    const payload = {
      sessionId: effectiveSessionId,
      participantId,
      userId,
      rawS3Prefix,
      recordingStart,
      recordingEnd,
      source: body.source ?? 'manual',
      ...(body.recordingId ? { recordingId: body.recordingId } : {}),
      ...(typeof body.durationMs === 'number' ? { durationMs: body.durationMs } : {}),
      ...(body.status && !preserveExistingStatus ? { status: body.status } : {}),
      ...(body.processedVideoUrl ? { processedVideoUrl: body.processedVideoUrl } : {}),
      ...(body.feedbackJsonUrl ? { feedbackJsonUrl: body.feedbackJsonUrl } : {}),
      ...(body.error && !preserveExistingStatus ? { error: body.error } : {})
    };

    const recording = await upsertRecording(payload);
    const finalRecording = await autoStartRecordingProcessing(req, recording);

    return res.status(200).json(finalRecording);
  } catch (err: any) {
    logControllerError(req, err, 'upsertRecordingController failed');
    return sendErrorResponse(req, res, 500, err?.message || 'Failed to upsert recording.');
  }
}

export async function listRecordingsBySessionController(req: Request, res: Response) {
  try {
    const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
    if (!sessionId?.trim()) {
      return sendErrorResponse(req, res, 400, 'sessionId is required.');
    }

    const session = await getSessionById(sessionId);
    if (!session) {
      return sendErrorResponse(req, res, 404, 'Session not found.');
    }

    const recordings = await listRecordingsBySessionId(sessionId);
    return res.status(200).json(recordings);
  } catch (err: any) {
    logControllerError(req, err, 'listRecordingsBySessionController failed');
    return sendErrorResponse(req, res, 500, err?.message || 'Failed to list recordings by session.');
  }
}

export async function listRecordingsByUserController(req: Request, res: Response) {
  try {
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    if (!userId?.trim()) {
      return sendErrorResponse(req, res, 400, 'userId is required.');
    }

    const recordings = await listRecordingsByUserId(userId);
    return res.status(200).json(recordings);
  } catch (err: any) {
    logControllerError(req, err, 'listRecordingsByUserController failed');
    return sendErrorResponse(req, res, 500, err?.message || 'Failed to list recordings by user.');
  }
}

export async function getRecordingPlaybackController(req: Request, res: Response) {
  try {
    const recordingId = Array.isArray(req.params.recordingId) ? req.params.recordingId[0] : req.params.recordingId;
    if (!recordingId?.trim()) {
      return sendErrorResponse(req, res, 400, 'recordingId is required.');
    }

    const recording = await getRecordingById(recordingId);
    if (!recording) {
      return sendErrorResponse(req, res, 404, 'Recording not found.');
    }

    const target = resolvePlaybackTarget(recording);
    if (!target) {
      return sendErrorResponse(req, res, 400, 'Invalid recording playback target.');
    }

    const s3Client = new S3Client({ region: DEFAULT_REGION });
    const command = new GetObjectCommand({
      Bucket: target.bucket,
      Key: target.key
    });
    const playbackUrl = await getSignedUrl(s3Client, command, { expiresIn: PLAYBACK_URL_TTL_SECONDS });

    return res.status(200).json({
      recordingId: recording.recordingId,
      sessionId: recording.sessionId,
      participantId: recording.participantId,
      playbackUrl,
      expiresInSeconds: PLAYBACK_URL_TTL_SECONDS,
      source: target.source,
      objectKey: target.key
    });
  } catch (err: any) {
    logControllerError(req, err, 'getRecordingPlaybackController failed');
    return sendErrorResponse(req, res, 500, err?.message || 'Failed to get recording playback URL.');
  }
}

export async function startRecordingProcessingController(req: Request, res: Response) {
  try {
    const recordingId = Array.isArray(req.params.recordingId) ? req.params.recordingId[0] : req.params.recordingId;
    if (!recordingId?.trim()) {
      return sendErrorResponse(req, res, 400, 'recordingId is required.');
    }

    const recording = await getRecordingById(recordingId);
    if (!recording) {
      return sendErrorResponse(req, res, 404, 'Recording not found.');
    }

    if (!recording.userId?.trim()) {
      return sendErrorResponse(req, res, 400, 'Recording is missing userId and cannot be processed.');
    }

    if (!recording.rawS3Prefix?.trim()) {
      return sendErrorResponse(req, res, 400, 'Recording is missing rawS3Prefix and cannot be processed.');
    }

    if (recording.status === 'processing') {
      return sendErrorResponse(req, res, 409, 'Recording is already processing.');
    }

    if (recording.processedVideoUrl) {
      return sendErrorResponse(req, res, 409, 'Recording has already been processed.');
    }

    const processingRecording = await updateRecordingById(recording.recordingId, {
      status: 'processing',
      error: null
    });

    const timestampInfo = await getTimestamps(recording.recordingId).catch(() => null);

    const safeTimestampInfo = timestampInfo ?? {
      recordingStartMs: null,
      timestamps: []
    };

    try {
      const taskArn = await startRecordingWorkerTask({
        recordingId: processingRecording.recordingId,
        rawS3Prefix: processingRecording.rawS3Prefix,
        userId: processingRecording.userId!,
        recordingStart: safeTimestampInfo.recordingStartMs,
        timestamps: safeTimestampInfo.timestamps
      });

      return res.status(202).json({
        message: 'Recording processing started.',
        recording: processingRecording,
        taskArn
      });
    } catch (err: any) {
      const failedRecording = await updateRecordingById(recording.recordingId, {
        status: 'failed',
        error: err?.message || 'Failed to start recording worker task.'
      });

      logControllerError(req, err, 'startRecordingProcessingController failed to start ECS task');
      return res.status(500).json({
        message: failedRecording.error || 'Failed to start recording worker task.',
        requestId: getRequestId(req),
        recording: failedRecording
      });
    }
  } catch (err: any) {
    logControllerError(req, err, 'startRecordingProcessingController failed');
    return sendErrorResponse(req, res, 500, err?.message || 'Failed to start recording processing.');
  }
}

export async function completeRecordingProcessingController(req: Request, res: Response) {
  try {
    const expectedWorkerSecret = process.env.WORKER_SHARED_SECRET?.trim();
    if (!expectedWorkerSecret) {
      return sendErrorResponse(req, res, 500, 'Worker shared secret is not configured on server.');
    }

    const providedWorkerSecret = req.header('x-worker-secret');
    if (!providedWorkerSecret || providedWorkerSecret !== expectedWorkerSecret) {
      return sendErrorResponse(req, res, 401, 'Unauthorized worker callback request.');
    }

    const body = req.body as WorkerCompleteRequest;
    const recordingId = body.recordingId?.trim();
    if (!recordingId) {
      return sendErrorResponse(req, res, 400, 'recordingId is required.');
    }

    const recording = await getRecordingById(recordingId);
    if (!recording) {
      return sendErrorResponse(req, res, 404, 'Recording not found.');
    }

    const failed = body.status?.trim().toLowerCase() === 'failed' || Boolean(body.error?.trim());
    if (failed) {
      // Preserve a successful processed video if a later retry reports failure.
      if (recording.processedVideoUrl) {
        return res.status(200).json({
          message: 'Ignoring worker failure callback because recording already has a processed video.',
          recording
        });
      }

      const failedRecording = await updateRecordingById(recordingId, {
        status: 'failed',
        error: body.error?.trim() || 'Worker reported processing failure.'
      });

      return res.status(200).json({
        message: 'Recording marked as failed.',
        recording: failedRecording
      });
    }

    const processedVideoUrl = body.processedVideoUrl?.trim();
    if (!processedVideoUrl) {
      return sendErrorResponse(req, res, 400, 'processedVideoUrl is required for a successful worker callback.');
    }

    const completedRecording = await updateRecordingById(recordingId, {
      status: 'completed',
      processedVideoUrl,
      ...(body.feedbackJsonUrl?.trim() ? { feedbackJsonUrl: body.feedbackJsonUrl.trim() } : {}),
      error: null
    });

    return res.status(200).json({
      message: 'Recording processing completed.',
      recording: completedRecording
    });
  } catch (err: any) {
    logControllerError(req, err, 'completeRecordingProcessingController failed');
    return sendErrorResponse(req, res, 500, err?.message || 'Failed to complete recording processing.');
  }
}
