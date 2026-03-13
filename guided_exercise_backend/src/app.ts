import dotenv from 'dotenv';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import router from '@/routes/base-routes.js';
import morgan from 'morgan';
import { getRequestId, requestIdMiddleware } from '@/utils/request-logging.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev')); //logger
app.use(requestIdMiddleware);

// Import and use the router
app.use(router);

// Middleware to log errors
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const requestId = getRequestId(req);
  console.error(`[${requestId}] Unhandled error: ${req.method} ${req.originalUrl}`, {
    body: req.body,
    message: err.message,
    stack: err.stack
  });
  res.status(err?.statusCode ?? 500).json({
    message: err?.message || 'Internal Server Error',
    requestId
  });
});

// Start server
app.listen(4000, '0.0.0.0', () => {
  console.log(`Server is running on port 4000.`);
});
