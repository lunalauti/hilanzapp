import { Router } from 'express';
import { z } from 'zod';
import { AppError, notFound } from '../lib/errors';
import { isTrue, parseUuid, uuid } from '../lib/params';
import { ctxOf } from '../middleware/auth';
import * as repo from '../repositories/designs';
import * as images from '../repositories/images';
import { designsView } from '../services/designs';

const category = z.enum(['neckline', 'sleeve', 'skirt']);
const catalogBody = z.object({ category, label: z.string().trim().min(1, 'La opción no puede estar vacía').max(60) });

const garment = z.object({ moldTypeId: uuid, laborCost: z.number().finite().min(0).max(100_000_000).nullable().optional() });
const fields = {
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
  notes: z.string().max(4000).nullable(),
  constructionDetails: z.string().max(4000).nullable(),
  necklineId: uuid.nullable(), sleeveId: uuid.nullable(), skirtId: uuid.nullable(),
  hasRuffle: z.boolean(), isAsymmetric: z.boolean(),
  garments: z.array(garment).max(30), specialMeasureIds: z.array(uuid).max(50),
};
const createBody = z.object({ name: fields.name, notes: fields.notes.optional(), constructionDetails: fields.constructionDetails.optional(), necklineId: fields.necklineId.optional(), sleeveId: fields.sleeveId.optional(), skirtId: fields.skirtId.optional(), hasRuffle: fields.hasRuffle.optional(), isAsymmetric: fields.isAsymmetric.optional(), garments: fields.garments.optional(), specialMeasureIds: fields.specialMeasureIds.optional() });
const patchBody = createBody.partial().strict();

const toRow = (b: z.infer<typeof createBody>) => {
  const row: Record<string, unknown> = {};
  const map: [keyof typeof b, string][] = [['name', 'name'], ['notes', 'notes'], ['constructionDetails', 'construction_details'], ['necklineId', 'neckline_id'], ['sleeveId', 'sleeve_id'], ['skirtId', 'skirt_id'], ['hasRuffle', 'has_ruffle'], ['isAsymmetric', 'is_asymmetric']];
  for (const [k, col] of map) if (b[k] !== undefined) row[col] = b[k];
  return row;
};

export const designsRouter = Router();

designsRouter.get('/catalog-options', async (req, res) => {
  const cat = req.query.category === undefined ? undefined : category.parse(req.query.category);
  res.json((await repo.listCatalog(ctxOf(req).db, cat)).map((c) => ({ id: c.id, category: c.category, label: c.label, isCustom: c.is_custom })));
});

/** "Otro": guarda el valor personalizado para reutilizarlo; si ya existe devuelve el existente. */
designsRouter.post('/catalog-options', async (req, res) => {
  const { db } = ctxOf(req);
  const body = catalogBody.parse(req.body);
  const existing = await repo.findCatalog(db, body.category, body.label);
  const row = existing ?? (await repo.insertCatalog(db, body.category, body.label));
  res.status(existing ? 200 : 201).json({ id: row.id, category: row.category, label: row.label, isCustom: row.is_custom });
});

designsRouter.get('/designs', async (req, res) => {
  res.json(await designsView(ctxOf(req).db));
});

designsRouter.get('/designs/:id', async (req, res) => {
  const [design] = await designsView(ctxOf(req).db, parseUuid(req.params.id));
  if (!design) throw notFound('Diseño no encontrado');
  res.json(design);
});

designsRouter.post('/designs', async (req, res) => {
  const { db } = ctxOf(req);
  const body = createBody.parse(req.body);
  const row = await repo.insertDesign(db, toRow(body));
  if (body.garments?.length) await repo.syncGarments(db, row.id, body.garments);
  if (body.specialMeasureIds?.length) await repo.syncSpecials(db, row.id, body.specialMeasureIds);
  res.status(201).json((await designsView(db, row.id))[0]);
});

