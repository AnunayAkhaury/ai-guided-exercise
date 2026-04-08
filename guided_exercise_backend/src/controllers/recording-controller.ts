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
  getRecordingById,
  listRecordingsBySessionId,
  listRecordingsByUserId,
  upsertRecording
} from '@/services/Firebase/firebase-recordings-v2.js';
import { logControllerError, sendErrorResponse } from '@/utils/request-logging.js';

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
      ...(body.status ? { status: body.status } : {}),
      ...(body.processedVideoUrl ? { processedVideoUrl: body.processedVideoUrl } : {}),
      ...(body.feedbackJsonUrl ? { feedbackJsonUrl: body.feedbackJsonUrl } : {}),
      ...(body.error ? { error: body.error } : {})
    };

    const recording = await upsertRecording(payload);

    return res.status(200).json(recording);
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

    const parsed = parseS3Prefix(recording.rawS3Prefix);
    if (!parsed) {
      return sendErrorResponse(req, res, 400, 'Invalid recording S3 prefix.');
    }

    const hlsPlaylistKey = `${parsed.keyPrefix}/media/hls/high/playlist.m3u8`;
    const s3Client = new S3Client({ region: DEFAULT_REGION });
    const command = new GetObjectCommand({
      Bucket: parsed.bucket,
      Key: hlsPlaylistKey
    });
    const playbackUrl = await getSignedUrl(s3Client, command, { expiresIn: PLAYBACK_URL_TTL_SECONDS });

    return res.status(200).json({
      recordingId: recording.recordingId,
      sessionId: recording.sessionId,
      participantId: recording.participantId,
      playbackUrl,
      expiresInSeconds: PLAYBACK_URL_TTL_SECONDS,
      hlsPlaylistKey
    });
  } catch (err: any) {
    logControllerError(req, err, 'getRecordingPlaybackController failed');
    return sendErrorResponse(req, res, 500, err?.message || 'Failed to get recording playback URL.');
  }
}
