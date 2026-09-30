import { Router } from 'express';
import { z } from 'zod';
import { notFound } from '../lib/errors';
import { parseUuid, uuid } from '../lib/params';
import { ctxOf } from '../middleware/auth';
import * as assignments from '../repositories/assignments';
import * as dancersRepo from '../repositories/dancers';
import * as groups from '../repositories/groups';
import { groupProduction, setPatternDone, setSewnDone, sizeAverages } from '../services/production';

const patternBody = z.object({ moldTypeId: uuid, sizeLabel: z.string().trim().min(1).max(20), done: z.boolean() });
const sewnBody = z.object({ done: z.boolean() });
const sizesQuery = z.string().trim().min(1).transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean));

export const productionRouter = Router();

productionRouter.get('/groups/:id/production', async (req, res) => {
  const { db } = ctxOf(req);
  const id = parseUuid(req.params.id);
  if (!(await groups.groupExists(db, id))) throw notFound('Grupo no encontrado');
  res.json(await groupProduction(db, id));
});

productionRouter.get('/groups/:id/production/size-averages', async (req, res) => {
  const { db } = ctxOf(req);
  const id = parseUuid(req.params.id);
  if (!(await groups.groupExists(db, id))) throw notFound('Grupo no encontrado');
  const moldTypeId = parseUuid(req.query.mold_type_id);
  const sizes = sizesQuery.parse(req.query.sizes);
  const result = await sizeAverages(db, id, moldTypeId, sizes);
  if (!result) throw notFound('Molde no encontrado');
  res.json({ sizes: result });
});

productionRouter.put('/groups/:id/production/pattern', async (req, res) => {
  const { db, user } = ctxOf(req);
  const id = parseUuid(req.params.id);
  if (!(await groups.groupExists(db, id))) throw notFound('Grupo no encontrado');
  const { moldTypeId, sizeLabel, done } = patternBody.parse(req.body);
  if (!(await assignments.moldExists(db, moldTypeId))) throw notFound('Molde no encontrado');
  await setPatternDone(db, user.id, id, moldTypeId, sizeLabel, done);
  res.json(await groupProduction(db, id));
});

productionRouter.put('/assignments/:id/sewn', async (req, res) => {
  const { db, user } = ctxOf(req);
  const id = parseUuid(req.params.id);
  const { done } = sewnBody.parse(req.body);
  const a = await assignments.getAssignment(db, id);
  if (!a) throw notFound('Asignación no encontrada');
  const dancer = await dancersRepo.getDancer(db, a.dancer_id);
  if (!dancer) throw notFound('Bailarina no encontrada');
  await setSewnDone(db, user.id, id, done);
  res.json(await groupProduction(db, dancer.group_id));
});
