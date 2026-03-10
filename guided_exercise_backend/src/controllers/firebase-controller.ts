import type { Request, Response } from 'express';
import { createProfile, getProfile } from '@/services/Firebase/firebase-auth.js';
import { addRecording, getUserRecordings } from '@/services/Firebase/firebase-recording.js';
import { getRequestId, logControllerError, sendErrorResponse } from '@/utils/request-logging.js';

export function helloWorldController(req: Request, res: Response) {
  res.status(200).json({ message: 'OK', requestId: getRequestId(req), timestamp: new Date().toISOString() });
}

export async function createProfileController(req: Request, res: Response) {
  const { uid, role, username, fullname, email } = req.body;
  try {
    const profile = await createProfile(uid, role, username, fullname, email);
    return res.status(200).json({ uid, ...profile });
  } catch (err: any) {
    logControllerError(req, err, 'createProfileController failed');
    return sendErrorResponse(req, res, 500, err?.message || 'Internal Server Error');
  }
}

export async function getProfileController(req: Request, res: Response) {
  const { uid } = req.body;
  try {
    const user = await getProfile(uid);
    if (!user) {
      return sendErrorResponse(req, res, 404, 'User not found');
    }
    return res.status(200).json({ ...user });
  } catch (err: any) {
    logControllerError(req, err, 'getProfileController failed');
    return sendErrorResponse(req, res, 500, err?.message || 'Internal Server Error');
  }
}

export async function addRecordingController(req: Request, res: Response) {
  const { uid, url, exercise } = req.body;
  try {
    await addRecording(uid, url, exercise);
    return res.status(200).json({ message: 'Recording added.' });
  } catch (err: any) {
    logControllerError(req, err, 'addRecordingController failed');
    return sendErrorResponse(req, res, 500, err?.message || 'Internal Server Error');
  }
}

export async function getUserRecordingsController(req: Request, res: Response) {
  const { uid } = req.body;
  try {
    const recordingList = await getUserRecordings(uid);
    return res.status(200).json(recordingList);
  } catch (err: any) {
    logControllerError(req, err, 'getUserRecordingsController failed');
    return sendErrorResponse(req, res, 500, err?.message || 'Internal Server Error');
  }
}
