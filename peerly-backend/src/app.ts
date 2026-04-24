import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';
import { config } from './config';
import { logger } from './lib/logger';
import { AppError } from './lib/errors';
import authRouter from './modules/auth/auth.router';
import adminRouter from './modules/admin/admin.router';
import onboardingRouter from './modules/onboarding/onboarding.router';
import postsRouter from './modules/posts/posts.router';
import commentsRouter from './modules/comments/comments.router';
import profileRouter from './modules/profile/profile.router';
import communitiesRouter from './modules/communities/communities.router';
import messagesRouter from './modules/messages/messages.router';

const app = express();

// Trust proxy — required for accurate IP rate limiting behind nginx/load balancer
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: config.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// HTTP request logging
app.use(
  morgan(config.NODE_ENV === 'production' ? 'combined' : 'dev', {
    stream: { write: (msg) => logger.http(msg.trim()) },
  })
);

// Body parsing
app.use(express.json({ limit: '10kb' }));

// Rate limiting on auth routes only
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

// Routes
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/onboarding', onboardingRouter);
app.use('/api/posts', postsRouter);
app.use('/api/posts/:postId/comments', commentsRouter);
app.use('/api/profile', profileRouter);
app.use('/api/communities', communitiesRouter);
app.use('/api/communities/:id/messages', messagesRouter);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', env: config.NODE_ENV });
});

// 404 handler — catches any route not matched above
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler — Express 5 propagates async errors automatically
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  logger.error('Unhandled error', {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  res.status(500).json({ error: 'Internal server error' });
});

export default app;
