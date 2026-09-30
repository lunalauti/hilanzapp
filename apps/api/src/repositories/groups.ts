import type { SupabaseClient } from '@supabase/supabase-js';
import { unwrap } from '../lib/db';

export interface GroupRow { id: string; name: string; created_at: string; category_id: string | null; archived_at: string | null }

export async function listGroups(db: SupabaseClient, status: { group_id: string; status: string }[], opts: { includeArchived?: boolean } = {}) {
  let q = db.from('groups').select('id, name, created_at, category_id, archived_at').order('name');
  if (!opts.includeArchived) q = q.is('archived_at', null);
  const groups = unwrap(await q) as GroupRow[];
  const byGroup = new Map<string, { dancerCount: number; complete: number; partial: number; none: number }>();
  for (const s of status) {
    const g = byGroup.get(s.group_id) ?? { dancerCount: 0, complete: 0, partial: 0, none: 0 };
    g.dancerCount++;
    g[s.status as 'complete' | 'partial' | 'none']++;
    byGroup.set(s.group_id, g);
  }
  return groups.map((g) => ({ ...g, ...(byGroup.get(g.id) ?? { dancerCount: 0, complete: 0, partial: 0, none: 0 }) }));
}

export async function createGroup(db: SupabaseClient, name: string, categoryId: string | null) {
  return unwrap(await db.from('groups').insert({ name, category_id: categoryId }).select('id, name, created_at, category_id, archived_at').single()) as GroupRow;
}

export async function updateGroup(db: SupabaseClient, id: string, patch: Record<string, unknown>) {
  if (!Object.keys(patch).length) return unwrap(await db.from('groups').select('id, name, created_at, category_id, archived_at').eq('id', id).maybeSingle()) as GroupRow | null;
  return unwrap(await db.from('groups').update(patch).eq('id', id).select('id, name, created_at, category_id, archived_at').maybeSingle()) as GroupRow | null;
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
