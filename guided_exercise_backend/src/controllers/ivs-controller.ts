import type { Request, Response } from 'express';
import { CreateParticipantTokenCommand, IVSRealTimeClient } from '@aws-sdk/client-ivs-realtime';
import { getSessionById } from '@/services/Firebase/firebase-session.js';
import { logControllerError, sendErrorResponse } from '@/utils/request-logging.js';
import {
  mergeIvsTokenAttributes,
  resolveIvsCapabilities,
  resolveIvsEffectiveUserId,
  resolveSessionScopedTokenAttributes,
  validateIvsDurationMinutes,
  validateIvsUserName
} from '@/utils/session-utils.js';

type IvsTokenRequest = {
  stageArn?: string;
  userName?: string;
  userId?: string;
  publish?: boolean;
  subscribe?: boolean;
  capabilities?: Array<'PUBLISH' | 'SUBSCRIBE'>;
  attributes?: Record<string, string>;
  durationMinutes?: number;
};

const DEFAULT_REGION = process.env.AWS_REGION || 'us-west-2';

async function resolveSessionScopedAttributes(input: {
  attributes?: Record<string, string>;
  userId?: string;
}): Promise<Record<string, string>> {
  const attributes = { ...(input.attributes ?? {}) };
  const sessionId = attributes.sessionId?.trim();
  const userId = input.userId?.trim() || attributes.userId?.trim();

  if (!sessionId || !userId) {
    return attributes;
  }

  const session = await getSessionById(sessionId);
  if (!session) {
    return attributes;
  }

  return resolveSessionScopedTokenAttributes({
    attributes,
    sessionInstructorUid: session.instructorUid,
    userId
  });
}

export async function createIvsTokenController(req: Request, res: Response) {
  try {
    const {
      stageArn,
      userName,
      userId,
      publish,
      subscribe,
      capabilities: requestedCapabilities,
      attributes,
      durationMinutes
    } = req.body as IvsTokenRequest;
    const effectiveStageArn = stageArn ?? process.env.IVS_STAGE_ARN;

    console.log('[IVS][Server] /api/ivs/token request', {
      stageArnProvided: Boolean(stageArn),
      effectiveStageArn,
      userName,
      userId,
      publish,
      subscribe,
      requestedCapabilities,
      durationMinutes
    });

    if (!effectiveStageArn) {
      return sendErrorResponse(req, res, 400, 'stageArn is required (or set IVS_STAGE_ARN).');
    }

    const userNameError = validateIvsUserName(userName);
    if (userNameError) {
      return sendErrorResponse(req, res, 400, userNameError);
    }

    const durationValidation = validateIvsDurationMinutes(durationMinutes);
    if (!durationValidation.valid) {
      return sendErrorResponse(req, res, 400, durationValidation.message);
    }

    const capabilities = resolveIvsCapabilities({
      requestedCapabilities,
      publish,
      subscribe
    });

    if (capabilities.length === 0) {
      return sendErrorResponse(req, res, 400, 'At least one capability is required.');
    }

    const client = new IVSRealTimeClient({ region: DEFAULT_REGION });
    const effectiveUserId = resolveIvsEffectiveUserId({
      userId,
      userName,
      fallbackUserId: `user-${Date.now()}`
    });
    const sessionScopedAttributes = await resolveSessionScopedAttributes({
      ...(attributes ? { attributes } : {}),
      userId: effectiveUserId
    });
    const mergedAttributes = mergeIvsTokenAttributes({
      attributes: sessionScopedAttributes,
      userName
    });

    const command = new CreateParticipantTokenCommand({
      stageArn: effectiveStageArn,
      userId: effectiveUserId,
      capabilities,
      attributes: mergedAttributes,
      duration: durationMinutes
    });

    const response = await client.send(command);

    console.log('[IVS][Server] token created', {
      participantId: response.participantToken?.participantId,
      expirationTime: response.participantToken?.expirationTime
    });

    return res.status(200).json({
      participantId: response.participantToken?.participantId,
      token: response.participantToken?.token,
      expirationTime: response.participantToken?.expirationTime
    });
  } catch (err) {
    logControllerError(req, err, 'createIvsTokenController failed');
    return sendErrorResponse(req, res, 500, 'Failed to create IVS participant token.');
  }
}
