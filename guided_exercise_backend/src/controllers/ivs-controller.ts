import type { NextFunction, Request, Response } from 'express';
import { CreateParticipantTokenCommand, IVSRealTimeClient } from '@aws-sdk/client-ivs-realtime';

type IvsTokenRequest = {
  stageArn?: string;
  userId?: string;
  publish?: boolean;
  subscribe?: boolean;
  attributes?: Record<string, string>;
  durationSeconds?: number;
};

const DEFAULT_REGION = process.env.AWS_REGION || 'us-west-2';
const MAX_DURATION_SECONDS = 43200; // 12 hours

export async function createIvsTokenController(req: Request, res: Response, next: NextFunction) {
  try {
    const { stageArn, userId, publish, subscribe, attributes, durationSeconds } = req.body as IvsTokenRequest;

    if (!stageArn) {
      return res.status(400).json({ message: 'stageArn is required.' });
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

    if (durationSeconds && (durationSeconds < 60 || durationSeconds > MAX_DURATION_SECONDS)) {
      return res.status(400).json({ message: 'durationSeconds must be between 60 and 43200.' });
    }

    const client = new IVSRealTimeClient({ region: DEFAULT_REGION });
    const command = new CreateParticipantTokenCommand({
      stageArn,
      userId,
      capabilities,
      attributes,
      duration: durationSeconds
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
