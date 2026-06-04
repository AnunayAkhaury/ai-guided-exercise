import type { Request, Response } from 'express';
import { createProfile, getProfile, listProfilesByRole, updateProfile } from '@/services/Firebase/firebase-auth.js';
import { addRecording, getUserRecordings } from '@/services/Firebase/firebase-recording.js';
import { getAchievements } from '@/services/Firebase/firebase-achievement.js';
import { getRequestId, logControllerError, sendErrorResponse } from '@/utils/request-logging.js';
import { createApprovalRequest, getUserVerificationStatus, setVerified } from '@/services/email-service.js';

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

export async function listProfilesController(req: Request, res: Response) {
  const role = typeof req.query.role === 'string' ? req.query.role : undefined;
  try {
    const users = await listProfilesByRole(role);
    return res.status(200).json(users);
  } catch (err: any) {
    logControllerError(req, err, 'listProfilesController failed');
    return sendErrorResponse(req, res, 500, err?.message || 'Internal Server Error');
  }
}

export async function updateProfileController(req: Request, res: Response) {
  const { uid, username, fullname } = req.body;
  if (!uid) {
    return sendErrorResponse(req, res, 400, 'uid is required.');
  }

  try {
    const profile = await updateProfile(uid, { username, fullname });
    if (!profile) {
      return sendErrorResponse(req, res, 404, 'User not found');
    }
    return res.status(200).json(profile);
  } catch (err: any) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    const statusCode = message === 'username is required' || message === 'fullname is required' ? 400 : 500;
    logControllerError(req, err, 'updateProfileController failed');
    return sendErrorResponse(req, res, statusCode, message);
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

export async function getUserAchievementsController(req: Request, res: Response) {
  const { uid } = req.body;
  try {
    const achievementsList = await getAchievements(uid);
    return res.status(200).json(achievementsList);
  } catch (err: any) {
    logControllerError(req, err, 'getUserAchievementsController failed');
    return sendErrorResponse(req, res, 500, err?.message || 'Internal Server Error');
  }
}

export async function createApprovalRequestController(req: Request, res: Response) {
  const { uid, userEmail, userName } = req.body;
  try {
    await createApprovalRequest(uid, userEmail, userName ?? '');
    return res.status(200).json({ message: 'Email sent.' });
  } catch (err: any) {
    logControllerError(req, err, 'createApprovalRequestController failed');
    return sendErrorResponse(req, res, 500, err?.message || 'Internal Server Error');
  }
}

export async function verifyAccountController(req: Request, res: Response) {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  if (!token?.trim()) {
    return sendErrorResponse(req, res, 400, 'token is required.');
  }
  try {
    await setVerified(token);
    return res.status(200).json({ message: 'Account verified.' });
  } catch (err: any) {
    logControllerError(req, err, 'verifyAccountController failed');
    return sendErrorResponse(req, res, 500, err?.message || 'Internal Server Error');
  }
}

export async function getUserVerificationStatusController(req: Request, res: Response) {
  const uid = Array.isArray(req.params.uid) ? req.params.uid[0] : req.params.uid;

  if (!uid?.trim()) {
    return sendErrorResponse(req, res, 400, 'uid is required.');
  }

  try {
    const status = await getUserVerificationStatus(uid);
    return res.status(200).json(status);
  } catch (err: any) {
    logControllerError(req, err, 'getVerificationStatus failed');
    return sendErrorResponse(req, res, 500, err?.message || 'Internal Server Error');
  }
}
