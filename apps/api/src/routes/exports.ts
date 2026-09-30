import { Router, type Response } from 'express';
import { z } from 'zod';
import { notFound } from '../lib/errors';
import { parseUuid, uuid } from '../lib/params';
import { ctxOf } from '../middleware/auth';
import * as groups from '../repositories/groups';
import { batchSheets, garmentSheetPdfData, missingPdfData, productionPdfData, sheetPdfData, slug } from '../services/exports';
import { laborBudgetPdfData, materialsListPdfData } from '../services/inventory';
import { renderLaborBudget, renderMaterialsList, renderMissing, renderPatternSheets, renderProduction } from '../services/pdf';

const batchBody = z.object({ sheetIds: z.array(uuid).min(1, 'Elegí al menos una hoja').max(50, 'Podés exportar hasta 50 hojas por vez') });

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

exportsRouter.get('/groups/:id/materials-list/pdf', async (req, res) => {
  const { db } = ctxOf(req);
  const id = parseUuid(req.params.id);
  if (!(await groups.groupExists(db, id))) throw notFound('Grupo no encontrado');
  const designId = req.query.design_id ? parseUuid(req.query.design_id) : null;
  const garmentId = req.query.garment_id ? parseUuid(req.query.garment_id) : null;
  const data = await materialsListPdfData(db, id, designId, garmentId);
  send(res, await renderMaterialsList(data), `materiales-${slug(data.groupName)}.pdf`);
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
