import type { Request, Response } from 'express';
import { createProfile, getProfile } from '@/services/Firebase/firebase-auth.js';
import type { NextFunction } from 'express';

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
