import type { SupabaseClient } from '@supabase/supabase-js';
import { unwrap } from '../lib/db';

export interface DefinitionRow { id: string; key: string; name: string; kind: string; is_base: boolean; required: boolean; sort: number }
export interface VersionRow { id: string; dancer_id: string; definition_id: string; value_cm: number | string; note: string | null; taken_on: string; is_current: boolean; created_at: string }

const DEF_COLS = 'id, key, name, kind, is_base, required, sort';
const VER_COLS = 'id, dancer_id, definition_id, value_cm, note, taken_on, is_current, created_at';

export async function listDefinitions(db: SupabaseClient) {
  return unwrap(await db.from('measure_definitions').select(DEF_COLS).order('sort').order('name')) as DefinitionRow[];
}

export async function getDefinition(db: SupabaseClient, id: string) {
  return unwrap(await db.from('measure_definitions').select(DEF_COLS).eq('id', id).maybeSingle()) as DefinitionRow | null;
}

export async function createDefinition(db: SupabaseClient, row: { key: string; name: string; required: boolean; sort: number }) {
  return unwrap(await db.from('measure_definitions').insert({ ...row, kind: 'body', is_base: false }).select(DEF_COLS).single()) as DefinitionRow;
}

export async function currentVersions(db: SupabaseClient, dancerId: string) {
  return unwrap(await db.from('measurement_versions').select(VER_COLS).eq('dancer_id', dancerId).eq('is_current', true)) as VersionRow[];
}

export async function allVersions(db: SupabaseClient, dancerId: string, definitionId?: string) {
  let q = db.from('measurement_versions').select(VER_COLS).eq('dancer_id', dancerId);
  if (definitionId) q = q.eq('definition_id', definitionId);
  return unwrap(await q.order('created_at', { ascending: false }).order('id')) as VersionRow[];
}

export async function getVersion(db: SupabaseClient, id: string) {
  return unwrap(await db.from('measurement_versions').select(VER_COLS).eq('id', id).maybeSingle()) as VersionRow | null;
}

export async function setMeasurement(db: SupabaseClient, a: { dancerId: string; definitionId: string; valueCm: number; note?: string | null; takenOn?: string }) {
  return unwrap(await db.rpc('set_measurement', {
    p_dancer: a.dancerId, p_definition: a.definitionId, p_value: a.valueCm, p_note: a.note ?? null, p_taken_on: a.takenOn ?? new Date().toISOString().slice(0, 10),
  })) as VersionRow;
}

export async function restoreVersion(db: SupabaseClient, versionId: string) {
  return unwrap(await db.rpc('restore_measurement', { p_version: versionId })) as VersionRow;
}
