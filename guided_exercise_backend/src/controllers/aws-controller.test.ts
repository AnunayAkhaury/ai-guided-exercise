import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getVideoUrlController, uploadVideoController } from './aws-controller.js';
import { getVideoFromS3, uploadVideoToS3 } from '@/services/AWS/s3.js';

vi.mock('@/services/AWS/s3.js', () => ({
  getVideoFromS3: vi.fn(),
  uploadVideoToS3: vi.fn()
}));

function createAwsTestApp() {
  const app = express();
  app.use(express.json());
  app.post('/aws/upload', uploadVideoController);
  app.get('/aws/video-url', getVideoUrlController);
  return app;
}

describe('AWS controller routes', () => {
  const app = createAwsTestApp();

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls the S3 upload service', async () => {
    vi.mocked(uploadVideoToS3).mockResolvedValue(undefined);

    const response = await request(app).post('/aws/upload').send();

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Upload request completed.');
    expect(uploadVideoToS3).toHaveBeenCalledWith('ai-guided-exercise-recordings', 'test-video.mp4', 'unused-param');
  });

  it('returns a signed S3 video URL', async () => {
    vi.mocked(getVideoFromS3).mockResolvedValue('https://signed.example/video.mp4');

    const response = await request(app).get('/aws/video-url');

    expect(response.status).toBe(200);
    expect(response.body.recordingUrl).toBe('https://signed.example/video.mp4');
  });

  it('returns errors from S3 services', async () => {
    vi.mocked(uploadVideoToS3).mockRejectedValueOnce(new Error('upload failed'));
    const uploadResponse = await request(app).post('/aws/upload').send();
    expect(uploadResponse.status).toBe(500);
    expect(uploadResponse.body.message).toBe('upload failed');

    vi.mocked(getVideoFromS3).mockRejectedValueOnce(new Error('sign failed'));
    const getResponse = await request(app).get('/aws/video-url');
    expect(getResponse.status).toBe(500);
    expect(getResponse.body.message).toBe('sign failed');
  });
});
