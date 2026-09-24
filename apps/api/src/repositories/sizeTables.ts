import type { SupabaseClient } from '@supabase/supabase-js';
import { unwrap } from '../lib/db';

export interface TableRow { id: string; name: string; age_range: string; source: string | null; is_active: boolean; base_table_id: string | null; template_key: string | null }
export interface FullTable extends TableRow {
  size_table_sizes: { id: string; label: string; descriptor: string | null; sort: number; size_table_values: { value_cm: number | string; origin: string; definition_id: string; measure_definitions: { key: string; name: string } | null }[] }[];
}
const COLS = 'id, name, age_range, source, is_active, base_table_id, template_key';

export async function listTables(db: SupabaseClient) {
  return unwrap(await db.from('size_tables').select(`${COLS}, size_table_sizes(id)`).order('age_range').order('name')) as unknown as (TableRow & { size_table_sizes: { id: string }[] })[];
}

export async function getFullTable(db: SupabaseClient, id: string) {
  return unwrap(await db.from('size_tables').select(`${COLS}, size_table_sizes(id, label, descriptor, sort, size_table_values(value_cm, origin, definition_id, measure_definitions(key, name)))`).eq('id', id).maybeSingle()) as unknown as FullTable | null;
}

export async function getRow(db: SupabaseClient, id: string) {
  return unwrap(await db.from('size_tables').select(COLS).eq('id', id).maybeSingle()) as TableRow | null;
}

export async function updateTable(db: SupabaseClient, id: string, patch: Record<string, unknown>) {
  if (!Object.keys(patch).length) return true;
  return (unwrap(await db.from('size_tables').update(patch).eq('id', id).select('id')) as unknown[]).length > 0;
}

export async function deleteTable(db: SupabaseClient, id: string) {
  return (unwrap(await db.from('size_tables').delete().eq('id', id).select('id')) as unknown[]).length > 0;
}

export async function insertTable(db: SupabaseClient, row: Record<string, unknown>) {
  return unwrap(await db.from('size_tables').insert(row).select('id').single()) as { id: string };
}

export async function sizeIdsByLabel(db: SupabaseClient, tableId: string) {
  const rows = unwrap(await db.from('size_table_sizes').select('id, label').eq('table_id', tableId)) as { id: string; label: string }[];
  return new Map(rows.map((r) => [r.label, r.id]));
}

export async function insertSizes(db: SupabaseClient, rows: { owner_id: string; table_id: string; label: string; descriptor: string | null; sort: number }[]) {
  return unwrap(await db.from('size_table_sizes').insert(rows).select('id, label')) as { id: string; label: string }[];
}

export async function deleteSize(db: SupabaseClient, tableId: string, sizeId: string) {
  return (unwrap(await db.from('size_table_sizes').delete().eq('table_id', tableId).eq('id', sizeId).select('id')) as unknown[]).length > 0;
}

export async function upsertValues(db: SupabaseClient, rows: { owner_id: string; size_id: string; definition_id: string; value_cm: number; origin: string }[]) {
  if (rows.length) unwrap(await db.from('size_table_values').upsert(rows, { onConflict: 'size_id,definition_id' }));
}

export async function deleteValue(db: SupabaseClient, sizeId: string, definitionId: string) {
  unwrap(await db.from('size_table_values').delete().eq('size_id', sizeId).eq('definition_id', definitionId));
}

export async function activate(db: SupabaseClient, id: string) {
  unwrap(await db.rpc('activate_size_table', { p_table: id }));
}

export async function maxSort(db: SupabaseClient, tableId: string) {
  const rows = unwrap(await db.from('size_table_sizes').select('sort').eq('table_id', tableId).order('sort', { ascending: false }).limit(1)) as { sort: number }[];
  return rows[0]?.sort ?? -1;
}
