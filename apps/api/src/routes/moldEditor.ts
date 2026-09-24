import { Router } from 'express';
import { z } from 'zod';
import { AppError, notFound } from '../lib/errors';
import { isTrue, parseUuid, uuid } from '../lib/params';
import { ctxOf } from '../middleware/auth';
import * as molds from '../repositories/molds';
import { calculate } from '../services/calculations';
import { assertValidDefinition, createMold, replaceDefinition } from '../services/moldEditor';
import { restoreTemplate } from '../services/bootstrap';
import { moldView } from '../services/moldView';

const key = z.string().regex(/^[a-z][a-z0-9_]*$/, 'Usá minúsculas, números y guion bajo (empezando con letra)');
const option = z.object({ id: key, label: z.string().trim().min(1).max(60), value: z.number().finite() });
const input = z.object({
  key, label: z.string().trim().min(1).max(80), source: z.enum(['measure', 'standard', 'manual', 'choice']),
  measureKey: key.optional(), options: z.array(option).max(20).optional(), defaultOptionId: key.optional(), required: z.boolean().optional(),
});
const formula = z.object({
  key, label: z.string().trim().min(1).max(80), section: z.string().trim().max(60).optional(),
  operandA: z.string().min(1).max(60), op: z.enum(['direct', 'div', 'mul', 'add', 'sub']), operandB: z.string().max(60).optional(),
  adjustmentCm: z.number().finite().min(-1000).max(1000).optional(), decimals: z.number().int().min(0).max(4).optional(),
});
const meta = { name: z.string().trim().min(1, 'El nombre es obligatorio').max(80), category: z.enum(['cuerpo', 'manga', 'pantalon', 'falda', 'vestido', 'otro']), sizePriority: z.enum(['pecho', 'cadera', 'both']) };
const createBody = z.object({ ...meta, category: meta.category.default('otro'), sizePriority: meta.sizePriority.default('pecho'), inputs: z.array(input).max(40), formulas: z.array(formula).min(1, 'Agregá al menos una fórmula').max(80) });
const patchBody = z.object({ name: meta.name.optional(), category: meta.category.optional(), sizePriority: meta.sizePriority.optional() }).strict();
const definitionBody = z.object({ inputs: z.array(input).max(40).optional(), formulas: z.array(formula).max(80) });
const previewBody = z.object({
  dancerId: uuid, moldTypeId: uuid, definition: definitionBody,
  manualInputs: z.record(z.string(), z.number().finite().min(0).max(1000)).optional(), choices: z.record(z.string(), z.string()).optional(),
});

export const moldEditorRouter = Router();

moldEditorRouter.post('/mold-types', async (req, res) => {
  const { db, user } = ctxOf(req);
  const id = await createMold(db, user.id, createBody.parse(req.body));
  const [created] = (await molds.listMolds(db)).filter((m) => m.id === id);
  res.status(201).json(moldView(created!));
});

moldEditorRouter.patch('/mold-types/:id', async (req, res) => {
  const { db } = ctxOf(req);
  const id = parseUuid(req.params.id);
  const b = patchBody.parse(req.body);
  const patch: Record<string, unknown> = {};
  if (b.name !== undefined) patch.name = b.name;
  if (b.category !== undefined) patch.category = b.category;
  if (b.sizePriority !== undefined) patch.size_priority = b.sizePriority;
  if (!(await molds.updateMold(db, id, patch))) throw notFound('Molde no encontrado');
  res.json(moldView((await molds.getMold(db, id))!));
});

moldEditorRouter.put('/mold-types/:id/formulas', async (req, res) => {
  const { db, user } = ctxOf(req);
  const id = parseUuid(req.params.id);
  const b = definitionBody.parse(req.body);
  if (!(await replaceDefinition(db, user.id, id, b))) throw notFound('Molde no encontrado');
  res.json(moldView((await molds.getMold(db, id))!));
});

moldEditorRouter.post('/mold-types/:id/restore-defaults', async (req, res) => {
  const { db, user } = ctxOf(req);
  const row = await molds.getMoldRow(db, parseUuid(req.params.id));
  if (!row) throw notFound('Molde no encontrado');
  if (!row.template_key) throw new AppError(422, 'NO_TEMPLATE', 'Este molde es propio y no tiene una versión original para restaurar');
  await restoreTemplate(db, user.id, 'mold', row.template_key);
  res.json(moldView((await molds.getMold(db, row.id))!));
});

moldEditorRouter.delete('/mold-types/:id', async (req, res) => {
  const { db } = ctxOf(req);
  const id = parseUuid(req.params.id);
  if (!(await molds.getMoldRow(db, id))) throw notFound('Molde no encontrado');
  const dep = await molds.moldDependents(db, id);
  const count = dep.assignments + dep.sheets;
  if (count > 0 && !isTrue(req.query.confirm)) {
    throw new AppError(409, 'HAS_DEPENDENTS', `El molde está en ${dep.assignments} prendas asignadas y ${dep.sheets} hojas guardadas; se van a eliminar`, { count, ...dep });
  }
  await molds.deleteMold(db, id);
  res.status(204).end();
});

/** Vista previa en vivo: calcula con una definición sin guardar. */
moldEditorRouter.post('/mold-preview', async (req, res) => {
  const { db } = ctxOf(req);
  const b = previewBody.parse(req.body);
  const stored = await molds.getMold(db, b.moldTypeId);
  if (!stored) throw notFound('Molde no encontrado');
  const def = { ...stored.def, inputs: b.definition.inputs ?? stored.def.inputs, formulas: b.definition.formulas };
  assertValidDefinition(def, new Set((await molds.definitionIdsByKey(db)).keys()));
  res.json(await calculate(db, { dancerId: b.dancerId, moldTypeId: b.moldTypeId, manualInputs: b.manualInputs, choices: b.choices }, def));
});
