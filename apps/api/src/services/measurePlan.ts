import type { SupabaseClient } from '@supabase/supabase-js';
import { buildMeasurePlan, type CurrentMeasure, type MeasurePlan, type PlanDefinition, type PlanSource } from '@hilanzapp/pattern-engine';
import { measureOrder } from '@hilanzapp/seed-data';
import { unwrap } from '../lib/db';

const PAGE = 1000;
const MAX_IN = 80;

/** PostgREST corta en 1000 filas por pedido: se pagina. */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const rows = unwrap((await build(from, from + PAGE - 1)) as Parameters<typeof unwrap>[0]) as unknown as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

export interface PlanDancer { id: string; group_id: string }

export async function loadPlanDefinitions(db: SupabaseClient): Promise<PlanDefinition[]> {
  const rows = unwrap(await db.from('measure_definitions').select('id, key, name, is_base, required, sort').eq('kind', 'body')) as
    { id: string; key: string; name: string; is_base: boolean; required: boolean; sort: number }[];
  return rows.map((d) => ({ id: d.id, key: d.key, name: d.name, sort: measureOrder(d.key, d.sort), isBase: d.is_base, required: d.required }));
}

interface AssignmentRow {
  dancer_id: string; design_id: string | null;
  mold_types: { name: string; mold_inputs: { source: string; key: string; measure_definitions: { key: string } | null }[] } | null;
  designs: { name: string } | null;
}

/** Plan de medidas de cada bailarina según lo que tiene asignado (lote: pocas consultas por pedido). */
export async function plansForDancers(db: SupabaseClient, dancers: PlanDancer[], defs?: PlanDefinition[]): Promise<Map<string, MeasurePlan>> {
  const out = new Map<string, MeasurePlan>();
  if (!dancers.length) return out;
  const ids = new Set(dancers.map((d) => d.id));
  const scoped = ids.size <= MAX_IN;
  const idList = [...ids];

  const [definitions, assignments, versions, groupDesigns, specials] = await Promise.all([
    defs ?? loadPlanDefinitions(db),
    fetchAll<AssignmentRow>((a, b) => {
      const q = db.from('assignments').select('dancer_id, design_id, mold_types(name, mold_inputs(source, key, measure_definitions(key))), designs(name)').order('id').range(a, b);
      return scoped ? q.in('dancer_id', idList) : q;
    }),
    fetchAll<{ dancer_id: string; value_cm: number | string; taken_on: string; measure_definitions: { key: string } | null }>((a, b) => {
      const q = db.from('measurement_versions').select('dancer_id, value_cm, taken_on, measure_definitions(key)').eq('is_current', true).order('id').range(a, b);
      return scoped ? q.in('dancer_id', idList) : q;
    }),
    fetchAll<{ group_id: string; design_id: string; designs: { name: string } | null }>((a, b) =>
      db.from('group_designs').select('group_id, design_id, designs(name)').order('id').range(a, b)),
    fetchAll<{ design_id: string; measure_definitions: { key: string } | null }>((a, b) =>
      db.from('design_special_measures').select('design_id, measure_definitions(key)').order('id').range(a, b)),
  ]);

  const currentBy = new Map<string, Record<string, CurrentMeasure>>();
  for (const v of versions) {
    if (!ids.has(v.dancer_id) || !v.measure_definitions) continue;
    const m = currentBy.get(v.dancer_id) ?? {};
    m[v.measure_definitions.key] = { valueCm: Number(v.value_cm), takenOn: v.taken_on };
    currentBy.set(v.dancer_id, m);
  }
  const specialsBy = new Map<string, string[]>();
  for (const s of specials) if (s.measure_definitions) specialsBy.set(s.design_id, [...(specialsBy.get(s.design_id) ?? []), s.measure_definitions.key]);
  const designsOfGroup = new Map<string, { id: string; name: string }[]>();
  for (const g of groupDesigns) if (g.designs) designsOfGroup.set(g.group_id, [...(designsOfGroup.get(g.group_id) ?? []), { id: g.design_id, name: g.designs.name }]);

  for (const d of dancers) {
    const mine = assignments.filter((a) => a.dancer_id === d.id);
    const sources: PlanSource[] = [];
    const designs = new Map<string, string>(); // id -> nombre
    for (const a of mine) {
      if (a.mold_types) {
        const keys = a.mold_types.mold_inputs.filter((i) => i.source === 'measure').map((i) => i.measure_definitions?.key ?? i.key);
        sources.push({ kind: 'garment', label: a.mold_types.name, keys });
      }
      if (a.design_id && a.designs) designs.set(a.design_id, a.designs.name);
    }
    for (const g of designsOfGroup.get(d.group_id) ?? []) designs.set(g.id, g.name);
    for (const [designId, name] of designs) {
      const keys = specialsBy.get(designId) ?? [];
      if (keys.length) sources.push({ kind: 'design', label: name, keys });
    }
    out.set(d.id, buildMeasurePlan({ defs: definitions, sources, current: currentBy.get(d.id) ?? {} }));
  }
  return out;
}
