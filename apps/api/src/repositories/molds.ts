import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChoiceOption, Formula, MoldDefinition, MoldInput, Op } from '@hilanzapp/pattern-engine';
import { unwrap } from '../lib/db';

interface MoldRow {
  id: string; key: string; name: string; category: MoldDefinition['category']; size_priority: MoldDefinition['sizePriority'];
  mold_inputs: { key: string; label: string; source: MoldInput['source']; options: ChoiceOption[] | null; default_option_id: string | null; required: boolean; sort: number; measure_definitions: { key: string } | null }[];
  mold_formulas: { key: string; label: string; section: string | null; operand_a: string; op: Op; operand_b: string | null; adjustment_cm: number | string; decimals: number; sort: number }[];
}

const COLS = `id, key, name, category, size_priority,
  mold_inputs(key, label, source, options, default_option_id, required, sort, measure_definitions(key)),
  mold_formulas(key, label, section, operand_a, op, operand_b, adjustment_cm, decimals, sort)`;

export interface StoredMold { id: string; def: MoldDefinition }

function toMold(r: MoldRow): StoredMold {
  return {
    id: r.id,
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
