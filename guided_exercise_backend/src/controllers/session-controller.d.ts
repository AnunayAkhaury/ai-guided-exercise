import type { Request, Response } from 'express';
export declare function createSessionController(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function joinSessionByCodeController(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function getSessionByIdController(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function listSessionsController(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function startSessionController(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function endSessionController(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function upsertSessionParticipantController(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function listSessionParticipantsController(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function leaveSessionParticipantController(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=session-controller.d.ts.map