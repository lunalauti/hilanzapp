import type { SupabaseClient } from '@supabase/supabase-js';
import { unwrap } from '../lib/db';

export interface DesignRow {
  id: string; name: string; notes: string | null; construction_details: string | null;
  neckline_id: string | null; sleeve_id: string | null; skirt_id: string | null;
  has_ruffle: boolean; is_asymmetric: boolean; created_at: string;
}
export interface GarmentRow {
  id: string; design_id: string; mold_type_id: string; labor_cost: number | string | null; sort: number;
  mold_types: {
    key: string; name: string; has_pattern: boolean; category: string; size_priority: string;
    mold_inputs: { source: string; sort: number; definition_id: string | null; measure_definitions: { key: string; name: string } | null }[];
  };
}
export interface SpecialRow { design_id: string; definition_id: string; measure_definitions: { key: string; name: string } }
export interface CatalogRow { id: string; category: 'neckline' | 'sleeve' | 'skirt'; label: string; is_custom: boolean }

const COLS = 'id, name, notes, construction_details, neckline_id, sleeve_id, skirt_id, has_ruffle, is_asymmetric, created_at';

export async function listDesigns(db: SupabaseClient, id?: string) {
  let q = db.from('designs').select(COLS).order('name');
  if (id) q = q.eq('id', id);
  return unwrap(await q) as DesignRow[];
}

export async function garmentsOf(db: SupabaseClient, designIds: string[]) {
  if (!designIds.length) return [];
  return unwrap(await db.from('design_garments').select('id, design_id, mold_type_id, labor_cost, sort, mold_types(key, name, has_pattern, category, size_priority, mold_inputs(source, sort, definition_id, measure_definitions(key, name)))').in('design_id', designIds).order('sort')) as unknown as GarmentRow[];
}

export async function specialsOf(db: SupabaseClient, designIds: string[]) {
  if (!designIds.length) return [];
  return unwrap(await db.from('design_special_measures').select('design_id, definition_id, measure_definitions(key, name)').in('design_id', designIds)) as unknown as SpecialRow[];
}

export async function listCatalog(db: SupabaseClient, category?: string) {
  let q = db.from('catalog_options').select('id, category, label, is_custom').order('is_custom').order('label');
  if (category) q = q.eq('category', category);
  return unwrap(await q) as CatalogRow[];
}

export async function findCatalog(db: SupabaseClient, category: string, label: string) {
  return unwrap(await db.from('catalog_options').select('id, category, label, is_custom').eq('category', category).ilike('label', label).maybeSingle()) as CatalogRow | null;
}

export async function insertCatalog(db: SupabaseClient, category: string, label: string) {
  return unwrap(await db.from('catalog_options').insert({ category, label, is_custom: true }).select('id, category, label, is_custom').single()) as CatalogRow;
}

export async function insertDesign(db: SupabaseClient, row: Record<string, unknown>) {
  return unwrap(await db.from('designs').insert(row).select(COLS).single()) as DesignRow;
}

export async function updateDesign(db: SupabaseClient, id: string, patch: Record<string, unknown>) {
  if (Object.keys(patch).length === 0) return (await listDesigns(db, id))[0] ?? null;
  return unwrap(await db.from('designs').update(patch).eq('id', id).select(COLS).maybeSingle()) as DesignRow | null;
}

export async function deleteDesign(db: SupabaseClient, id: string) {
  return (unwrap(await db.from('designs').delete().eq('id', id).select('id')) as unknown[]).length > 0;
}

export async function countAssignments(db: SupabaseClient, designId: string) {
  const { count, error } = await db.from('assignments').select('id', { count: 'exact', head: true }).eq('design_id', designId);
  unwrap({ data: null, error });
  return count ?? 0;
}

/** Sincroniza por diferencia para no perder datos colgados de una prenda (consumos, costos). */
export async function syncGarments(db: SupabaseClient, designId: string, wanted: { moldTypeId: string; laborCost?: number | null }[]) {
  const existing = unwrap(await db.from('design_garments').select('id, mold_type_id').eq('design_id', designId)) as { id: string; mold_type_id: string }[];
  const byMold = new Map(existing.map((g) => [g.mold_type_id, g.id]));
  const keep = new Set(wanted.map((w) => w.moldTypeId));

  const removedGarments = existing.filter((g) => !keep.has(g.mold_type_id));
  if (removedGarments.length) {
    const moldIds = removedGarments.map((g) => g.mold_type_id);
    unwrap(await db.from('assignments').delete().eq('design_id', designId).in('mold_type_id', moldIds));
    unwrap(await db.from('design_garments').delete().in('id', removedGarments.map((g) => g.id)));
    await dropUnusedPlaceholders(db, moldIds);
  }

  for (const [sort, w] of wanted.entries()) {
    const id = byMold.get(w.moldTypeId);
    if (id) {
      const patch: Record<string, unknown> = { sort };
      if (w.laborCost !== undefined) patch.labor_cost = w.laborCost;
      unwrap(await db.from('design_garments').update(patch).eq('id', id));
    } else {
      unwrap(await db.from('design_garments').insert({ design_id: designId, mold_type_id: w.moldTypeId, labor_cost: w.laborCost ?? null, sort }));
    }
  }
}

export async function syncSpecials(db: SupabaseClient, designId: string, definitionIds: string[]) {
  const existing = unwrap(await db.from('design_special_measures').select('id, definition_id').eq('design_id', designId)) as { id: string; definition_id: string }[];
  const have = new Set(existing.map((e) => e.definition_id));
  const keep = new Set(definitionIds);
  const removed = existing.filter((e) => !keep.has(e.definition_id)).map((e) => e.id);
  if (removed.length) unwrap(await db.from('design_special_measures').delete().in('id', removed));
  const added = definitionIds.filter((d) => !have.has(d)).map((d) => ({ design_id: designId, definition_id: d }));
  if (added.length) unwrap(await db.from('design_special_measures').insert(added));
}

/** Cantidad de bailarinas con cada prenda de cada diseño: clave `diseño|molde`. */
export async function assignedCounts(db: SupabaseClient, designIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!designIds.length) return out;
  const rows = unwrap(await db.from('assignments').select('design_id, mold_type_id').in('design_id', designIds)) as { design_id: string; mold_type_id: string }[];
  for (const r of rows) out.set(`${r.design_id}|${r.mold_type_id}`, (out.get(`${r.design_id}|${r.mold_type_id}`) ?? 0) + 1);
  return out;
}

/** Un molde vacío (prenda propia) que ya no está en ningún diseño se elimina para no dejar basura. */
export async function dropUnusedPlaceholders(db: SupabaseClient, moldIds: string[]) {
  for (const id of moldIds) {
    const mold = unwrap(await db.from('mold_types').select('id, has_pattern').eq('id', id).maybeSingle()) as { id: string; has_pattern: boolean } | null;
    if (!mold || mold.has_pattern) continue;
    const { count, error } = await db.from('design_garments').select('id', { count: 'exact', head: true }).eq('mold_type_id', id);
    unwrap({ data: null, error });
    if ((count ?? 0) === 0) unwrap(await db.from('mold_types').delete().eq('id', id));
  }
}
