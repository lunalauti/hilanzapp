import type { SupabaseClient } from '@supabase/supabase-js';
import { unwrap } from '../lib/db';

export interface StageRow { mold_type_id: string; size_label: string; pattern_done_at: string | null }

export async function listStages(db: SupabaseClient, groupId: string) {
  return unwrap(await db.from('production_stages').select('mold_type_id, size_label, pattern_done_at').eq('group_id', groupId)) as StageRow[];
}

export async function setStage(db: SupabaseClient, ownerId: string, groupId: string, moldTypeId: string, sizeLabel: string, done: boolean) {
  unwrap(await db.from('production_stages').upsert(
    { owner_id: ownerId, group_id: groupId, mold_type_id: moldTypeId, size_label: sizeLabel, pattern_done_at: done ? new Date().toISOString() : null },
    { onConflict: 'group_id,mold_type_id,size_label' },
  ));
}

export async function listSewnAssignmentIds(db: SupabaseClient, assignmentIds: string[]) {
  if (!assignmentIds.length) return new Set<string>();
  const rows = unwrap(await db.from('production_units').select('assignment_id').in('assignment_id', assignmentIds)) as { assignment_id: string }[];
  return new Set(rows.map((r) => r.assignment_id));
}

export async function setSewnUnit(db: SupabaseClient, ownerId: string, assignmentId: string, done: boolean) {
  if (done) unwrap(await db.from('production_units').upsert({ owner_id: ownerId, assignment_id: assignmentId }, { onConflict: 'assignment_id' }));
  else unwrap(await db.from('production_units').delete().eq('assignment_id', assignmentId));
}
