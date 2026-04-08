import type { NextFunction, Request, Response } from 'express';
export declare function getRequestId(req: Request): string;
export declare function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void;
export declare function logControllerError(req: Request, err: unknown, context: string): void;
export declare function sendErrorResponse(req: Request, res: Response, status: number, message: string, details?: Record<string, unknown>): Response<any, Record<string, any>>;
//# sourceMappingURL=request-logging.d.ts.map