import type { SupabaseClient } from '@supabase/supabase-js';
import * as repo from '../repositories/dancers';
import { plansForDancers } from './measurePlan';
import { loadCurrentMeasures, loadSizeTables, pickTable, sizeView } from './sizing';

export async function groupDancersView(db: SupabaseClient, groupId: string) {
  const { dancers, assignments } = await repo.listGroupDancers(db, groupId);
  const [tables, measures, plans] = await Promise.all([loadSizeTables(db), loadCurrentMeasures(db, dancers.map((d) => d.id)), plansForDancers(db, dancers)]);

  return dancers.map((d) => {
    const loaded = pickTable(tables, d);
    const m = measures.get(d.id) ?? {};
    const plan = plans.get(d.id)!;
    const size = sizeView(loaded, m, 'pecho', { dancer: d.manual_size_label });
    return {
      id: d.id, name: d.name, age: d.age, notes: d.notes, contact: d.contact, groupId: d.group_id,
      measureStatus: plan.status, requiredDone: plan.done, requiredTotal: plan.total, missingCount: plan.missing,
      size: { label: size.label, origin: size.origin, suggested: size.suggested, manual: size.manual, outOfRange: size.outOfRange },
      garments: assignments.filter((a) => a.dancer_id === d.id).map((a) => {
        const gs = sizeView(loaded, m, a.mold_types.size_priority, { assignment: a.manual_size_label, dancer: d.manual_size_label });
        return { assignmentId: a.id, moldTypeId: a.mold_type_id, moldKey: a.mold_types.key, moldName: a.mold_types.name, hasPattern: a.mold_types.has_pattern, designId: a.design_id, designName: a.designs?.name ?? null, sizeLabel: gs.label };
      }),
    };
  });
}
