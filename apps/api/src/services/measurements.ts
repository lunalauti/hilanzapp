import type { SupabaseClient } from '@supabase/supabase-js';
import { notFound } from '../lib/errors';
import * as repo from '../repositories/measurements';
import type { DefinitionRow, VersionRow } from '../repositories/measurements';

export const slugify = (name: string): string => {
  const s = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return /^[a-z]/.test(s) ? s : `m_${s || 'medida'}`;
};

export async function createCustomDefinition(db: SupabaseClient, name: string, required: boolean) {
  const existing = await repo.listDefinitions(db);
  const keys = new Set(existing.map((d) => d.key));
  const base = slugify(name);
  let key = base;
  for (let i = 2; keys.has(key); i++) key = `${base}_${i}`;
  return repo.createDefinition(db, { key, name, required, sort: Math.max(0, ...existing.map((d) => d.sort)) + 1 });
}

const version = (v: VersionRow) => ({
  id: v.id, definitionId: v.definition_id, valueCm: Number(v.value_cm), note: v.note, takenOn: v.taken_on, isCurrent: v.is_current, createdAt: v.created_at,
});
export const versionView = version;

export async function dancerMeasurements(db: SupabaseClient, dancerId: string) {
  const [defs, current] = await Promise.all([repo.listDefinitions(db), repo.currentVersions(db, dancerId)]);
  const byDef = new Map(current.map((v) => [v.definition_id, v]));
  return defs.filter((d) => d.kind === 'body').map((d) => {
    const v = byDef.get(d.id);
    return { definitionId: d.id, key: d.key, name: d.name, isBase: d.is_base, required: d.required, valueCm: v ? Number(v.value_cm) : null, note: v?.note ?? null, takenOn: v?.taken_on ?? null, versionId: v?.id ?? null };
  });
}

/** Valor de cada medida "a la fecha": la última versión con fecha de toma anterior o igual. */
function valueAt(versions: VersionRow[], date: string): VersionRow | undefined {
  return versions.filter((v) => v.taken_on <= date)
    .sort((a, b) => (a.taken_on === b.taken_on ? (a.created_at < b.created_at ? 1 : -1) : a.taken_on < b.taken_on ? 1 : -1))[0];
}

export async function compareTakes(db: SupabaseClient, dancerId: string, from: string, to: string) {
  const [defs, versions] = await Promise.all([repo.listDefinitions(db), repo.allVersions(db, dancerId)]);
  const byDef = new Map<string, VersionRow[]>();
  for (const v of versions) byDef.set(v.definition_id, [...(byDef.get(v.definition_id) ?? []), v]);
  const rows = [];
  for (const d of defs) {
    const list = byDef.get(d.id);
    if (!list) continue;
    const a = valueAt(list, from);
    const b = valueAt(list, to);
    if (!a && !b) continue;
    const av = a ? Number(a.value_cm) : null;
    const bv = b ? Number(b.value_cm) : null;
    rows.push({ definitionId: d.id, key: d.key, name: d.name, from: av, to: bv, diff: av !== null && bv !== null ? Math.round((bv - av) * 100) / 100 : null });
  }
  return rows;
}

export async function assertVersionOf(db: SupabaseClient, versionId: string, dancerId: string, definitionId: string) {
  const v = await repo.getVersion(db, versionId);
  if (!v || v.dancer_id !== dancerId || v.definition_id !== definitionId) throw notFound('Versión no encontrada');
}

export type { DefinitionRow };
