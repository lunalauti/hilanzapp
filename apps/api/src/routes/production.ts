import { Router } from 'express';
import { notFound } from '../lib/errors';
import { parseUuid } from '../lib/params';
import { ctxOf } from '../middleware/auth';
import * as groups from '../repositories/groups';
import { groupProduction } from '../services/production';

export const productionRouter = Router();

productionRouter.get('/groups/:id/production', async (req, res) => {
  const { db } = ctxOf(req);
  const id = parseUuid(req.params.id);
  if (!(await groups.groupExists(db, id))) throw notFound('Grupo no encontrado');
  res.json(await groupProduction(db, id));
});