designsRouter.patch('/designs/:id', async (req, res) => {
  const { db } = ctxOf(req);
  const id = parseUuid(req.params.id);
  const body = patchBody.parse(req.body);
  if (!(await repo.updateDesign(db, id, toRow(body as z.infer<typeof createBody>)))) throw notFound('Diseño no encontrado');
  if (body.garments) await repo.syncGarments(db, id, body.garments);
  if (body.specialMeasureIds) await repo.syncSpecials(db, id, body.specialMeasureIds);
  res.json((await designsView(db, id))[0]);
});

designsRouter.delete('/designs/:id', async (req, res) => {
  const { db } = ctxOf(req);
  const id = parseUuid(req.params.id);
  const [design] = await repo.listDesigns(db, id);
  if (!design) throw notFound('Diseño no encontrado');
  const count = await repo.countAssignments(db, id);
  if (count > 0 && !isTrue(req.query.confirm)) {
    throw new AppError(409, 'HAS_DEPENDENTS', `El diseño está asignado a ${count} prendas de bailarinas; se van a quitar esas asignaciones`, { count });
  }
  await images.removeObjects(db, (await images.imagesOf(db, [id])).map((i) => i.storage_path));
  await repo.deleteDesign(db, id);
  res.status(204).end();
});

const uploadBody = z.object({ filename: z.string().trim().min(1).max(200), mime: z.string(), size: z.number().int().positive() });
const registerBody = z.object({ path: z.string().min(1).max(400), filename: z.string().trim().min(1).max(200) });

designsRouter.post('/designs/:id/images/upload-url', async (req, res) => {
  const { db, user } = ctxOf(req);
  const designId = parseUuid(req.params.id);
  const body = uploadBody.parse(req.body);
  if (!(await repo.listDesigns(db, designId)).length) throw notFound('Diseño no encontrado');
  const ext = images.MIME_EXT[body.mime];
  if (!ext) throw new AppError(415, 'IMAGE_REJECTED', 'Formato no permitido: usá JPG, PNG o WebP', { allowed: Object.keys(images.MIME_EXT) });
  if (body.size > images.MAX_BYTES) throw new AppError(413, 'IMAGE_REJECTED', 'La imagen supera el máximo de 5 MB', { maxBytes: images.MAX_BYTES });
  res.json(await images.createUploadUrl(db, `${user.id}/${designId}/${crypto.randomUUID()}.${ext}`));
});

designsRouter.post('/designs/:id/images', async (req, res) => {
  const { db, user } = ctxOf(req);
  const designId = parseUuid(req.params.id);
  const body = registerBody.parse(req.body);
  if (!(await repo.listDesigns(db, designId)).length) throw notFound('Diseño no encontrado');
  if (!body.path.startsWith(`${user.id}/${designId}/`) || body.path.includes('..')) throw new AppError(422, 'INVALID_PATH', 'La ruta de la imagen no corresponde a este diseño');
  const info = await images.objectInfo(db, body.path);
  if (!info) throw new AppError(422, 'IMAGE_NOT_FOUND', 'La imagen todavía no se subió');
  if (!images.MIME_EXT[info.mime] || info.size > images.MAX_BYTES) {
    await images.removeObjects(db, [body.path]);
    throw new AppError(415, 'IMAGE_REJECTED', 'La imagen no cumple con el formato o el tamaño permitido');
  }
  const existing = await images.imagesOf(db, [designId]);
  const row = await images.insertImage(db, { design_id: designId, storage_path: body.path, filename: body.filename, mime: info.mime, size_bytes: info.size, sort: existing.length });
  const urls = await images.signedUrls(db, [row.storage_path]);
  res.status(201).json({ id: row.id, filename: row.filename, mime: row.mime, sizeBytes: row.size_bytes, url: urls.get(row.storage_path) ?? null });
});

designsRouter.delete('/designs/:id/images/:imageId', async (req, res) => {
  const { db } = ctxOf(req);
  const designId = parseUuid(req.params.id);
  const image = await images.getImage(db, parseUuid(req.params.imageId));
  if (!image || image.design_id !== designId) throw notFound('Imagen no encontrada');
  await images.removeObjects(db, [image.storage_path]);
  await images.deleteImageRow(db, image.id);
  res.status(204).end();
});
