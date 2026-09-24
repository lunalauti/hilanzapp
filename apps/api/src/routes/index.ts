import { Router } from 'express';
import type { Config } from '../config';
import type { TokenVerifier } from '../lib/jwt';
import { ctxOf, requireAuth } from '../middleware/auth';
import { bootstrapUser } from '../services/bootstrap';
import { dancersRouter } from './dancers';
import { groupsRouter } from './groups';
import { measurementsRouter } from './measurements';
import { moldsRouter } from './molds';
import { productionRouter } from './production';
import { sizingRouter } from './sizing';

export function apiRouter(config: Config, verify: TokenVerifier): Router {
  const router = Router();
  router.use(requireAuth(config, verify));

  router.get('/me', (req, res) => {
    const { user } = ctxOf(req);
    res.json({ id: user.id, email: user.email ?? null });
  });

  router.post('/me/bootstrap', async (req, res) => {
    const { user, db } = ctxOf(req);
    res.json(await bootstrapUser(db, user.id));
  });

  router.use(groupsRouter);
  router.use(dancersRouter);
  router.use(measurementsRouter);
  router.use(sizingRouter);
  router.use(moldsRouter);
  router.use(productionRouter);

  return router;
}
