import type { Request, Response, NextFunction } from 'express';
import { auth } from '../services/Firebase/firebase-service.js';

declare global {
  namespace Express {
    interface Request {
      jwtUid: string;
    }
  }
}

export async function verifyFirebaseToken(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing token' });
    }

    const token = header.substring(7);

    const decoded = await auth.verifyIdToken(token);

    req.jwtUid = decoded.uid;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function checkUidEqual(first: string, second: string) {
  if (first !== second) {
    throw new Error('JWT uid does not match request uid, invalid requset.');
  }
}
