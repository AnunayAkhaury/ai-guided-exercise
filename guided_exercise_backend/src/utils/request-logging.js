import { randomUUID } from 'node:crypto';
export function getRequestId(req) {
    const typedReq = req;
    if (typedReq.requestId)
        return typedReq.requestId;
    const fallback = randomUUID();
    typedReq.requestId = fallback;
    return fallback;
}
export function requestIdMiddleware(req, res, next) {
    const requestId = getRequestId(req);
    res.setHeader('x-request-id', requestId);
    next();
}
export function logControllerError(req, err, context) {
    const requestId = getRequestId(req);
    const typedError = err;
    console.error(`[${requestId}] ${context}`, {
        method: req.method,
        path: req.originalUrl,
        body: req.body,
        message: typedError?.message ?? 'Unknown error',
        stack: typedError?.stack ?? null
    });
}
export function sendErrorResponse(req, res, status, message, details) {
    const requestId = getRequestId(req);
    return res.status(status).json({
        message,
        requestId,
        ...(details ?? {})
    });
}
//# sourceMappingURL=request-logging.js.map