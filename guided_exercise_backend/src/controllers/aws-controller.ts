import type { Request, Response } from 'express';
import type { NextFunction } from 'express';
import { uploadVideoToS3, getVideoFromS3 } from '@/services/AWS/s3.js';

export async function uploadVideoController(req: Request, res: Response, next: NextFunction) {
  try {
    await uploadVideoToS3('ai-guided-exercise-recordings', 'test-video.mp4', 'unused-param');
    res.status(200);
  } catch (err: any) {
    next(err);
    res.status(500).json({ message: err.message || 'Internal Server Error' });
  }
}

export async function getVideoUrlController(req: Request, res: Response, next: NextFunction) {
  try {
    const recordingUrl = await getVideoFromS3('ai-guided-exercise-recordings', 'test-video.mp4');
    res.status(200).json({ recordingUrl });
  } catch (err: any) {
    next(err);
    res.status(500).json({ message: err.message || 'Internal Server Error' });
  }
}
