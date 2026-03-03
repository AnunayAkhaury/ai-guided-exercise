import type { NextFunction, Request, Response } from 'express';
import { CreateParticipantTokenCommand, IVSRealTimeClient } from '@aws-sdk/client-ivs-realtime';

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
const USER_NAME_MAX = 128;
const MAX_DURATION_MINUTES = 720; // 12 hours

export async function createIvsTokenController(req: Request, res: Response, next: NextFunction) {
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

    if (!effectiveStageArn) {
      return res.status(400).json({ message: 'stageArn is required (or set IVS_STAGE_ARN).' });
    }

    if (userName && userName.length > USER_NAME_MAX) {
      return res.status(400).json({ message: 'userName must be 128 characters or fewer.' });
    }

    if (
      durationMinutes !== undefined &&
      (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > MAX_DURATION_MINUTES)
    ) {
      return res
        .status(400)
        .json({ message: `durationMinutes must be an integer between 1 and ${MAX_DURATION_MINUTES}.` });
    }

    let capabilities: Array<'PUBLISH' | 'SUBSCRIBE'>;
    if (requestedCapabilities && requestedCapabilities.length > 0) {
      capabilities = requestedCapabilities;
    } else {
      capabilities = [];
      if (publish !== false) {
        capabilities.push('PUBLISH');
      }
      if (subscribe !== false) {
        capabilities.push('SUBSCRIBE');
      }
    }

    if (capabilities.length === 0) {
      return res.status(400).json({ message: 'At least one capability is required.' });
    }

    const client = new IVSRealTimeClient({ region: DEFAULT_REGION });
    const effectiveUserId = userId ?? userName ?? `user-${Date.now()}`;
    const mergedAttributes = {
      ...(attributes ?? {}),
      ...(userName ? { username: userName } : {})
    };

    const command = new CreateParticipantTokenCommand({
      stageArn: effectiveStageArn,
      userId: effectiveUserId,
      capabilities,
      attributes: Object.keys(mergedAttributes).length > 0 ? mergedAttributes : undefined,
      duration: durationMinutes
    });

    const response = await client.send(command);

    return res.status(200).json({
      participantId: response.participantToken?.participantId,
      token: response.participantToken?.token,
      expirationTime: response.participantToken?.expirationTime
    });
  } catch (err) {
    next(err);
    return res.status(500).json({ message: 'Failed to create IVS participant token.' });
  }
}
