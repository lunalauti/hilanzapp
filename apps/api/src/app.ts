import cors from 'cors';
import express, { type Express } from 'express';
import type { Config } from './config';
import { createTokenVerifier, type TokenVerifier } from './lib/jwt';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiRouter } from './routes';

export function createApp(config: Config, verify: TokenVerifier = createTokenVerifier(config)): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin)),
      allowedHeaders: ['Authorization', 'Content-Type'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/v1', apiRouter(config, verify));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
