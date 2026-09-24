import type { SupabaseClient } from '@supabase/supabase-js';
import { aggregateProduction } from '@hilanzapp/pattern-engine';
import { groupDancersView } from './dancers';

/** Se recalcula en cada lectura: talles, medidas y prendas siempre vigentes. */
export async function groupProduction(db: SupabaseClient, groupId: string) {
  const dancers = await groupDancersView(db, groupId);
  const summary = aggregateProduction({
    dancers: dancers.map((d) => ({ id: d.id, name: d.name })),
    assignments: dancers.flatMap((d) => d.garments.map((g) => ({ dancerId: d.id, moldKey: g.moldKey, moldName: g.moldName, sizeLabel: g.sizeLabel }))),
  });
  return {
    dancerCount: dancers.length,
    byGarment: summary.byGarment,
    pending: summary.pending,
    totalUnits: summary.byGarment.reduce((n, g) => n + g.total, 0),
  };
}
