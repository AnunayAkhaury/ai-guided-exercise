import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addIvsTelemetryController } from './telemetry-controller.js';
import { addIvsTelemetryEvent } from '@/services/Firebase/firebase-telemetry.js';

vi.mock('@/services/Firebase/firebase-telemetry.js', () => ({
  addIvsTelemetryEvent: vi.fn()
}));

function createTelemetryTestApp() {
  const app = express();
  app.use(express.json());
  app.post('/ivs/telemetry', addIvsTelemetryController);
  return app;
}

describe('telemetry route', () => {
  const app = createTelemetryTestApp();

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unsupported telemetry events', async () => {
    const response = await request(app).post('/ivs/telemetry').send({ eventName: 'unknown' });

    expect(response.status).toBe(400);
    expect(addIvsTelemetryEvent).not.toHaveBeenCalled();
  });

  it('stores normalized telemetry events', async () => {
    vi.mocked(addIvsTelemetryEvent).mockResolvedValue({
      id: 'telemetry-1',
      createdAt: new Date('2026-05-27T10:00:00.000Z')
    });

    const response = await request(app).post('/ivs/telemetry').send({
      eventName: 'join_attempt',
      role: 'coach',
      sessionId: 'session-1',
      userId: 'user-1',
      details: { browser: 'Chrome' }
    });

    expect(response.status).toBe(200);
    expect(response.body.telemetryId).toBe('telemetry-1');
    expect(addIvsTelemetryEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'join_attempt',
        role: 'unknown',
        sessionId: 'session-1',
        userId: 'user-1',
        details: { browser: 'Chrome' }
      })
    );
  });
});
