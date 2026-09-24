import type { SupabaseClient } from '@supabase/supabase-js';
import { unwrap } from '../lib/db';

export interface DancerRow {
  id: string; group_id: string; name: string; age: number | null; measured_on: string | null;
  manual_size_label: string | null; size_table_id: string | null; notes: string | null; contact: string | null;
}

const COLS = 'id, group_id, name, age, measured_on, manual_size_label, size_table_id, notes, contact';

export async function getDancer(db: SupabaseClient, id: string) {
  return unwrap(await db.from('dancers').select(COLS).eq('id', id).maybeSingle()) as DancerRow | null;
}

export async function createDancer(db: SupabaseClient, input: Record<string, unknown>) {
  return unwrap(await db.from('dancers').insert(input).select(COLS).single()) as DancerRow;
}

export async function updateDancer(db: SupabaseClient, id: string, patch: Record<string, unknown>) {
  return unwrap(await db.from('dancers').update(patch).eq('id', id).select(COLS).maybeSingle()) as DancerRow | null;
}

export async function deleteDancer(db: SupabaseClient, id: string) {
  const rows = unwrap(await db.from('dancers').delete().eq('id', id).select('id')) as unknown[];
  return rows.length > 0;
}

export async function dependentsOf(db: SupabaseClient, dancerId: string): Promise<number> {
  let total = 0;
  for (const table of ['measurement_versions', 'assignments', 'pattern_sheets']) {
    const { count, error } = await db.from(table).select('id', { count: 'exact', head: true }).eq('dancer_id', dancerId);
    unwrap({ data: null, error });
    total += count ?? 0;
  }
  return total;
}

export async function listGroupDancers(db: SupabaseClient, groupId: string) {
  const dancers = unwrap(await db.from('dancers').select(COLS).eq('group_id', groupId).order('name')) as DancerRow[];
  const ids = dancers.map((d) => d.id);
  const status = ids.length
    ? (unwrap(await db.from('dancer_measure_status').select('dancer_id, status, required_done, required_total').in('dancer_id', ids)) as
        { dancer_id: string; status: string; required_done: number; required_total: number }[])
    : [];
  const assignments = ids.length
    ? (unwrap(await db.from('assignments').select('id, dancer_id, design_id, mold_type_id, manual_size_label, mold_types(key, name, size_priority), designs(name)').in('dancer_id', ids)) as unknown as
        { id: string; dancer_id: string; design_id: string | null; mold_type_id: string; manual_size_label: string | null; mold_types: { key: string; name: string; size_priority: 'pecho' | 'cadera' | 'both' }; designs: { name: string } | null }[])
    : [];
  return { dancers, status, assignments };
}

/** Qué se pierde al borrar a la bailarina: se muestra antes de pedir la confirmación. */
export async function impact(db: SupabaseClient, dancerId: string) {
  const count = async (table: string, extra?: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => {
    let q = base(table);
    if (extra) q = extra(q);
    const { count: n, error } = await q;
    unwrap({ data: null, error });
    return n ?? 0;
  };
  const base = (table: string) => db.from(table).select('id', { count: 'exact', head: true }).eq('dancer_id', dancerId);
  const [measures, versions, assignments, sheets] = await Promise.all([
    count('measurement_versions', (q) => q.eq('is_current', true)), count('measurement_versions'), count('assignments'), count('pattern_sheets'),
  ]);
  return { measures, versions, assignments, sheets };
}
