import type { NextFunction, Request, Response } from 'express';
import { CreateParticipantTokenCommand, IVSRealTimeClient } from '@aws-sdk/client-ivs-realtime';

type IvsTokenRequest = {
  stageArn?: string;
  userId?: string;
  publish?: boolean;
  subscribe?: boolean;
  attributes?: Record<string, string>;
  durationMinutes?: number;
};

const DEFAULT_REGION = process.env.AWS_REGION || 'us-west-2';
const MAX_DURATION_MINUTES = 720; // 12 hours

export async function createIvsTokenController(req: Request, res: Response, next: NextFunction) {
  try {
    const { stageArn, userId, publish, subscribe, attributes, durationMinutes } = req.body as IvsTokenRequest;
    const effectiveStageArn = stageArn ?? process.env.IVS_STAGE_ARN;

    if (!effectiveStageArn) {
      return res.status(400).json({ message: 'stageArn is required (or set IVS_STAGE_ARN).' });
    }

    const capabilities: Array<'PUBLISH' | 'SUBSCRIBE'> = [];
    if (publish !== false) {
      capabilities.push('PUBLISH');
    }
    if (subscribe !== false) {
      capabilities.push('SUBSCRIBE');
    }
    if (capabilities.length === 0) {
      return res.status(400).json({ message: 'At least one capability is required.' });
    }

    if (
      durationMinutes !== undefined &&
      (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > MAX_DURATION_MINUTES)
    ) {
      return res
        .status(400)
        .json({ message: `durationMinutes must be an integer between 1 and ${MAX_DURATION_MINUTES}.` });
    }

    const client = new IVSRealTimeClient({ region: DEFAULT_REGION });
    const command = new CreateParticipantTokenCommand({
      stageArn: effectiveStageArn,
      userId,
      capabilities,
      attributes,
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
