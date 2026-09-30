import { Router } from 'express';
import { z } from 'zod';
import { AppError, notFound } from '../lib/errors';
import { isTrue, parseUuid, uuid } from '../lib/params';
import { ctxOf } from '../middleware/auth';
import { unwrap } from '../lib/db';
import * as categories from '../repositories/groupCategories';
import * as groups from '../repositories/groups';
import { plansForDancers } from '../services/measurePlan';

const createBody = z.object({ name: z.string().trim().min(1, 'El nombre es obligatorio').max(80), categoryId: uuid.nullable().optional() });
const patchBody = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(80).optional(),
  categoryId: uuid.nullable().optional(),
  archived: z.boolean().optional(),
}).strict();

export const groupsRouter = Router();

groupsRouter.get('/groups', async (req, res) => {
  const { db } = ctxOf(req);
  const dancers = unwrap(await db.from('dancers').select('id, group_id')) as { id: string; group_id: string }[];
  const plans = await plansForDancers(db, dancers);
  res.json(await groups.listGroups(db, dancers.map((d) => ({ group_id: d.group_id, status: plans.get(d.id)!.status })), { includeArchived: isTrue(req.query.incluir_archivados) }));
});

groupsRouter.post('/groups', async (req, res) => {
  const { db } = ctxOf(req);
  const { name, categoryId } = createBody.parse(req.body);
  if (categoryId && !(await categories.categoryExists(db, categoryId))) throw notFound('Categoría no encontrada');
  res.status(201).json(await groups.createGroup(db, name, categoryId ?? null));
});

groupsRouter.patch('/groups/:id', async (req, res) => {
  const { db } = ctxOf(req);
  const id = parseUuid(req.params.id);
  const b = patchBody.parse(req.body);
  if (b.categoryId && !(await categories.categoryExists(db, b.categoryId))) throw notFound('Categoría no encontrada');
  const patch: Record<string, unknown> = {};
  if (b.name !== undefined) patch.name = b.name;
  if (b.categoryId !== undefined) patch.category_id = b.categoryId;
  if (b.archived !== undefined) patch.archived_at = b.archived ? new Date().toISOString() : null;
  const row = await groups.updateGroup(db, id, patch);
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
