import { Router, type Response } from 'express';
import { z } from 'zod';
import { notFound } from '../lib/errors';
import { parseUuid, uuid } from '../lib/params';
import { ctxOf } from '../middleware/auth';
import * as groups from '../repositories/groups';
import { batchSheets, productionPdfData, sheetPdfData, slug } from '../services/exports';
import { renderPatternSheets, renderProduction } from '../services/pdf';

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
