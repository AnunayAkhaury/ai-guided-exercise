import type { Request, Response } from 'express';
import { registerPushToken, disablePushToken } from '@/services/Firebase/firebase-push-tokens.js';
import type { PushPlatform, PushTokenType } from '@/services/Firebase/firebase-push-tokens.js';
import {
  listSessions,
  markSessionReminderSent
} from '@/services/Firebase/firebase-session.js';
import { sendNotificationToRole } from '@/services/notification-service.js';
import {
  getCronSecretStatus,
  getDueReminderSessions,
  summarizeSettledResults,
  validatePushTokenRegistration,
  validatePushTokenUnregistration
} from '@/utils/notification-utils.js';
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

const CLASS_REMINDER_LEAD_MS = 5 * 60 * 1000;

export async function registerPushTokenController(req: Request, res: Response) {
  try {
    const body = req.body as RegisterPushTokenRequest;
    const validation = validatePushTokenRegistration(body);

    if (!validation.valid) {
      return sendErrorResponse(req, res, 400, validation.message);
    }

    const pushToken = await registerPushToken({
      uid: validation.uid,
      token: validation.token,
      type: validation.type,
      platform: validation.platform,
      ...(validation.deviceName ? { deviceName: validation.deviceName } : {})
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
    const validation = validatePushTokenUnregistration(body);

    if (!validation.valid) {
      return sendErrorResponse(req, res, 400, validation.message);
    }

    await disablePushToken(validation.uid, validation.token);
    return res.status(200).json({ success: true });
  } catch (err: any) {
    logControllerError(req, err, 'unregisterPushTokenController failed');
    return sendErrorResponse(req, res, 500, err?.message || 'Failed to unregister push token.');
  }
}

export async function sendDueClassRemindersController(req: Request, res: Response) {
  try {
    const secretStatus = getCronSecretStatus(process.env.NOTIFICATION_CRON_SECRET, req.header('x-cron-secret'));
    if (secretStatus === 'missing') {
      return sendErrorResponse(req, res, 500, 'Notification cron secret is not configured on server.');
    }
    if (secretStatus === 'invalid') {
      return sendErrorResponse(req, res, 401, 'Unauthorized notification cron request.');
    }

    const now = Date.now();
    const sessions = await listSessions(['scheduled']);
    const dueSessions = getDueReminderSessions(sessions, now, CLASS_REMINDER_LEAD_MS);

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

    const summary = summarizeSettledResults(results);

    return res.status(200).json({
      checked: sessions.length,
      due: dueSessions.length,
      sent: summary.sent,
      failed: summary.failed
    });
  } catch (err: any) {
    logControllerError(req, err, 'sendDueClassRemindersController failed');
    return sendErrorResponse(req, res, 500, err?.message || 'Failed to send due class reminders.');
  }
}
