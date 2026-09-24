import { Router } from 'express';
import { z } from 'zod';
import { AppError, notFound } from '../lib/errors';
import { isTrue, parseUuid, uuid } from '../lib/params';
import { ctxOf } from '../middleware/auth';
import * as groups from '../repositories/groups';
import * as repo from '../repositories/inventory';
import { confirmGroupProduction, groupCosts, stats } from '../services/inventory';

const money = z.number().finite().min(0).max(100_000_000);
const qty = z.number().finite().min(0).max(1_000_000);
const materialBody = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(120), description: z.string().trim().max(200).nullable().optional(),
  unit: z.string().trim().min(1).max(20).optional(), unitCost: money.optional(), stockQty: qty.optional(),
});
const patchBody = materialBody.omit({ stockQty: true }).partial().strict();
const stockBody = z.object({ delta: z.number().finite().refine((n) => n !== 0, 'El movimiento no puede ser cero').refine((n) => Math.abs(n) <= 1_000_000, 'Valor demasiado grande'), note: z.string().trim().max(200).nullable().optional() });
const rulesBody = z.object({
  designGarmentId: uuid, materialId: uuid,
  rules: z.array(z.object({ sizeLabel: z.string().trim().min(1).max(20).nullable(), quantity: z.number().finite().gt(0).max(10_000) })).max(60),
});
const confirmBody = z.object({ designId: uuid.nullable().optional(), deductStock: z.boolean() });

const view = (m: repo.MaterialRow) => ({ id: m.id, name: m.name, description: m.description, unit: m.unit, unitCost: Number(m.unit_cost), stockQty: Number(m.stock_qty) });

export const inventoryRouter = Router();

inventoryRouter.get('/materials', async (req, res) => {
  res.json((await repo.listMaterials(ctxOf(req).db)).map(view));
});

inventoryRouter.post('/materials', async (req, res) => {
  const { db } = ctxOf(req);
  const b = materialBody.parse(req.body);
  const created = await repo.insertMaterial(db, { name: b.name, description: b.description ?? null, unit: b.unit ?? 'm', unit_cost: b.unitCost ?? 0 });
  const withStock = b.stockQty ? await repo.moveStock(db, { materialId: created.id, delta: b.stockQty, reason: 'manual', note: 'Stock inicial' }) : created;
  res.status(201).json(view(withStock));
});

inventoryRouter.patch('/materials/:id', async (req, res) => {
  const b = patchBody.parse(req.body);
  const patch: Record<string, unknown> = {};
  if (b.name !== undefined) patch.name = b.name;
  if (b.description !== undefined) patch.description = b.description;
  if (b.unit !== undefined) patch.unit = b.unit;
  if (b.unitCost !== undefined) patch.unit_cost = b.unitCost;
  const row = await repo.updateMaterial(ctxOf(req).db, parseUuid(req.params.id), patch);
  if (!row) throw notFound('Material no encontrado');
  res.json(view(row));
});

inventoryRouter.post('/materials/:id/stock', async (req, res) => {
  const { db } = ctxOf(req);
  const b = stockBody.parse(req.body);
  res.json(view(await repo.moveStock(db, { materialId: parseUuid(req.params.id), delta: b.delta, reason: 'manual', note: b.note })));
});

inventoryRouter.get('/materials/:id/movements', async (req, res) => {
  const { db } = ctxOf(req);
  const id = parseUuid(req.params.id);
  if (!(await repo.getMaterial(db, id))) throw notFound('Material no encontrado');
  res.json((await repo.movements(db, id)).map((m) => ({ id: m.id, delta: Number(m.delta), reason: m.reason, note: m.note, groupId: m.group_id, designId: m.design_id, createdAt: m.created_at })));
});

inventoryRouter.delete('/materials/:id', async (req, res) => {
  const { db } = ctxOf(req);
  const id = parseUuid(req.params.id);
  if (!(await repo.getMaterial(db, id))) throw notFound('Material no encontrado');
  const count = await repo.ruleCount(db, id);
  if (count > 0 && !isTrue(req.query.confirm)) throw new AppError(409, 'HAS_DEPENDENTS', `El material se usa en ${count} reglas de consumo; se van a eliminar`, { count });
  await repo.deleteMaterial(db, id);
  res.status(204).end();
});

inventoryRouter.get('/consumption-rules', async (req, res) => {
  const designId = req.query.designId === undefined ? undefined : parseUuid(req.query.designId);
  const { garments, rules } = await repo.rulesForDesign(ctxOf(req).db, designId);
  res.json(rules.map((r) => {
    const g = garments.find((x) => x.id === r.design_garment_id)!;
    return { id: r.id, designGarmentId: r.design_garment_id, designId: g.design_id, designName: g.designs.name, moldTypeId: g.mold_type_id, moldName: g.mold_types.name, materialId: r.material_id, sizeLabel: r.size_label, quantity: Number(r.quantity) };
  }));
});

inventoryRouter.put('/consumption-rules', async (req, res) => {
  const { db } = ctxOf(req);
  const b = rulesBody.parse(req.body);
  if (!(await repo.garmentExists(db, b.designGarmentId))) throw notFound('Prenda del diseño no encontrada');
  if (!(await repo.getMaterial(db, b.materialId))) throw notFound('Material no encontrado');
  const labels = b.rules.map((r) => r.sizeLabel ?? '*');
  if (new Set(labels).size !== labels.length) throw new AppError(422, 'VALIDATION_ERROR', 'Hay talles repetidos en las reglas de consumo');
  await repo.replaceRules(db, b.designGarmentId, b.materialId, b.rules.map((r) => ({ size_label: r.sizeLabel, quantity: r.quantity })));
  res.json({ designGarmentId: b.designGarmentId, materialId: b.materialId, rules: b.rules });
});

inventoryRouter.get('/groups/:id/costs', async (req, res) => {
  const { db } = ctxOf(req);
  const id = parseUuid(req.params.id);
  if (!(await groups.groupExists(db, id))) throw notFound('Grupo no encontrado');
  const designId = req.query.design_id === undefined ? null : parseUuid(req.query.design_id);
  res.json(await groupCosts(db, id, designId));
});

inventoryRouter.post('/groups/:id/production/confirm', async (req, res) => {
  const { db } = ctxOf(req);
  const id = parseUuid(req.params.id);
  if (!(await groups.groupExists(db, id))) throw notFound('Grupo no encontrado');
  const b = confirmBody.parse(req.body);
  res.json(await confirmGroupProduction(db, id, b.designId ?? null, b.deductStock));
});

inventoryRouter.get('/stats', async (req, res) => {
  const { db } = ctxOf(req);
  const list = await groups.listGroups(db);
  res.json(await stats(db, list.map((g) => ({ id: g.id, name: g.name }))));
});
