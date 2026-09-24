import { Router } from 'express';
import { z } from 'zod';
import { notFound } from '../lib/errors';
import { parseUuid, uuid } from '../lib/params';
import { ctxOf } from '../middleware/auth';
import * as dancers from '../repositories/dancers';
import * as repo from '../repositories/measurements';
import * as svc from '../services/measurements';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)');
const defBody = z.object({ name: z.string().trim().min(1, 'El nombre es obligatorio').max(80), required: z.boolean().optional() });
const valueBody = z.object({
  valueCm: z.number({ error: 'El valor debe ser un número' }).finite().min(0, 'El valor no puede ser negativo').max(1000),
  note: z.string().max(500).nullable().optional(),
  takenOn: date.optional(),
});
const restoreBody = z.object({ versionId: uuid });
const compareQuery = z.object({ from: date, to: date });

export const measurementsRouter = Router();

measurementsRouter.get('/measure-definitions', async (req, res) => {
  res.json((await repo.listDefinitions(ctxOf(req).db)).map((d) => ({ id: d.id, key: d.key, name: d.name, kind: d.kind, isBase: d.is_base, required: d.required })));
});

measurementsRouter.post('/measure-definitions', async (req, res) => {
  const body = defBody.parse(req.body);
  const d = await svc.createCustomDefinition(ctxOf(req).db, body.name, body.required ?? false);
  res.status(201).json({ id: d.id, key: d.key, name: d.name, kind: d.kind, isBase: d.is_base, required: d.required });
});

async function requireDancer(req: Parameters<typeof ctxOf>[0]) {
  const { db } = ctxOf(req);
  const dancerId = parseUuid(req.params.id);
  if (!(await dancers.getDancer(db, dancerId))) throw notFound('Bailarina no encontrada');
  return { db, dancerId };
}

async function requireDefinition(db: ReturnType<typeof ctxOf>['db'], id: unknown) {
  const defId = parseUuid(id);
  if (!(await repo.getDefinition(db, defId))) throw notFound('Medida no encontrada');
  return defId;
}

measurementsRouter.get('/dancers/:id/measurements', async (req, res) => {
  const { db, dancerId } = await requireDancer(req);
  res.json(await svc.dancerMeasurements(db, dancerId));
});

measurementsRouter.get('/dancers/:id/measurements/compare', async (req, res) => {
  const { db, dancerId } = await requireDancer(req);
  const { from, to } = compareQuery.parse(req.query);
  res.json(await svc.compareTakes(db, dancerId, from, to));
});

measurementsRouter.put('/dancers/:id/measurements/:defId', async (req, res) => {
  const { db, dancerId } = await requireDancer(req);
  const definitionId = await requireDefinition(db, req.params.defId);
  const body = valueBody.parse(req.body);
  res.json(svc.versionView(await repo.setMeasurement(db, { dancerId, definitionId, ...body })));
});

measurementsRouter.get('/dancers/:id/measurements/:defId/history', async (req, res) => {
  const { db, dancerId } = await requireDancer(req);
  const definitionId = await requireDefinition(db, req.params.defId);
  res.json((await repo.allVersions(db, dancerId, definitionId)).map(svc.versionView));
});

measurementsRouter.post('/dancers/:id/measurements/:defId/restore', async (req, res) => {
  const { db, dancerId } = await requireDancer(req);
  const definitionId = await requireDefinition(db, req.params.defId);
  const { versionId } = restoreBody.parse(req.body);
  await svc.assertVersionOf(db, versionId, dancerId, definitionId);
  res.json(svc.versionView(await repo.restoreVersion(db, versionId)));
});
