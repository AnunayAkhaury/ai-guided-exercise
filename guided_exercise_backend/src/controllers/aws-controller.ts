import type { Request, Response } from 'express';
import { uploadVideoToS3, getVideoFromS3 } from '@/services/AWS/s3.js';
import { logControllerError, sendErrorResponse } from '@/utils/request-logging.js';

export async function uploadVideoController(req: Request, res: Response) {
  try {
    await uploadVideoToS3('ai-guided-exercise-recordings', 'test-video.mp4', 'unused-param');
    return res.status(200).json({ message: 'Upload request completed.' });
  } catch (err: any) {
    logControllerError(req, err, 'uploadVideoController failed');
    return sendErrorResponse(req, res, 500, err?.message || 'Internal Server Error');
  }
}

export async function getVideoUrlController(req: Request, res: Response) {
  try {
    const recordingUrl = await getVideoFromS3('ai-guided-exercise-recordings', 'test-video.mp4');
    return res.status(200).json({ recordingUrl });
  } catch (err: any) {
    logControllerError(req, err, 'getVideoUrlController failed');
    return sendErrorResponse(req, res, 500, err?.message || 'Internal Server Error');
  }
}
