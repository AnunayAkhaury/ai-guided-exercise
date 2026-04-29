import type { Request, Response } from 'express';
import { addClipWithFeedback, addExerciseTimestamp, getFeedbackFromId } from '@/services/Firebase/firebase-feedback.js';
import { logControllerError, sendErrorResponse } from '@/utils/request-logging.js';

export async function addExerciseTimestampController(req: Request, res: Response) {
  const { sessionId, exercise, starttime, endtime } = req.body;
  try {
    await addExerciseTimestamp(sessionId, exercise, starttime, endtime);
    return res.status(200).json({ message: 'Timestamp added.' });
  } catch (err: any) {
    logControllerError(req, err, 'feedbackController failed');
    return sendErrorResponse(req, res, 500, err?.message || 'Internal Server Error');
  }
}

export async function addClipWithFeedbackController(req: Request, res: Response) {
  const expectedWorkerSecret = process.env.WORKER_SHARED_SECRET?.trim();
  if (!expectedWorkerSecret) {
    return sendErrorResponse(req, res, 500, 'Worker shared secret is not configured on server.');
  }

  const providedWorkerSecret = req.header('x-worker-secret');
  if (!providedWorkerSecret || providedWorkerSecret !== expectedWorkerSecret) {
    return sendErrorResponse(req, res, 401, 'Unauthorized worker callback request.');
  }

  const { recordingId, processedVideoUrl, exercise, feedback, userId, duration } = req.body;
  try {
    await addClipWithFeedback(recordingId, processedVideoUrl, exercise, feedback, userId, duration);
    return res.status(200).json({ message: 'Clip with feedback added.' });
  } catch (err: any) {
    logControllerError(req, err, 'feedbackController failed');
    return sendErrorResponse(req, res, 500, err?.message || 'Internal Server Error');
  }
}

export async function getFeedbackFromIdController(req: Request, res: Response) {
  try {
    const feedbackRef = Array.isArray(req.params.feedbackRef) ? req.params.feedbackRef[0] : req.params.feedbackRef;
    if (!feedbackRef?.trim()) {
      return sendErrorResponse(req, res, 400, 'feedbackRef is required.');
    }
    const getFeedbackFromIdResult = await getFeedbackFromId(feedbackRef);
    return res.status(200).json(getFeedbackFromIdResult);
  } catch (err: any) {
    logControllerError(req, err, 'feedbackController failed');
    return sendErrorResponse(req, res, 500, err?.message || 'Internal Server Error');
  }
}
