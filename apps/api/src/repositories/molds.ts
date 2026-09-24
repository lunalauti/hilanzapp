import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChoiceOption, Formula, MoldDefinition, MoldInput, Op } from '@hilanzapp/pattern-engine';
import { unwrap } from '../lib/db';

interface MoldRow {
  id: string; key: string; name: string; category: MoldDefinition['category']; size_priority: MoldDefinition['sizePriority'];
  mold_inputs: { key: string; label: string; source: MoldInput['source']; options: ChoiceOption[] | null; default_option_id: string | null; required: boolean; sort: number; measure_definitions: { key: string } | null }[];
  mold_formulas: { key: string; label: string; section: string | null; operand_a: string; op: Op; operand_b: string | null; adjustment_cm: number | string; decimals: number; sort: number; template_default: Formula | null }[];
  template_key: string | null;
}

const COLS = `id, key, name, category, size_priority, template_key,
  mold_inputs(key, label, source, options, default_option_id, required, sort, measure_definitions(key)),
  mold_formulas(key, label, section, operand_a, op, operand_b, adjustment_cm, decimals, sort, template_default)`;

export interface StoredMold { id: string; def: MoldDefinition; templateKey: string | null; originals: Record<string, Formula> }

function toMold(r: MoldRow): StoredMold {
  return {
    id: r.id,
    templateKey: r.template_key,
    originals: Object.fromEntries(r.mold_formulas.filter((f) => f.template_default).map((f) => [f.key, f.template_default as Formula])),
    def: {
      key: r.key, name: r.name, category: r.category, sizePriority: r.size_priority,
      inputs: [...r.mold_inputs].sort((a, b) => a.sort - b.sort).map((i) => ({
        key: i.key, label: i.label, source: i.source,
        ...(i.measure_definitions ? { measureKey: i.measure_definitions.key } : {}),
        ...(i.options ? { options: i.options } : {}),
        ...(i.default_option_id ? { defaultOptionId: i.default_option_id } : {}),
        required: i.required,
      })),
      formulas: [...r.mold_formulas].sort((a, b) => a.sort - b.sort).map((f): Formula => ({
        key: f.key, label: f.label, ...(f.section ? { section: f.section } : {}), operandA: f.operand_a, op: f.op,
        ...(f.operand_b !== null ? { operandB: f.operand_b } : {}), adjustmentCm: Number(f.adjustment_cm), decimals: f.decimals,
      })),
    },
  };
}

export async function listMolds(db: SupabaseClient): Promise<StoredMold[]> {
  return (unwrap(await db.from('mold_types').select(COLS).order('name')) as unknown as MoldRow[]).map(toMold);
}

export async function getMold(db: SupabaseClient, id: string): Promise<StoredMold | null> {
  const row = unwrap(await db.from('mold_types').select(COLS).eq('id', id).maybeSingle()) as unknown as MoldRow | null;
  return row ? toMold(row) : null;
}

export async function findAssignmentSize(db: SupabaseClient, dancerId: string, moldTypeId: string, designId?: string | null) {
  let q = db.from('assignments').select('manual_size_label').eq('dancer_id', dancerId).eq('mold_type_id', moldTypeId);
  if (designId) q = q.eq('design_id', designId);
  const rows = unwrap(await q.order('created_at').limit(1)) as { manual_size_label: string | null }[];
  return rows[0]?.manual_size_label ?? null;
}

export async function insertSheet(db: SupabaseClient, row: { dancer_id: string; mold_type_id: string; design_id: string | null; size_label: string | null; snapshot: unknown }) {
  return unwrap(await db.from('pattern_sheets').insert(row).select('id, created_at').single()) as { id: string; created_at: string };
}

export async function listSheets(db: SupabaseClient, dancerId: string) {
  return unwrap(await db.from('pattern_sheets').select('id, size_label, created_at, design_id, mold_types(key, name)').eq('dancer_id', dancerId).order('created_at', { ascending: false })) as unknown as
    { id: string; size_label: string | null; created_at: string; design_id: string | null; mold_types: { key: string; name: string } }[];
}

export async function getSheet(db: SupabaseClient, id: string) {
  return unwrap(await db.from('pattern_sheets').select('id, dancer_id, mold_type_id, design_id, size_label, snapshot, created_at').eq('id', id).maybeSingle()) as
    { id: string; dancer_id: string; mold_type_id: string; design_id: string | null; size_label: string | null; snapshot: unknown; created_at: string } | null;
}

