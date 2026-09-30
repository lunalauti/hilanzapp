import type { SupabaseClient } from '@supabase/supabase-js';
import { unwrap } from '../lib/db';

export interface CategoryRow { id: string; name: string; sort: number }

export async function listCategories(db: SupabaseClient) {
  return unwrap(await db.from('group_categories').select('id, name, sort').order('sort').order('name')) as CategoryRow[];
}

export async function createCategory(db: SupabaseClient, name: string) {
  return unwrap(await db.from('group_categories').insert({ name }).select('id, name, sort').single()) as CategoryRow;
}

export async function renameCategory(db: SupabaseClient, id: string, name: string) {
  return unwrap(await db.from('group_categories').update({ name }).eq('id', id).select('id, name, sort').maybeSingle()) as CategoryRow | null;
}

export async function categoryExists(db: SupabaseClient, id: string): Promise<boolean> {
  return unwrap(await db.from('group_categories').select('id').eq('id', id).maybeSingle()) !== null;
}

export async function deleteCategory(db: SupabaseClient, id: string): Promise<boolean> {
  const rows = unwrap(await db.from('group_categories').delete().eq('id', id).select('id')) as unknown[];
  return rows.length > 0;
}
