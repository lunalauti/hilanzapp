import { Router } from 'express';
import { notFound } from '../lib/errors';
import { isTrue, parseUuid } from '../lib/params';
import { ctxOf } from '../middleware/auth';
import * as dancersRepo from '../repositories/dancers';
import * as groups from '../repositories/groups';
import { groupPlan } from '../services/groupPlan';
import { plansForDancers } from '../services/measurePlan';

export const measurePlanRouter = Router();

measurePlanRouter.get('/dancers/:id/measure-plan', async (req, res) => {
  const { db } = ctxOf(req);
  const dancer = await dancersRepo.getDancer(db, parseUuid(req.params.id));
  if (!dancer) throw notFound('Bailarina no encontrada');
  const plan = (await plansForDancers(db, [dancer])).get(dancer.id)!;
  res.json(plan);
});

measurePlanRouter.get('/groups/:id/measure-plan', async (req, res) => {
  const { db } = ctxOf(req);
  const groupId = parseUuid(req.params.id);
  if (!(await groups.groupExists(db, groupId))) throw notFound('Grupo no encontrado');
  res.json(await groupPlan(db, groupId, { onlyMissing: isTrue(req.query.solo_faltantes) }));
});
