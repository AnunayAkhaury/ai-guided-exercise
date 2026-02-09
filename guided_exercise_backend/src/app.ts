import dotenv from 'dotenv';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import router from '@/routes/base-routes.js';
import morgan from 'morgan';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev')); //logger

// Import and use the router
app.use(router);

// Middleware to log errors
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(`Error: ${req.method} ${req.originalUrl}`, {
    body: req.body,
    message: err.message,
    stack: err.stack
  });
});

// Start server
app.listen(4000, '0.0.0.0', () => {
  console.log(`Server is running on port 4000.`);
});
