import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

type RequestWithId = Request & { requestId?: string };

export function getRequestId(req: Request): string {
  const typedReq = req as RequestWithId;
  if (typedReq.requestId) return typedReq.requestId;
  const fallback = randomUUID();
  typedReq.requestId = fallback;
  return fallback;
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = getRequestId(req);
  res.setHeader('x-request-id', requestId);
  next();
}

export function logControllerError(req: Request, err: unknown, context: string) {
  const requestId = getRequestId(req);
  const typedError = err as { message?: string; stack?: string };
  console.error(`[${requestId}] ${context}`, {
    method: req.method,
    path: req.originalUrl,
    body: req.body,
    message: typedError?.message ?? 'Unknown error',
    stack: typedError?.stack ?? null
  });
}

export function sendErrorResponse(
  req: Request,
  res: Response,
  status: number,
  message: string,
  details?: Record<string, unknown>
) {
  const requestId = getRequestId(req);
  return res.status(status).json({
    message,
    requestId,
    ...(details ?? {})
  });
}
