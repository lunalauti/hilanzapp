import type { SupabaseClient } from '@supabase/supabase-js';
import { unwrap } from '../lib/db';

export interface GroupRow { id: string; name: string; created_at: string }

export async function listGroups(db: SupabaseClient) {
  const groups = unwrap(await db.from('groups').select('id, name, created_at').order('name')) as GroupRow[];
  const status = unwrap(await db.from('dancer_measure_status').select('group_id, status')) as { group_id: string; status: string }[];
  const byGroup = new Map<string, { dancerCount: number; complete: number; partial: number; none: number }>();
  for (const s of status) {
    const g = byGroup.get(s.group_id) ?? { dancerCount: 0, complete: 0, partial: 0, none: 0 };
    g.dancerCount++;
    g[s.status as 'complete' | 'partial' | 'none']++;
    byGroup.set(s.group_id, g);
  }
  return groups.map((g) => ({ ...g, ...(byGroup.get(g.id) ?? { dancerCount: 0, complete: 0, partial: 0, none: 0 }) }));
}

export async function createGroup(db: SupabaseClient, name: string) {
  return unwrap(await db.from('groups').insert({ name }).select('id, name, created_at').single()) as GroupRow;
}

export async function renameGroup(db: SupabaseClient, id: string, name: string) {
  return unwrap(await db.from('groups').update({ name }).eq('id', id).select('id, name, created_at').maybeSingle()) as GroupRow | null;
}

export async function countDancers(db: SupabaseClient, groupId: string): Promise<number> {
  const { count, error } = await db.from('dancers').select('id', { count: 'exact', head: true }).eq('group_id', groupId);
  unwrap({ data: null, error });
  return count ?? 0;
}

export async function groupExists(db: SupabaseClient, id: string): Promise<boolean> {
  return unwrap(await db.from('groups').select('id').eq('id', id).maybeSingle()) !== null;
}

export async function deleteGroup(db: SupabaseClient, id: string): Promise<boolean> {
  const rows = unwrap(await db.from('groups').delete().eq('id', id).select('id')) as unknown[];
  return rows.length > 0;
}
