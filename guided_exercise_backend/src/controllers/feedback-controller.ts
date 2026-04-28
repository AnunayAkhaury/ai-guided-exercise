import type { Request, Response } from 'express';
import { addExerciseTimestamp } from '@/services/Firebase/firebase-feedback.js';
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
