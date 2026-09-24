import type { SupabaseClient } from '@supabase/supabase-js';
import * as repo from '../repositories/dancers';
import { loadCurrentMeasures, loadSizeTables, pickTable, sizeView } from './sizing';

export async function groupDancersView(db: SupabaseClient, groupId: string) {
  const { dancers, status, assignments } = await repo.listGroupDancers(db, groupId);
  const [tables, measures] = await Promise.all([loadSizeTables(db), loadCurrentMeasures(db, dancers.map((d) => d.id))]);

  return dancers.map((d) => {
    const loaded = pickTable(tables, d);
    const m = measures.get(d.id) ?? {};
    const st = status.find((s) => s.dancer_id === d.id);
    const size = sizeView(loaded, m, 'pecho', { dancer: d.manual_size_label });
    return {
      id: d.id, name: d.name, age: d.age, notes: d.notes, groupId: d.group_id,
      measureStatus: st?.status ?? 'none', requiredDone: st?.required_done ?? 0, requiredTotal: st?.required_total ?? 0,
      size: { label: size.label, origin: size.origin, suggested: size.suggested, manual: size.manual, outOfRange: size.outOfRange },
      garments: assignments.filter((a) => a.dancer_id === d.id).map((a) => {
        const gs = sizeView(loaded, m, a.mold_types.size_priority, { assignment: a.manual_size_label, dancer: d.manual_size_label });
        return { assignmentId: a.id, moldKey: a.mold_types.key, moldName: a.mold_types.name, designName: a.designs?.name ?? null, sizeLabel: gs.label };
      }),
    };
  });
}
