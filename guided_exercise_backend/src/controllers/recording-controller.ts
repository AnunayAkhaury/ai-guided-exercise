import type { Request, Response } from 'express';
import { getSessionById, getSessionParticipantById } from '@/services/Firebase/firebase-session.js';
import { upsertRecording } from '@/services/Firebase/firebase-recordings-v2.js';
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

    const session = await getSessionById(sessionId);
    if (!session) {
      return sendErrorResponse(req, res, 404, 'Session not found.');
    }

    const participant = await getSessionParticipantById(sessionId, participantId);
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
      sessionId,
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
