import type { SupabaseClient } from '@supabase/supabase-js';
import { unwrap } from '../lib/db';

export interface AssignmentRow {
  id: string; dancer_id: string; design_id: string | null; mold_type_id: string; manual_size_label: string | null;
  mold_types: { key: string; name: string; size_priority: 'pecho' | 'cadera' | 'both' };
  designs: { name: string } | null;
}

const COLS = 'id, dancer_id, design_id, mold_type_id, manual_size_label, mold_types(key, name, size_priority), designs(name)';

export async function listForDancer(db: SupabaseClient, dancerId: string) {
  return unwrap(await db.from('assignments').select(COLS).eq('dancer_id', dancerId).order('created_at')) as unknown as AssignmentRow[];
}

export async function getAssignment(db: SupabaseClient, id: string) {
  return unwrap(await db.from('assignments').select(COLS).eq('id', id).maybeSingle()) as unknown as AssignmentRow | null;
}

export async function createAssignment(db: SupabaseClient, row: { dancer_id: string; mold_type_id: string; design_id: string | null }) {
  const created = unwrap(await db.from('assignments').insert(row).select('id').single()) as { id: string };
  return (await getAssignment(db, created.id))!;
}

export async function setAssignmentSize(db: SupabaseClient, id: string, label: string | null) {
  const rows = unwrap(await db.from('assignments').update({ manual_size_label: label }).eq('id', id).select('id')) as unknown[];
  return rows.length > 0;
}

export async function deleteAssignment(db: SupabaseClient, id: string) {
  return (unwrap(await db.from('assignments').delete().eq('id', id).select('id')) as unknown[]).length > 0;
}

export async function moldExists(db: SupabaseClient, id: string) {
  return unwrap(await db.from('mold_types').select('id').eq('id', id).maybeSingle()) !== null;
}

export async function designGarments(db: SupabaseClient, designId: string) {
  return unwrap(await db.from('design_garments').select('mold_type_id').eq('design_id', designId)) as { mold_type_id: string }[];
}

export async function designExists(db: SupabaseClient, id: string) {
  return unwrap(await db.from('designs').select('id').eq('id', id).maybeSingle()) !== null;
}

export async function groupDancerIds(db: SupabaseClient, groupId: string) {
  return (unwrap(await db.from('dancers').select('id').eq('group_id', groupId)) as { id: string }[]).map((d) => d.id);
}

export async function existingPairs(db: SupabaseClient, dancerIds: string[], designId: string) {
  if (!dancerIds.length) return [];
  return unwrap(await db.from('assignments').select('dancer_id, mold_type_id').eq('design_id', designId).in('dancer_id', dancerIds)) as { dancer_id: string; mold_type_id: string }[];
}

export async function insertMany(db: SupabaseClient, rows: { dancer_id: string; mold_type_id: string; design_id: string }[]) {
  if (rows.length) unwrap(await db.from('assignments').insert(rows));
}

export async function linkGroupDesign(db: SupabaseClient, groupId: string, designId: string) {
  unwrap(await db.from('group_designs').upsert({ group_id: groupId, design_id: designId }, { onConflict: 'group_id,design_id', ignoreDuplicates: true }));
}
