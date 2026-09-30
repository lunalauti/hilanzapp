import { Router, type Response } from 'express';
import { z } from 'zod';
import { notFound } from '../lib/errors';
import { unwrap } from '../lib/db';
import { parseUuid, uuid } from '../lib/params';
import { ctxOf } from '../middleware/auth';
import * as groups from '../repositories/groups';
import { batchSheets, garmentSheetPdfData, missingPdfData, productionPdfData, sheetPdfData, slug } from '../services/exports';
import { laborBudgetPdfData, materialsListPdfData } from '../services/inventory';
import { renderLaborBudget, renderMaterialsList, renderMissing, renderPatternSheets, renderProduction } from '../services/pdf';

const batchBody = z.object({ sheetIds: z.array(uuid).min(1, 'Elegí al menos una hoja').max(50, 'Podés exportar hasta 50 hojas por vez') });

const materialLine = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(200).nullable(),
  unit: z.string().trim().min(1).max(20),
  perUnit: z.number().finite().min(0),
  total: z.number().finite().min(0),
  approx: z.boolean(),
});
const garmentLine = z.object({
  moldName: z.string().trim().min(1).max(120),
  dancerCount: z.number().int().min(0),
  materials: z.array(materialLine).max(50),
  notes: z.object({ conos: z.string().trim().max(200), observations: z.string().trim().max(500) }),
});
const materialsListBody = z.object({ garments: z.array(garmentLine).max(50) });

function send(res: Response, pdf: Buffer, filename: string) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(pdf);
}

export const exportsRouter = Router();

exportsRouter.get('/pattern-sheets/:id/pdf', async (req, res) => {
  const data = await sheetPdfData(ctxOf(req).db, parseUuid(req.params.id));
  send(res, await renderPatternSheets([data]), `hoja-molde-${slug(data.dancerName)}-${slug(data.moldName)}.pdf`);
});

exportsRouter.post('/pattern-sheets/pdf', async (req, res) => {
  const { sheetIds } = batchBody.parse(req.body);
  const data = await batchSheets(ctxOf(req).db, sheetIds);
  send(res, await renderPatternSheets(data), `hojas-de-molde-${data.length}.pdf`);
});

exportsRouter.get('/groups/:id/production/pdf', async (req, res) => {
  const { db } = ctxOf(req);
  const id = parseUuid(req.params.id);
  if (!(await groups.groupExists(db, id))) throw notFound('Grupo no encontrado');
  const data = await productionPdfData(db, id);
  send(res, await renderProduction(data), `produccion-${slug(data.groupName)}.pdf`);
});

exportsRouter.get('/groups/:id/measure-plan/pdf', async (req, res) => {
  const { db } = ctxOf(req);
  const id = parseUuid(req.params.id);
  if (!(await groups.groupExists(db, id))) throw notFound('Grupo no encontrado');
  const data = await missingPdfData(db, id);
  send(res, await renderMissing(data), `faltantes-${slug(data.groupName)}.pdf`);
});

exportsRouter.get('/groups/:id/materials-list', async (req, res) => {
  const { db } = ctxOf(req);
  const id = parseUuid(req.params.id);
  if (!(await groups.groupExists(db, id))) throw notFound('Grupo no encontrado');
  const designId = req.query.design_id ? parseUuid(req.query.design_id) : null;
  const garmentId = req.query.garment_id ? parseUuid(req.query.garment_id) : null;
  res.json(await materialsListPdfData(db, id, designId, garmentId));
});

exportsRouter.get('/groups/:id/materials-list/pdf', async (req, res) => {
  const { db } = ctxOf(req);
  const id = parseUuid(req.params.id);
  if (!(await groups.groupExists(db, id))) throw notFound('Grupo no encontrado');
  const designId = req.query.design_id ? parseUuid(req.query.design_id) : null;
  const garmentId = req.query.garment_id ? parseUuid(req.query.garment_id) : null;
  const data = await materialsListPdfData(db, id, designId, garmentId);
  send(res, await renderMaterialsList(data), `materiales-${slug(data.groupName)}.pdf`);
});

/** Genera el PDF a partir de los datos ya editados en la pantalla de vista previa (no recalcula desde la base). */
exportsRouter.post('/groups/:id/materials-list/pdf', async (req, res) => {
  const { db } = ctxOf(req);
  const id = parseUuid(req.params.id);
  const group = unwrap(await db.from('groups').select('name').eq('id', id).maybeSingle()) as { name: string } | null;
  if (!group) throw notFound('Grupo no encontrado');
  const { garments } = materialsListBody.parse(req.body);
  const data = { groupName: group.name, generatedAt: new Date().toISOString(), garments };
  send(res, await renderMaterialsList(data), `materiales-${slug(group.name)}.pdf`);
});

exportsRouter.get('/groups/:id/labor-budget/pdf', async (req, res) => {
  const { db } = ctxOf(req);
  const id = parseUuid(req.params.id);
  if (!(await groups.groupExists(db, id))) throw notFound('Grupo no encontrado');
  const designId = req.query.design_id ? parseUuid(req.query.design_id) : null;
  const data = await laborBudgetPdfData(db, id, designId);
  send(res, await renderLaborBudget(data), `presupuesto-confeccion-${slug(data.groupName)}.pdf`);
});

exportsRouter.get('/dancers/:id/garment-sheet/pdf', async (req, res) => {
  const { db } = ctxOf(req);
  const designId = req.query.design_id ? parseUuid(req.query.design_id) : null;
  const data = await garmentSheetPdfData(db, parseUuid(req.params.id), parseUuid(req.query.mold_type_id), designId);
  send(res, await renderPatternSheets([data]), `hoja-prenda-${slug(data.dancerName)}-${slug(data.moldName)}.pdf`);
});
