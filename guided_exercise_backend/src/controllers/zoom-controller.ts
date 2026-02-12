import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

type ZoomTokenRequest = {
  sessionName?: string;
  userName?: string;
  role?: number;
  expirationSeconds?: number;
};

const SESSION_NAME_MAX = 200;
const USER_NAME_MAX = 35;
const MIN_EXP_SECONDS = 1800;
const MAX_EXP_SECONDS = 172800;

export function zoomTokenController(req: Request, res: Response, next: NextFunction) {
  try {
    const { sessionName, userName, role, expirationSeconds } = req.body as ZoomTokenRequest;
    console.log('[ZoomToken] request', {
      sessionName,
      userName,
      role,
      expirationSeconds
    });

    if (!process.env.ZOOM_SDK_KEY || !process.env.ZOOM_SDK_SECRET) {
      return res.status(500).json({ message: 'Zoom SDK credentials are not configured.' });
    }

    if (!sessionName || sessionName.length > SESSION_NAME_MAX) {
      return res.status(400).json({ message: 'Invalid sessionName.' });
    }

    if (userName && userName.length > USER_NAME_MAX) {
      return res.status(400).json({ message: 'Invalid userName.' });
    }

    const roleType = role === 0 || role === 1 ? role : 1;

    if (expirationSeconds && (expirationSeconds < MIN_EXP_SECONDS || expirationSeconds > MAX_EXP_SECONDS)) {
      return res.status(400).json({ message: 'Invalid expirationSeconds.' });
    }

    const iat = Math.floor(Date.now() / 1000);
    const exp = expirationSeconds ? iat + expirationSeconds : iat + 60 * 60 * 2;

    const payload = {
      app_key: process.env.ZOOM_SDK_KEY,
      role_type: roleType,
      tpc: sessionName,
      version: 1,
      iat,
      exp,
      user_identity: userName || undefined
    };

    const token = jwt.sign(payload, process.env.ZOOM_SDK_SECRET, {
      algorithm: 'HS256',
      header: { typ: 'JWT' }
    });

    // Debug: log key token claims (do not log the secret)
    try {
      const decoded = jwt.decode(token) as jwt.JwtPayload | null;
      console.log('[ZoomToken] decoded claims', {
        app_key: decoded?.app_key,
        tpc: decoded?.tpc,
        role_type: decoded?.role_type,
        iat: decoded?.iat,
        exp: decoded?.exp,
        user_identity: decoded?.user_identity
      });
    } catch (err) {
      console.warn('[ZoomToken] failed to decode token for debug', err);
    }
    console.log('[ZoomToken] token length', token.length);

    return res.status(200).json({ token });
  } catch (err) {
    next(err);
    return res.status(500).json({ message: 'Failed to create Zoom token.' });
  }
}
