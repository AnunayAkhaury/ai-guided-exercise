import { describe, expect, it, vi } from 'vitest';
import { requestIdMiddleware } from './request-logging.js';

describe('requestIdMiddleware', () => {
  it('sets an x-request-id response header and calls next', () => {
    const req = {} as any;
    const res = {
      setHeader: vi.fn()
    } as any;
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBeDefined();
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', req.requestId);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
