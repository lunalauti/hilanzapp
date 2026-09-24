import { Router } from 'express';
import { z } from 'zod';
import { AppError, notFound } from '../lib/errors';
import { isTrue, parseUuid, uuid } from '../lib/params';
import { ctxOf } from '../middleware/auth';
import * as groups from '../repositories/groups';
import * as repo from '../repositories/dancers';
import { groupDancersView } from '../services/dancers';

const name = z.string().trim().min(1, 'El nombre es obligatorio').max(120);
const age = z.number().int().min(0).max(120).nullable();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)').nullable();
const notes = z.string().max(2000).nullable();
const contact = z.string().trim().max(200).nullable();

const createBody = z.object({ groupId: uuid, name, age: age.optional(), measuredOn: date.optional(), notes: notes.optional(), contact: contact.optional() });
const patchBody = z.object({
  name: name.optional(), age: age.optional(), measuredOn: date.optional(), notes: notes.optional(), contact: contact.optional(),
  groupId: uuid.optional(), sizeTableId: uuid.nullable().optional(),
}).strict();

const toRow = (b: Record<string, unknown>) => {
  const map: Record<string, string> = { groupId: 'group_id', measuredOn: 'measured_on', sizeTableId: 'size_table_id' };
  return Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined).map(([k, v]) => [map[k] ?? k, v]));
};

export const dancersRouter = Router();

dancersRouter.get('/groups/:id/dancers', async (req, res) => {
  const { db } = ctxOf(req);
  const id = parseUuid(req.params.id);
  if (!(await groups.groupExists(db, id))) throw notFound('Grupo no encontrado');
  res.json(await groupDancersView(db, id));
});

dancersRouter.post('/dancers', async (req, res) => {
  const { db } = ctxOf(req);
  const body = createBody.parse(req.body);
  if (!(await groups.groupExists(db, body.groupId))) throw notFound('Grupo no encontrado');
  res.status(201).json(await repo.createDancer(db, toRow(body)));
});

dancersRouter.get('/dancers/:id', async (req, res) => {
  const row = await repo.getDancer(ctxOf(req).db, parseUuid(req.params.id));
  if (!row) throw notFound('Bailarina no encontrada');
  res.json(row);
});

dancersRouter.get('/dancers/:id/impact', async (req, res) => {
  const { db } = ctxOf(req);
  const id = parseUuid(req.params.id);
  if (!(await repo.getDancer(db, id))) throw notFound('Bailarina no encontrada');
  res.json(await repo.impact(db, id));
});

dancersRouter.patch('/dancers/:id', async (req, res) => {
  const { db } = ctxOf(req);
  const body = patchBody.parse(req.body);
  if (body.groupId && !(await groups.groupExists(db, body.groupId))) throw notFound('Grupo no encontrado');
  const row = await repo.updateDancer(db, parseUuid(req.params.id), toRow(body));
  if (!row) throw notFound('Bailarina no encontrada');
  res.json(row);
});

dancersRouter.delete('/dancers/:id', async (req, res) => {
  const { db } = ctxOf(req);
  const id = parseUuid(req.params.id);
  if (!(await repo.getDancer(db, id))) throw notFound('Bailarina no encontrada');
  const count = await repo.dependentsOf(db, id);
  if (count > 0 && !isTrue(req.query.confirm)) {
    throw new AppError(409, 'HAS_DEPENDENTS', `La bailarina tiene ${count} registros asociados (medidas, prendas u hojas de molde) que se eliminarán`, { count });
  }
  await repo.deleteDancer(db, id);
  res.status(204).end();
});
