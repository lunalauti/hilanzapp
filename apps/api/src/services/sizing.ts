import type { SupabaseClient } from '@supabase/supabase-js';
import {
  defaultAgeRange, effectiveSize, suggestSize,
  type AgeRange, type SizePriority, type SizeSuggestion, type SizeTable, type ValueOrigin,
} from '@hilanzapp/pattern-engine';
import { unwrap } from '../lib/db';

export interface LoadedTable {
  id: string;
  ageRange: AgeRange;
  isActive: boolean;
  table: SizeTable;
}

interface TableRow {
  id: string; name: string; age_range: AgeRange; source: string | null; is_active: boolean;
  size_table_sizes: {
    label: string; descriptor: string | null; sort: number;
    size_table_values: { value_cm: number | string; origin: ValueOrigin; measure_definitions: { key: string } | null }[];
  }[];
}

export async function loadSizeTables(db: SupabaseClient): Promise<LoadedTable[]> {
  const rows = unwrap(await db.from('size_tables').select(
    'id, name, age_range, source, is_active, size_table_sizes(label, descriptor, sort, size_table_values(value_cm, origin, measure_definitions(key)))',
  )) as unknown as TableRow[];

  return rows.map((t) => ({
    id: t.id,
    ageRange: t.age_range,
    isActive: t.is_active,
    table: {
      name: t.name, ageRange: t.age_range, source: t.source ?? '',
      sizes: [...t.size_table_sizes].sort((a, b) => a.sort - b.sort).map((s) => {
        const values: Record<string, number> = {};
        const origins: Record<string, ValueOrigin> = {};
        for (const v of s.size_table_values) {
          if (!v.measure_definitions) continue;
          values[v.measure_definitions.key] = Number(v.value_cm);
          origins[v.measure_definitions.key] = v.origin;
        }
        return { label: s.label, descriptor: s.descriptor ?? undefined, values, origins };
      }),
    },
  }));
}

export function pickTable(tables: LoadedTable[], dancer: { size_table_id: string | null; age: number | null }): LoadedTable | null {
  if (dancer.size_table_id) return tables.find((t) => t.id === dancer.size_table_id) ?? null;
  const range = defaultAgeRange(dancer.age ?? 18);
  return tables.find((t) => t.ageRange === range && t.isActive) ?? null;
}

/** Medidas corporales vigentes por bailarina, indexadas por clave de medida. */
export async function loadCurrentMeasures(db: SupabaseClient, dancerIds: string[]): Promise<Map<string, Record<string, number>>> {
  const out = new Map<string, Record<string, number>>(dancerIds.map((id) => [id, {}]));
  if (!dancerIds.length) return out;
  const rows = unwrap(await db.from('measurement_versions')
    .select('dancer_id, value_cm, measure_definitions(key)').eq('is_current', true).in('dancer_id', dancerIds)) as unknown as
    { dancer_id: string; value_cm: number | string; measure_definitions: { key: string } | null }[];
  for (const r of rows) if (r.measure_definitions) out.get(r.dancer_id)![r.measure_definitions.key] = Number(r.value_cm);
  return out;
}

export interface SizeView {
  label: string | null;
  origin: 'assignment' | 'dancer' | 'suggested' | null;
  suggested: string | null;
  manual: string | null;
  outOfRange: boolean;
  needsReview: boolean;
  suggestion: SizeSuggestion | null;
}

export function sizeView(
  loaded: LoadedTable | null,
  measures: Record<string, number>,
  priority: SizePriority,
  manual: { assignment?: string | null; dancer?: string | null },
): SizeView {
  const suggestion = loaded ? suggestSize(loaded.table, measures, priority) : null;
  const eff = effectiveSize({ assignmentManual: manual.assignment, dancerManual: manual.dancer, suggested: suggestion?.suggested });
  const main = suggestion?.perMeasure.find((m) => m.sizeLabel === suggestion.suggested && (m.measureKey === (priority === 'cadera' ? 'cadera' : 'pecho')));
  return {
    label: eff.label, origin: eff.origin, suggested: suggestion?.suggested ?? null,
    manual: manual.assignment ?? manual.dancer ?? null,
    outOfRange: Boolean(main?.outOfRange), needsReview: suggestion?.needsReview ?? false, suggestion,
  };
}

export async function resolveDancerSizing(
  db: SupabaseClient,
  dancer: { id: string; age: number | null; size_table_id: string | null; manual_size_label: string | null },
  mold: { size_priority: SizePriority } | null,
  assignmentManual?: string | null,
) {
  const [tables, measures] = await Promise.all([loadSizeTables(db), loadCurrentMeasures(db, [dancer.id])]);
  const loaded = pickTable(tables, dancer);
  const m = measures.get(dancer.id) ?? {};
  const view = sizeView(loaded, m, mold?.size_priority ?? 'pecho', { assignment: assignmentManual, dancer: dancer.manual_size_label });
  return { loaded, measures: m, view };
}

export async function dancerSizing(
  db: SupabaseClient,
  dancer: { id: string; age: number | null; size_table_id: string | null; manual_size_label: string | null },
  mold: { id: string; key: string; name: string; size_priority: SizePriority } | null,
  assignmentManual?: string | null,
) {
  const { loaded, view } = await resolveDancerSizing(db, dancer, mold, assignmentManual);
  const priority: SizePriority = mold?.size_priority ?? 'pecho';
  return {
    table: loaded ? { id: loaded.id, name: loaded.table.name, ageRange: loaded.ageRange, forced: dancer.size_table_id !== null } : null,
    mold: mold ? { id: mold.id, key: mold.key, name: mold.name } : null,
    priority,
    perMeasure: view.suggestion?.perMeasure ?? [],
    components: view.suggestion?.components ?? { pecho: null, cadera: null },
    suggested: view.suggested,
    needsReview: view.needsReview,
    outOfRange: view.outOfRange,
    missing: view.suggestion?.missing ?? [],
    manual: { assignment: assignmentManual ?? null, dancer: dancer.manual_size_label },
    effective: { label: view.label, origin: view.origin },
    availableSizes: loaded ? loaded.table.sizes.map((s) => s.label) : [],
  };
}
