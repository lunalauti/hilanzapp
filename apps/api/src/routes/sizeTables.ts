import { Router } from 'express';
import { z } from 'zod';
import { AppError, notFound } from '../lib/errors';
import { parseUuid } from '../lib/params';
import { ctxOf } from '../middleware/auth';
import * as repo from '../repositories/sizeTables';
import { restoreTemplate } from '../services/bootstrap';
import { applyChanges, createTable, duplicateTable, gridView, requireTable } from '../services/sizeTables';

const ageRange = z.enum(['bebe', 'nino', 'adolescente', 'mujer', 'otro']);
const key = z.string().regex(/^[a-z][a-z0-9_]*$/);
const value = z.number().finite().min(0).max(1000);
const label = z.string().trim().min(1, 'El talle necesita un nombre').max(20);
const sizeInput = z.object({ label, descriptor: z.string().trim().max(40).nullable().optional(), values: z.record(key, value).default({}) });
const createBody = z.object({ name: z.string().trim().min(1, 'El nombre es obligatorio').max(80), ageRange, source: z.string().trim().max(80).nullable().optional(), sizes: z.array(sizeInput).max(60).default([]) });
const patchBody = z.object({ name: z.string().trim().min(1).max(80).optional(), ageRange: ageRange.optional(), source: z.string().trim().max(80).nullable().optional() }).strict();
const valuesBody = z.object({ changes: z.array(z.object({ sizeLabel: label, measureKey: key, value: value.nullable() })).min(1).max(1000) });
const duplicateBody = z.object({ name: z.string().trim().min(1).max(80).optional() });

export const sizeTablesRouter = Router();

sizeTablesRouter.get('/size-tables', async (req, res) => {
  const rows = await repo.listTables(ctxOf(req).db);
  res.json(rows.map((t) => ({ id: t.id, name: t.name, ageRange: t.age_range, source: t.source, isActive: t.is_active, baseTableId: t.base_table_id, templateKey: t.template_key, sizeCount: t.size_table_sizes.length })));
});

sizeTablesRouter.get('/size-tables/:id', async (req, res) => {
  res.json(gridView(await requireTable(ctxOf(req).db, parseUuid(req.params.id))));
});

sizeTablesRouter.post('/size-tables', async (req, res) => {
  const { db, user } = ctxOf(req);
  const id = await createTable(db, user.id, createBody.parse(req.body));
  res.status(201).json(gridView(await requireTable(db, id)));
});

sizeTablesRouter.patch('/size-tables/:id', async (req, res) => {
  const { db } = ctxOf(req);
  const id = parseUuid(req.params.id);
  const b = patchBody.parse(req.body);
  const patch: Record<string, unknown> = {};
  if (b.name !== undefined) patch.name = b.name;
  if (b.source !== undefined) patch.source = b.source;
  if (b.ageRange !== undefined) {
    const row = await repo.getRow(db, id);
    if (!row) throw notFound('Tabla de talles no encontrada');
    if (row.is_active && row.age_range !== b.ageRange) throw new AppError(409, 'TABLE_ACTIVE', 'Desactivá la tabla (activando otra del mismo rango) antes de cambiarle el rango etario');
    patch.age_range = b.ageRange;
  }
  if (!(await repo.updateTable(db, id, patch))) throw notFound('Tabla de talles no encontrada');
  res.json(gridView(await requireTable(db, id)));
});

/** Edita celdas: `value: null` borra el valor. Todo valor editado queda con origen "user". */
sizeTablesRouter.patch('/size-tables/:id/values', async (req, res) => {
  const { db, user } = ctxOf(req);
  const id = parseUuid(req.params.id);
  await applyChanges(db, user.id, id, valuesBody.parse(req.body).changes);
  res.json(gridView(await requireTable(db, id)));
});

sizeTablesRouter.post('/size-tables/:id/sizes', async (req, res) => {
  const { db, user } = ctxOf(req);
  const id = parseUuid(req.params.id);
  const b = sizeInput.parse(req.body);
  await requireTable(db, id);
  const sort = (await repo.maxSort(db, id)) + 1;
  const [created] = await repo.insertSizes(db, [{ owner_id: user.id, table_id: id, label: b.label, descriptor: b.descriptor ?? null, sort }]);
  if (Object.keys(b.values).length) await applyChanges(db, user.id, id, Object.entries(b.values).map(([measureKey, v]) => ({ sizeLabel: created!.label, measureKey, value: v })));
  res.status(201).json(gridView(await requireTable(db, id)));
});

sizeTablesRouter.delete('/size-tables/:id/sizes/:sizeId', async (req, res) => {
  const { db } = ctxOf(req);
  const id = parseUuid(req.params.id);
  await requireTable(db, id);
  if (!(await repo.deleteSize(db, id, parseUuid(req.params.sizeId)))) throw notFound('Talle no encontrado');
  res.json(gridView(await requireTable(db, id)));
});

sizeTablesRouter.post('/size-tables/:id/duplicate', async (req, res) => {
  const { db, user } = ctxOf(req);
  const b = duplicateBody.parse(req.body ?? {});
  const id = await duplicateTable(db, user.id, parseUuid(req.params.id), b.name);
  res.status(201).json(gridView(await requireTable(db, id)));
});

sizeTablesRouter.post('/size-tables/:id/activate', async (req, res) => {
  const { db } = ctxOf(req);
  const id = parseUuid(req.params.id);
  await requireTable(db, id);
  await repo.activate(db, id);
  res.json(gridView(await requireTable(db, id)));
});

sizeTablesRouter.post('/size-tables/:id/restore', async (req, res) => {
  const { db, user } = ctxOf(req);
  const id = parseUuid(req.params.id);
  const row = await repo.getRow(db, id);
  if (!row) throw notFound('Tabla de talles no encontrada');
  if (!row.template_key) throw new AppError(422, 'NO_TEMPLATE', 'Esta tabla es propia y no tiene una versión original para restaurar');
  await restoreTemplate(db, user.id, 'sizeTable', row.template_key);
  res.json(gridView(await requireTable(db, id)));
});

sizeTablesRouter.delete('/size-tables/:id', async (req, res) => {
  const { db } = ctxOf(req);
  const id = parseUuid(req.params.id);
  const row = await repo.getRow(db, id);
  if (!row) throw notFound('Tabla de talles no encontrada');
  if (row.template_key) throw new AppError(422, 'TEMPLATE_TABLE', 'Las tablas precargadas no se eliminan: podés restaurarlas o duplicarlas');
  if (row.is_active) throw new AppError(409, 'TABLE_ACTIVE', 'La tabla está activa: activá otra antes de eliminarla');
  await repo.deleteTable(db, id);
  res.status(204).end();
});
