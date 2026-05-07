import type { Request, Response } from 'express';
import { registerPushToken, disablePushToken } from '@/services/Firebase/firebase-push-tokens.js';
import type { PushPlatform, PushTokenType } from '@/services/Firebase/firebase-push-tokens.js';
import {
  listSessions,
  markSessionReminderSent
} from '@/services/Firebase/firebase-session.js';
import { sendNotificationToRole } from '@/services/notification-service.js';
import { logControllerError, sendErrorResponse } from '@/utils/request-logging.js';

type RegisterPushTokenRequest = {
  uid?: string;
  token?: string;
  type?: PushTokenType;
  platform?: PushPlatform;
  deviceName?: string;
};

type UnregisterPushTokenRequest = {
  uid?: string;
  token?: string;
};

const VALID_TOKEN_TYPES: PushTokenType[] = ['expo', 'fcm_web'];
const VALID_PLATFORMS: PushPlatform[] = ['ios', 'android', 'web'];
const CLASS_REMINDER_LEAD_MS = 5 * 60 * 1000;

function validateCronSecret(req: Request): 'missing' | 'valid' | 'invalid' {
  const expectedSecret = process.env.NOTIFICATION_CRON_SECRET?.trim();
  if (!expectedSecret) {
    return 'missing';
  }
  return req.header('x-cron-secret') === expectedSecret ? 'valid' : 'invalid';
}

export async function registerPushTokenController(req: Request, res: Response) {
  try {
    const body = req.body as RegisterPushTokenRequest;
    const uid = body.uid?.trim();
    const token = body.token?.trim();
    const type = body.type;
    const platform = body.platform;

    if (!uid) {
      return sendErrorResponse(req, res, 400, 'uid is required.');
    }
    if (!token) {
      return sendErrorResponse(req, res, 400, 'token is required.');
    }
    if (!type || !VALID_TOKEN_TYPES.includes(type)) {
      return sendErrorResponse(req, res, 400, 'type must be expo or fcm_web.');
    }
    if (!platform || !VALID_PLATFORMS.includes(platform)) {
      return sendErrorResponse(req, res, 400, 'platform must be ios, android, or web.');
    }

    const pushToken = await registerPushToken({
      uid,
      token,
      type,
      platform,
      ...(body.deviceName?.trim() ? { deviceName: body.deviceName } : {})
    });

    return res.status(200).json({
      success: true,
      tokenId: pushToken.tokenId,
      type: pushToken.type,
      platform: pushToken.platform
    });
  } catch (err: any) {
    logControllerError(req, err, 'registerPushTokenController failed');
    return sendErrorResponse(req, res, 500, err?.message || 'Failed to register push token.');
  }
}

export async function unregisterPushTokenController(req: Request, res: Response) {
  try {
    const body = req.body as UnregisterPushTokenRequest;
    if (!body.uid?.trim()) {
      return sendErrorResponse(req, res, 400, 'uid is required.');
    }
    if (!body.token?.trim()) {
      return sendErrorResponse(req, res, 400, 'token is required.');
    }

    await disablePushToken(body.uid, body.token);
    return res.status(200).json({ success: true });
  } catch (err: any) {
    logControllerError(req, err, 'unregisterPushTokenController failed');
    return sendErrorResponse(req, res, 500, err?.message || 'Failed to unregister push token.');
  }
}

export async function sendDueClassRemindersController(req: Request, res: Response) {
  try {
    const secretStatus = validateCronSecret(req);
    if (secretStatus === 'missing') {
      return sendErrorResponse(req, res, 500, 'Notification cron secret is not configured on server.');
    }
    if (secretStatus === 'invalid') {
      return sendErrorResponse(req, res, 401, 'Unauthorized notification cron request.');
    }

    const now = Date.now();
    const sessions = await listSessions(['scheduled']);
    const dueSessions = sessions.filter((session) => {
      if (!session.scheduledStartAt || session.reminderSentAt) {
        return false;
      }
      const start = session.scheduledStartAt.getTime();
      return start > now && start <= now + CLASS_REMINDER_LEAD_MS;
    });

    const results = await Promise.allSettled(
      dueSessions.map(async (session) => {
        await sendNotificationToRole('student', {
          title: 'Class starting soon',
          body: `${session.sessionName} starts in about 5 minutes.`,
          data: {
            type: 'class_reminder',
            sessionId: session.sessionId,
            sessionCode: session.sessionCode
          }
        });
        await markSessionReminderSent(session.sessionId);
      })
    );

    return res.status(200).json({
      checked: sessions.length,
      due: dueSessions.length,
      sent: results.filter((result) => result.status === 'fulfilled').length,
      failed: results.filter((result) => result.status === 'rejected').length
    });
  } catch (err: any) {
    logControllerError(req, err, 'sendDueClassRemindersController failed');
    return sendErrorResponse(req, res, 500, err?.message || 'Failed to send due class reminders.');
  }
}
