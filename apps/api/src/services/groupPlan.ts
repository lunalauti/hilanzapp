import type { SupabaseClient } from '@supabase/supabase-js';
import { unwrap } from '../lib/db';
import { loadPlanDefinitions, plansForDancers } from './measurePlan';

export interface GroupPlanDancer {
  id: string; name: string; missing: number; total: number; status: 'none' | 'partial' | 'complete';
  /** Una celda por medida de `measures`: `required=false` si la bailarina no la necesita. */
  cells: { definitionId: string; required: boolean; value: number | null }[];
  missingKeys: string[];
}

export interface GroupPlan {
  measures: { definitionId: string; key: string; name: string }[];
  dancers: GroupPlanDancer[];
  totals: { required: number; done: number; percent: number };
}

/** Matriz bailarinas × medidas requeridas, en orden corporal. */
export async function groupPlan(db: SupabaseClient, groupId: string, opts: { onlyMissing?: boolean } = {}): Promise<GroupPlan> {
  const dancers = unwrap(await db.from('dancers').select('id, name, group_id').eq('group_id', groupId).order('name')) as
    { id: string; name: string; group_id: string }[];
  const defs = await loadPlanDefinitions(db);
  const plans = await plansForDancers(db, dancers, defs);

  const used = new Map<string, { definitionId: string; key: string; name: string; sort: number }>();
  for (const p of plans.values()) for (const i of p.items) used.set(i.key, { definitionId: i.definitionId, key: i.key, name: i.name, sort: i.sort });
  const measures = [...used.values()].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'es'))
    .map(({ definitionId, key, name }) => ({ definitionId, key, name }));

  let required = 0;
  let done = 0;
  const rows: GroupPlanDancer[] = dancers.map((d) => {
    const plan = plans.get(d.id)!;
    required += plan.total;
    done += plan.done;
    const byKey = new Map(plan.items.map((i) => [i.key, i]));
    return {
      id: d.id, name: d.name, missing: plan.missing, total: plan.total, status: plan.status,
      cells: measures.map((m) => {
        const it = byKey.get(m.key);
        return { definitionId: m.definitionId, required: Boolean(it), value: it?.value ?? null };
      }),
      missingKeys: plan.items.filter((i) => i.value === null).map((i) => i.key),
    };
  });

  return {
    measures,
    dancers: opts.onlyMissing ? rows.filter((r) => r.missing > 0) : rows,
    totals: { required, done, percent: required ? Math.round((done / required) * 100) : 100 },
  };
}
