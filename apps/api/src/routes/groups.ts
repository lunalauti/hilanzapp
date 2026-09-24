import { Router } from 'express';
import { z } from 'zod';
import { AppError, notFound } from '../lib/errors';
import { isTrue, parseUuid } from '../lib/params';
import { ctxOf } from '../middleware/auth';
import * as groups from '../repositories/groups';

const body = z.object({ name: z.string().trim().min(1, 'El nombre es obligatorio').max(80) });

export const groupsRouter = Router();

groupsRouter.get('/groups', async (req, res) => {
  res.json(await groups.listGroups(ctxOf(req).db));
});

groupsRouter.post('/groups', async (req, res) => {
  const { name } = body.parse(req.body);
  res.status(201).json(await groups.createGroup(ctxOf(req).db, name));
});

groupsRouter.patch('/groups/:id', async (req, res) => {
  const { name } = body.parse(req.body);
  const row = await groups.renameGroup(ctxOf(req).db, parseUuid(req.params.id), name);
  if (!row) throw notFound('Grupo no encontrado');
  res.json(row);
});

groupsRouter.delete('/groups/:id', async (req, res) => {
  const { db } = ctxOf(req);
  const id = parseUuid(req.params.id);
  if (!(await groups.groupExists(db, id))) throw notFound('Grupo no encontrado');
  const count = await groups.countDancers(db, id);
  if (count > 0 && !isTrue(req.query.confirm)) {
    throw new AppError(409, 'HAS_DEPENDENTS', `El grupo tiene ${count} bailarinas; se eliminarán con sus medidas`, { count });
  }
  await groups.deleteGroup(db, id);
  res.status(204).end();
});
