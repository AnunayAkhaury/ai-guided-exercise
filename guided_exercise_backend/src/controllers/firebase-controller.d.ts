import type { Request, Response } from 'express';
export declare function helloWorldController(req: Request, res: Response): void;
export declare function createProfileController(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function getProfileController(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function addRecordingController(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
export declare function getUserRecordingsController(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=firebase-controller.d.ts.map