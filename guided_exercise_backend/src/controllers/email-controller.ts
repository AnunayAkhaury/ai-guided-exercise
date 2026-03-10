import type { Request, Response, NextFunction } from 'express';
import { sendEmail } from '@/services/Email/email-bot.js';

export async function sendEmailController(req: Request, res: Response, next: NextFunction) {
  try {
    const { to, content } = req.body;
    sendEmail(to, content);
    res.status(200);
  } catch (err: any) {
    next(err);
    res.status(500).json({ message: err.message || 'Internal Server Error' });
  }
}
