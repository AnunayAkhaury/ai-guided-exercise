import type { Request, Response } from 'express';
import { createProfile, getProfile } from '@/services/Firebase/firebase-auth.js';
import type { NextFunction } from 'express';
import { addRecording, getUserRecordings } from '@/services/Firebase/firebase-recording.js';

export function helloWorldController(req: Request, res: Response) {
  res.status(500).json({ message: 'OK' });
}

export async function createProfileController(req: Request, res: Response, next: NextFunction) {
  const { uid, role, username, fullname } = req.body;
  try {
    await createProfile(uid, role, username, fullname);
    res.status(200).json({ uid });
  } catch (err: any) {
    next(err);
    res.status(500).json({ message: err.message || 'Internal Server Error' });
  }
}

export async function getProfileController(req: Request, res: Response, next: NextFunction) {
  const { uid } = req.body;
  try {
    const user = await getProfile(uid);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ ...user });
  } catch (err: any) {
    next(err);
    res.status(500).json({ message: err.message || 'Internal Server Error' });
  }
}

export async function addRecordingController(req: Request, res: Response, next: NextFunction) {
  const { uid, url, exercise } = req.body;
  try {
    await addRecording(uid, url, exercise);
    res.status(200).json({ message: 'Recording added.' });
  } catch (err: any) {
    next(err);
    res.status(500).json({ message: err.message || 'Internal Server Error' });
  }
}

export async function getUserRecordingsController(req: Request, res: Response, next: NextFunction) {
  const { uid } = req.body;
  try {
    const recordingList = await getUserRecordings(uid);
    res.status(200).json(recordingList);
  } catch (err: any) {
    next(err);
    res.status(500).json({ message: err.message || 'Internal Server Error' });
  }
}
