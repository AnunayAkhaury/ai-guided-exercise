// ivs-controller.ts
import type { Request, Response, NextFunction } from 'express';
import { IVSRealTimeClient, CreateParticipantTokenCommand } from "@aws-sdk/client-ivs-realtime";

type IvsTokenRequest = {
  stageArn?: string;
  userName?: string;
  userId?: string;
  capabilities?: ('PUBLISH' | 'SUBSCRIBE')[];
  durationMinutes?: number;
};

const USER_NAME_MAX = 128; 
const MIN_DURATION_MINUTES = 1;
const MAX_DURATION_MINUTES = 120; // 2 hours

const ivsClient = new IVSRealTimeClient({ region: process.env.AWS_REGION || 'us-west-2' });

export async function ivsTokenController(req: Request, res: Response, next: NextFunction) {
  try {
    const { stageArn, userName, userId, capabilities, durationMinutes } = req.body as IvsTokenRequest;
    
    console.log('[IVSToken] request', {
      stageArn,
      userName,
      userId,
      capabilities,
      durationMinutes
    });

    if (!stageArn) {
      return res.status(400).json({ message: 'Invalid stageArn.' });
    }

    if (userName && userName.length > USER_NAME_MAX) {
      return res.status(400).json({ message: 'Invalid userName.' });
    }

    if (durationMinutes && (durationMinutes < MIN_DURATION_MINUTES || durationMinutes > MAX_DURATION_MINUTES)) {
      return res.status(400).json({ message: 'Invalid durationMinutes.' });
    }

    // Prepare the command for AWS IVS
    const command = new CreateParticipantTokenCommand({
      stageArn,
      duration: durationMinutes || 120, // 2 hours
      userId: userId || userName || `user-${Date.now()}`,
      attributes: userName ? { username: userName } : undefined, // for storing participant-specific info
      capabilities: capabilities && capabilities.length > 0 ? capabilities : ['PUBLISH', 'SUBSCRIBE']
    });

    const response = await ivsClient.send(command);
    const token = response.participantToken?.token;

    if (!token) {
      throw new Error('No token returned from AWS IVS.');
    }

    console.log('[IVSToken] token length', token.length);

    return res.status(200).json({ token });
  } catch (err) {
    console.error('[IVSToken] Error generating token:', err);
    next(err);
    return res.status(500).json({ message: 'Failed to create IVS token.' });
  }
}