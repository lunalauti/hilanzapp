import { Router } from 'express';
import { z } from 'zod';
import { AppError, notFound } from '../lib/errors';
import { parseUuid, uuid } from '../lib/params';
import { ctxOf } from '../middleware/auth';
import * as assignments from '../repositories/assignments';
import * as dancersRepo from '../repositories/dancers';
import { dancerSizing, loadSizeTables, pickTable } from '../services/sizing';
import { unwrap } from '../lib/db';

const label = z.string().trim().min(1).max(20).nullable();
const sizeBody = z.object({ manualSizeLabel: label });
const createBody = z.object({ dancerId: uuid, moldTypeId: uuid, designId: uuid.nullable().optional() });
const groupDesignBody = z.object({ designId: uuid });

export const sizingRouter = Router();

async function moldOf(db: ReturnType<typeof ctxOf>['db'], id: string) {
  const row = unwrap(await db.from('mold_types').select('id, key, name, size_priority').eq('id', id).maybeSingle()) as
    { id: string; key: string; name: string; size_priority: 'pecho' | 'cadera' | 'both' } | null;
  if (!row) throw notFound('Molde no encontrado');
  return row;
}

async function assertKnownSize(db: ReturnType<typeof ctxOf>['db'], dancer: NonNullable<Awaited<ReturnType<typeof dancersRepo.getDancer>>>, value: string | null) {
  if (value === null) return;
  const loaded = pickTable(await loadSizeTables(db), dancer);
  if (loaded && !loaded.table.sizes.some((s) => s.label === value)) {
    throw new AppError(422, 'UNKNOWN_SIZE', `El talle ${value} no existe en la tabla ${loaded.table.name}`, { available: loaded.table.sizes.map((s) => s.label) });
  }
}

sizingRouter.get('/dancers/:id/sizing', async (req, res) => {
  const { db } = ctxOf(req);
  const dancer = await dancersRepo.getDancer(db, parseUuid(req.params.id));
  if (!dancer) throw notFound('Bailarina no encontrada');
  const moldId = req.query.mold_type_id ? parseUuid(req.query.mold_type_id) : null;
  res.json(await dancerSizing(db, dancer, moldId ? await moldOf(db, moldId) : null));
});

sizingRouter.put('/dancers/:id/size', async (req, res) => {
  const { db } = ctxOf(req);
  const { manualSizeLabel } = sizeBody.parse(req.body);
  const dancer = await dancersRepo.getDancer(db, parseUuid(req.params.id));
  if (!dancer) throw notFound('Bailarina no encontrada');
  await assertKnownSize(db, dancer, manualSizeLabel);
  const updated = (await dancersRepo.updateDancer(db, dancer.id, { manual_size_label: manualSizeLabel }))!;
  res.json(await dancerSizing(db, updated, null));
});

sizingRouter.get('/dancers/:id/assignments', async (req, res) => {
  const { db } = ctxOf(req);
  const dancer = await dancersRepo.getDancer(db, parseUuid(req.params.id));
  if (!dancer) throw notFound('Bailarina no encontrada');
  const rows = await assignments.listForDancer(db, dancer.id);
  res.json(await Promise.all(rows.map(async (a) => {
    const s = await dancerSizing(db, dancer, { id: a.mold_type_id, ...a.mold_types }, a.manual_size_label);
    return { id: a.id, moldTypeId: a.mold_type_id, moldKey: a.mold_types.key, moldName: a.mold_types.name, designId: a.design_id, designName: a.designs?.name ?? null, manualSizeLabel: a.manual_size_label, suggested: s.suggested, effective: s.effective, needsReview: s.needsReview };
  })));
});

sizingRouter.post('/assignments', async (req, res) => {
  const { db } = ctxOf(req);
  const body = createBody.parse(req.body);
  if (!(await dancersRepo.getDancer(db, body.dancerId))) throw notFound('Bailarina no encontrada');
  await moldOf(db, body.moldTypeId);
  if (body.designId && !(await assignments.designExists(db, body.designId))) throw notFound('Diseño no encontrado');
  const row = await assignments.createAssignment(db, { dancer_id: body.dancerId, mold_type_id: body.moldTypeId, design_id: body.designId ?? null });
  res.status(201).json({ id: row.id, dancerId: row.dancer_id, moldTypeId: row.mold_type_id, designId: row.design_id, manualSizeLabel: row.manual_size_label });
});

sizingRouter.patch('/assignments/:id', async (req, res) => {
  const { db } = ctxOf(req);
  const { manualSizeLabel } = sizeBody.parse(req.body);
  const a = await assignments.getAssignment(db, parseUuid(req.params.id));
  if (!a) throw notFound('Asignación no encontrada');
  const dancer = (await dancersRepo.getDancer(db, a.dancer_id))!;
  await assertKnownSize(db, dancer, manualSizeLabel);
  await assignments.setAssignmentSize(db, a.id, manualSizeLabel);
  const s = await dancerSizing(db, dancer, { id: a.mold_type_id, ...a.mold_types }, manualSizeLabel);
  res.json({ id: a.id, manualSizeLabel, suggested: s.suggested, effective: s.effective });
});

sizingRouter.delete('/assignments/:id', async (req, res) => {
  if (!(await assignments.deleteAssignment(ctxOf(req).db, parseUuid(req.params.id)))) throw notFound('Asignación no encontrada');
  res.status(204).end();
});

sizingRouter.post('/groups/:id/design-assignment', async (req, res) => {
  const { db } = ctxOf(req);
  const groupId = parseUuid(req.params.id);
  const { designId } = groupDesignBody.parse(req.body);
  const dancerIds = await assignments.groupDancerIds(db, groupId);
  if (!unwrap(await db.from('groups').select('id').eq('id', groupId).maybeSingle())) throw notFound('Grupo no encontrado');
  if (!(await assignments.designExists(db, designId))) throw notFound('Diseño no encontrado');

  const garments = await assignments.designGarments(db, designId);
  const existing = new Set((await assignments.existingPairs(db, dancerIds, designId)).map((p) => `${p.dancer_id}|${p.mold_type_id}`));
  const rows = dancerIds.flatMap((d) => garments.map((g) => ({ dancer_id: d, mold_type_id: g.mold_type_id, design_id: designId })))
    .filter((r) => !existing.has(`${r.dancer_id}|${r.mold_type_id}`));
  await assignments.insertMany(db, rows);
  await assignments.linkGroupDesign(db, groupId, designId);
  res.json({ created: rows.length, existing: existing.size, dancers: dancerIds.length, garments: garments.length });
});