export async function definitionIdsByKey(db: SupabaseClient): Promise<Map<string, string>> {
  const rows = unwrap(await db.from('measure_definitions').select('id, key')) as { id: string; key: string }[];
  return new Map(rows.map((r) => [r.key, r.id]));
}

export async function getMoldRow(db: SupabaseClient, id: string) {
  return unwrap(await db.from('mold_types').select('id, key, name, category, size_priority, template_key').eq('id', id).maybeSingle()) as
    { id: string; key: string; name: string; category: string; size_priority: string; template_key: string | null } | null;
}

export async function moldKeys(db: SupabaseClient): Promise<Set<string>> {
  return new Set((unwrap(await db.from('mold_types').select('key')) as { key: string }[]).map((m) => m.key));
}

export async function insertMold(db: SupabaseClient, row: { key: string; name: string; category: string; size_priority: string }) {
  return unwrap(await db.from('mold_types').insert(row).select('id').single()) as { id: string };
}

export async function updateMold(db: SupabaseClient, id: string, patch: Record<string, unknown>) {
  if (!Object.keys(patch).length) return true;
  return (unwrap(await db.from('mold_types').update(patch).eq('id', id).select('id')) as unknown[]).length > 0;
}

export async function deleteMold(db: SupabaseClient, id: string) {
  return (unwrap(await db.from('mold_types').delete().eq('id', id).select('id')) as unknown[]).length > 0;
}

export async function moldDependents(db: SupabaseClient, id: string): Promise<{ assignments: number; sheets: number }> {
  const count = async (table: string) => {
    const { count: n, error } = await db.from(table).select('id', { count: 'exact', head: true }).eq('mold_type_id', id);
    unwrap({ data: null, error });
    return n ?? 0;
  };
  return { assignments: await count('assignments'), sheets: await count('pattern_sheets') };
}

export async function formulaDefaults(db: SupabaseClient, moldId: string): Promise<Map<string, unknown>> {
  const rows = unwrap(await db.from('mold_formulas').select('key, template_default').eq('mold_type_id', moldId)) as { key: string; template_default: unknown }[];
  return new Map(rows.filter((r) => r.template_default).map((r) => [r.key, r.template_default]));
}

export async function rawChildren(db: SupabaseClient, moldId: string) {
  const [inputs, formulas] = await Promise.all([
    db.from('mold_inputs').select('*').eq('mold_type_id', moldId),
    db.from('mold_formulas').select('*').eq('mold_type_id', moldId),
  ]);
  return { inputs: unwrap(inputs) as Record<string, unknown>[], formulas: unwrap(formulas) as Record<string, unknown>[] };
}

export async function restoreRawChildren(db: SupabaseClient, moldId: string, raw: Awaited<ReturnType<typeof rawChildren>>) {
  await db.from('mold_inputs').delete().eq('mold_type_id', moldId);
  await db.from('mold_formulas').delete().eq('mold_type_id', moldId);
  if (raw.inputs.length) await db.from('mold_inputs').insert(raw.inputs);
  if (raw.formulas.length) await db.from('mold_formulas').insert(raw.formulas);
}

export async function latestSheetsForGroup(db: SupabaseClient, groupId: string, moldTypeId: string) {
  const dancers = unwrap(await db.from('dancers').select('id, name').eq('group_id', groupId).order('name')) as { id: string; name: string }[];
  if (!dancers.length) return [];
  const sheets = unwrap(await db.from('pattern_sheets').select('id, dancer_id, size_label, created_at').eq('mold_type_id', moldTypeId).in('dancer_id', dancers.map((d) => d.id)).order('created_at', { ascending: false })) as
    { id: string; dancer_id: string; size_label: string | null; created_at: string }[];
  const latest = new Map<string, (typeof sheets)[number]>();
  for (const s of sheets) if (!latest.has(s.dancer_id)) latest.set(s.dancer_id, s);
  return dancers.map((d) => {
    const s = latest.get(d.id);
    return { dancerId: d.id, dancerName: d.name, sheetId: s?.id ?? null, sizeLabel: s?.size_label ?? null, createdAt: s?.created_at ?? null };
  });
}
