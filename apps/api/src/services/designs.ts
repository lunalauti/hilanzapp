import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../lib/errors';
import { unwrap } from '../lib/db';
import * as repo from '../repositories/designs';
import * as images from '../repositories/images';
import { createPlaceholder, updatePlaceholder, type PlaceholderInput } from './placeholderMolds';

export async function designsView(db: SupabaseClient, id?: string) {
  const designs = await repo.listDesigns(db, id);
  const ids = designs.map((d) => d.id);
  const [garments, specials, catalog, imgs, counts] = await Promise.all([repo.garmentsOf(db, ids), repo.specialsOf(db, ids), repo.listCatalog(db), images.imagesOf(db, ids), repo.assignedCounts(db, ids)]);
  const urls = await images.signedUrls(db, imgs.map((i) => i.storage_path));
  const option = (optId: string | null) => {
    const c = catalog.find((x) => x.id === optId);
    return c ? { id: c.id, label: c.label, isCustom: c.is_custom } : null;
  };
  return designs.map((d) => ({
    id: d.id, name: d.name, notes: d.notes, constructionDetails: d.construction_details,
    neckline: option(d.neckline_id), sleeve: option(d.sleeve_id), skirt: option(d.skirt_id),
    hasRuffle: d.has_ruffle, isAsymmetric: d.is_asymmetric, createdAt: d.created_at,
    garments: garments.filter((g) => g.design_id === d.id).map((g) => ({
      id: g.id, moldTypeId: g.mold_type_id, moldKey: g.mold_types.key, moldName: g.mold_types.name, laborCost: g.labor_cost === null ? null : Number(g.labor_cost),
      hasPattern: g.mold_types.has_pattern, category: g.mold_types.category, sizePriority: g.mold_types.size_priority,
      assignedCount: counts.get(`${d.id}|${g.mold_type_id}`) ?? 0,
      // Solo las prendas sin molde muestran sus medidas requeridas (las de un molde real se ven en el editor de fórmulas).
      requiredMeasures: g.mold_types.has_pattern ? [] : [...g.mold_types.mold_inputs].filter((i) => i.source === 'measure' && i.measure_definitions).sort((a, b) => a.sort - b.sort)
        .map((i) => ({ definitionId: i.definition_id!, key: i.measure_definitions!.key, name: i.measure_definitions!.name })),
    })),
    images: imgs.filter((i) => i.design_id === d.id).map((i) => ({ id: i.id, filename: i.filename, mime: i.mime, sizeBytes: i.size_bytes, url: urls.get(i.storage_path) ?? null })),
    specialMeasures: specials.filter((s) => s.design_id === d.id).map((s) => ({ definitionId: s.definition_id, key: s.measure_definitions.key, name: s.measure_definitions.name })),
  }));
}

export interface GarmentInput {
  moldTypeId?: string;
  laborCost?: number | null;
  custom?: { name: string; category: PlaceholderInput['category']; sizePriority: PlaceholderInput['sizePriority']; measureIds: string[] };
}

/** Convierte las prendas del pedido en `{ moldTypeId, laborCost }`: crea o actualiza los moldes vacíos de las prendas propias. */
export async function resolveGarments(db: SupabaseClient, ownerId: string, garments: GarmentInput[]) {
  const existingNames = new Map<string, string>();
  const ids = garments.filter((g) => g.moldTypeId && !g.custom).map((g) => g.moldTypeId!);
  if (ids.length) {
    const rows = unwrap(await db.from('mold_types').select('id, name').in('id', ids)) as { id: string; name: string }[];
    for (const r of rows) existingNames.set(r.id, r.name);
  }
  const names = garments.map((g) => (g.custom ? g.custom.name : existingNames.get(g.moldTypeId!) ?? '').trim().toLowerCase()).filter(Boolean);
  const dup = names.find((n, i) => names.indexOf(n) !== i);
  if (dup) throw new AppError(422, 'DUPLICATE_GARMENT_NAME', `Ya hay una prenda “${dup}” en este diseño. Elegí otro nombre.`, { name: dup });

  const out: { moldTypeId: string; laborCost?: number | null }[] = [];
  for (const g of garments) {
    let moldTypeId = g.moldTypeId;
    if (g.custom) {
      const input = { ...g.custom, measureIds: g.custom.measureIds };
      if (moldTypeId) await updatePlaceholder(db, ownerId, moldTypeId, input);
      else moldTypeId = await createPlaceholder(db, ownerId, input);
    }
    out.push({ moldTypeId: moldTypeId!, ...(g.laborCost !== undefined ? { laborCost: g.laborCost } : {}) });
  }
  return out;
}
