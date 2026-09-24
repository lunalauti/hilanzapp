import type { SupabaseClient } from '@supabase/supabase-js';
import { unwrap } from '../lib/db';

export interface MaterialRow { id: string; name: string; description: string | null; unit: string; unit_cost: number | string; stock_qty: number | string }
export interface RuleRow { id: string; design_garment_id: string; material_id: string; size_label: string | null; quantity: number | string }
export interface GarmentRef { id: string; design_id: string; mold_type_id: string; labor_cost: number | string | null; mold_types: { name: string }; designs: { name: string } }

const MAT = 'id, name, description, unit, unit_cost, stock_qty';

export async function listMaterials(db: SupabaseClient) {
  return unwrap(await db.from('materials').select(MAT).order('name')) as MaterialRow[];
}
export async function getMaterial(db: SupabaseClient, id: string) {
  return unwrap(await db.from('materials').select(MAT).eq('id', id).maybeSingle()) as MaterialRow | null;
}
export async function insertMaterial(db: SupabaseClient, row: Record<string, unknown>) {
  return unwrap(await db.from('materials').insert(row).select(MAT).single()) as MaterialRow;
}
export async function updateMaterial(db: SupabaseClient, id: string, patch: Record<string, unknown>) {
  if (!Object.keys(patch).length) return getMaterial(db, id);
  return unwrap(await db.from('materials').update(patch).eq('id', id).select(MAT).maybeSingle()) as MaterialRow | null;
}
export async function deleteMaterial(db: SupabaseClient, id: string) {
  return (unwrap(await db.from('materials').delete().eq('id', id).select('id')) as unknown[]).length > 0;
}
export async function moveStock(db: SupabaseClient, a: { materialId: string; delta: number; reason: 'manual' | 'production'; note?: string | null; groupId?: string | null; designId?: string | null }) {
  return unwrap(await db.rpc('apply_stock_movement', { p_material: a.materialId, p_delta: a.delta, p_reason: a.reason, p_note: a.note ?? null, p_group: a.groupId ?? null, p_design: a.designId ?? null })) as MaterialRow;
}
export async function confirmProduction(db: SupabaseClient, groupId: string, designId: string | null, items: { material_id: string; qty: number }[]) {
  return unwrap(await db.rpc('confirm_production', { p_group: groupId, p_design: designId, p_items: items })) as number;
}
export async function movements(db: SupabaseClient, materialId: string) {
  return unwrap(await db.from('stock_movements').select('id, delta, reason, note, group_id, design_id, created_at').eq('material_id', materialId).order('created_at', { ascending: false }).limit(50)) as
    { id: string; delta: number | string; reason: string; note: string | null; group_id: string | null; design_id: string | null; created_at: string }[];
}
export async function ruleCount(db: SupabaseClient, materialId: string) {
  const { count, error } = await db.from('consumption_rules').select('id', { count: 'exact', head: true }).eq('material_id', materialId);
  unwrap({ data: null, error });
  return count ?? 0;
}
export async function rulesForDesign(db: SupabaseClient, designId?: string) {
  const garments = await garmentRefs(db, designId ? [designId] : undefined);
  if (!garments.length) return { garments, rules: [] as RuleRow[] };
  const rules = unwrap(await db.from('consumption_rules').select('id, design_garment_id, material_id, size_label, quantity').in('design_garment_id', garments.map((g) => g.id))) as RuleRow[];
  return { garments, rules };
}
export async function garmentRefs(db: SupabaseClient, designIds?: string[]) {
  let q = db.from('design_garments').select('id, design_id, mold_type_id, labor_cost, mold_types(name), designs(name)');
  if (designIds) q = q.in('design_id', designIds);
  return unwrap(await q) as unknown as GarmentRef[];
}
export async function garmentExists(db: SupabaseClient, id: string) {
  return unwrap(await db.from('design_garments').select('id').eq('id', id).maybeSingle()) !== null;
}
export async function replaceRules(db: SupabaseClient, garmentId: string, materialId: string, rules: { size_label: string | null; quantity: number }[]) {
  unwrap(await db.from('consumption_rules').delete().eq('design_garment_id', garmentId).eq('material_id', materialId));
  if (rules.length) unwrap(await db.from('consumption_rules').insert(rules.map((r) => ({ design_garment_id: garmentId, material_id: materialId, ...r }))));
}
