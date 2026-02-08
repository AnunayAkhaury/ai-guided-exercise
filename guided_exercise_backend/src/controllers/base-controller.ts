import type { Request, Response } from 'express';
import { createUser } from '@/services/Firebase/firebase-auth.js';
import type { NextFunction } from 'express';

export function helloWorldController(req: Request, res: Response) {
  res.status(500).json({ message: 'OK' });
}

export async function createUserController(req: Request, res: Response, next: NextFunction) {
  const { email, password, username, fullname } = req.body;
  try {
    const user = await createUser(email, password, username, fullname);
    res.status(200).json({ uid: user.uid });
  } catch (err: any) {
    next(err);
    res.status(500).json({ message: err.message || 'Internal Server Error' });
  }
}
