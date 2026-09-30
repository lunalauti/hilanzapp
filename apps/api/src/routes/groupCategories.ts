import { Router } from 'express';
import { z } from 'zod';
import { notFound } from '../lib/errors';
import { parseUuid } from '../lib/params';
import { ctxOf } from '../middleware/auth';
import * as categories from '../repositories/groupCategories';

const body = z.object({ name: z.string().trim().min(1, 'El nombre es obligatorio').max(80) });

export const groupCategoriesRouter = Router();

groupCategoriesRouter.get('/group-categories', async (req, res) => {
  res.json(await categories.listCategories(ctxOf(req).db));
});

groupCategoriesRouter.post('/group-categories', async (req, res) => {
  const { name } = body.parse(req.body);
  res.status(201).json(await categories.createCategory(ctxOf(req).db, name));
});

groupCategoriesRouter.patch('/group-categories/:id', async (req, res) => {
  const { name } = body.parse(req.body);
  const row = await categories.renameCategory(ctxOf(req).db, parseUuid(req.params.id), name);
  if (!row) throw notFound('Categoría no encontrada');
  res.json(row);
});

groupCategoriesRouter.delete('/group-categories/:id', async (req, res) => {
  const { db } = ctxOf(req);
  const id = parseUuid(req.params.id);
  if (!(await categories.categoryExists(db, id))) throw notFound('Categoría no encontrada');
  // Los grupos de esta categoría quedan sin categoría (on delete set null); nunca se borran en cascada.
  await categories.deleteCategory(db, id);
  res.status(204).end();
});
