import { Router } from 'express';
import { z } from 'zod';
import { notFound } from '../lib/errors';
import { parseUuid, uuid } from '../lib/params';
import { ctxOf } from '../middleware/auth';
import * as dancersRepo from '../repositories/dancers';
import * as repo from '../repositories/molds';
import { calculate } from '../services/calculations';
import { moldView } from '../services/moldView';

const number = z.number().finite().min(0).max(1000);
const calcBody = z.object({
  dancerId: uuid, moldTypeId: uuid, designId: uuid.nullable().optional(),
  manualInputs: z.record(z.string(), number).optional(),
  choices: z.record(z.string(), z.string()).optional(),
});

export const moldsRouter = Router();

moldsRouter.get('/mold-types', async (req, res) => {
  const list = await repo.listMolds(ctxOf(req).db);
  res.json(list.map(moldView));
});

moldsRouter.post('/calculations', async (req, res) => {
  res.json(await calculate(ctxOf(req).db, calcBody.parse(req.body)));
});

moldsRouter.post('/pattern-sheets', async (req, res) => {
  const { db } = ctxOf(req);
  const body = calcBody.parse(req.body);
  const calc = await calculate(db, body);
  const saved = await repo.insertSheet(db, {
    dancer_id: body.dancerId, mold_type_id: body.moldTypeId, design_id: body.designId ?? null, size_label: calc.size.label,
    snapshot: { ...calc, savedAt: new Date().toISOString() },
  });
  res.status(201).json({ id: saved.id, createdAt: saved.created_at, ...calc });
});

moldsRouter.get('/dancers/:id/pattern-sheets', async (req, res) => {
  const { db } = ctxOf(req);
  const dancer = await dancersRepo.getDancer(db, parseUuid(req.params.id));
  if (!dancer) throw notFound('Bailarina no encontrada');
  const rows = await repo.listSheets(db, dancer.id);
  res.json(rows.map((s) => ({ id: s.id, moldKey: s.mold_types.key, moldName: s.mold_types.name, sizeLabel: s.size_label, designId: s.design_id, createdAt: s.created_at })));
});

moldsRouter.get('/pattern-sheets/:id', async (req, res) => {
  const sheet = await repo.getSheet(ctxOf(req).db, parseUuid(req.params.id));
  if (!sheet) throw notFound('Hoja de molde no encontrada');
  res.json({ id: sheet.id, createdAt: sheet.created_at, sizeLabel: sheet.size_label, ...(sheet.snapshot as object) });
});

/** Última hoja guardada de cada bailarina del grupo para un molde (para exportar en lote). */
moldsRouter.get('/groups/:id/pattern-sheets', async (req, res) => {
  const { db } = ctxOf(req);
  const groupId = parseUuid(req.params.id);
  const moldTypeId = parseUuid(req.query.mold_type_id);
  res.json(await repo.latestSheetsForGroup(db, groupId, moldTypeId));
});
