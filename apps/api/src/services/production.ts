import type { SupabaseClient } from '@supabase/supabase-js';
import { aggregateProduction } from '@hilanzapp/pattern-engine';
import { groupDancersView } from './dancers';
import * as repo from '../repositories/production';
import * as dancersRepo from '../repositories/dancers';
import * as measurementsRepo from '../repositories/measurements';
import * as moldsRepo from '../repositories/molds';
import { loadCurrentMeasures, loadSizeTables, pickTable, type LoadedTable } from './sizing';

/** Se recalcula en cada lectura: talles, medidas y prendas siempre vigentes; el progreso (patrón/confección) es lo único persistido. */
export async function groupProduction(db: SupabaseClient, groupId: string) {
  const dancers = await groupDancersView(db, groupId);
  const flat = dancers.flatMap((d) => d.garments.map((g) => ({
    dancerId: d.id, dancerName: d.name, assignmentId: g.assignmentId, moldTypeId: g.moldTypeId,
    moldKey: g.moldKey, moldName: g.moldName, sizeLabel: g.sizeLabel, hasPattern: g.hasPattern,
  })));
  const summary = aggregateProduction({
    dancers: dancers.map((d) => ({ id: d.id, name: d.name })),
    assignments: flat.map(({ dancerId, moldKey, moldName, sizeLabel, hasPattern }) => ({ dancerId, moldKey, moldName, sizeLabel, hasPattern })),
  });

  const bySize = new Map<string, { moldTypeId: string; units: { assignmentId: string; dancerId: string; dancerName: string }[] }>();
  for (const a of flat) {
    if (!a.sizeLabel) continue;
    const key = `${a.moldKey}|${a.sizeLabel}`;
    const entry = bySize.get(key) ?? { moldTypeId: a.moldTypeId, units: [] };
    entry.units.push({ assignmentId: a.assignmentId, dancerId: a.dancerId, dancerName: a.dancerName });
    bySize.set(key, entry);
  }
  const stages = await repo.listStages(db, groupId);
  const stageDone = new Map(stages.map((s) => [`${s.mold_type_id}|${s.size_label}`, s.pattern_done_at !== null]));
  const sewnSet = await repo.listSewnAssignmentIds(db, flat.map((a) => a.assignmentId));

  const byGarment = summary.byGarment.map((g) => ({
    ...g,
    sizes: g.sizes.map((s) => {
      const entry = bySize.get(`${g.moldKey}|${s.label}`);
      const units = entry?.units ?? [];
      return {
        ...s,
        moldTypeId: entry?.moldTypeId ?? null,
        patternDone: entry ? (stageDone.get(`${entry.moldTypeId}|${s.label}`) ?? false) : false,
        sewnCount: units.filter((u) => sewnSet.has(u.assignmentId)).length,
        sewnTotal: units.length,
        units: units.map((u) => ({ ...u, sewn: sewnSet.has(u.assignmentId) })),
      };
    }),
  }));

  return {
    dancerCount: dancers.length,
    byGarment,
    pending: summary.pending,
    totalUnits: summary.byGarment.reduce((n, g) => n + g.total, 0),
  };
}

export async function setPatternDone(db: SupabaseClient, ownerId: string, groupId: string, moldTypeId: string, sizeLabel: string, done: boolean) {
  await repo.setStage(db, ownerId, groupId, moldTypeId, sizeLabel, done);
}

export async function setSewnDone(db: SupabaseClient, ownerId: string, assignmentId: string, done: boolean) {
  await repo.setSewnUnit(db, ownerId, assignmentId, done);
}

export interface SizeAverageMeasure { key: string; name: string; value: number | null; source: 'real' | 'table'; dancerCount: number }
export interface SizeAverage { label: string; tableName: string | null; ageRange: string | null; measures: SizeAverageMeasure[] }

/** Promedio real de las medidas de las bailarinas del grupo en cada talle, con respaldo en la tabla de talles activa. */
export async function sizeAverages(db: SupabaseClient, groupId: string, moldTypeId: string, sizeLabels: string[]): Promise<SizeAverage[] | null> {
  const mold = await moldsRepo.getMold(db, moldTypeId);
  if (!mold) return null;
  const measureInputs = mold.def.inputs.filter((i) => i.source === 'measure');
  if (!measureInputs.length) return sizeLabels.map((label) => ({ label, tableName: null, ageRange: null, measures: [] }));

  const [dancersView, { dancers: rawDancers }, tables, defs] = await Promise.all([
    groupDancersView(db, groupId),
    dancersRepo.listGroupDancers(db, groupId),
    loadSizeTables(db),
    measurementsRepo.listDefinitions(db),
  ]);
  const nameByKey = new Map(defs.map((d) => [d.key, d.name]));
  const rawById = new Map(rawDancers.map((d) => [d.id, d]));
  const currentMeasures = await loadCurrentMeasures(db, dancersView.map((d) => d.id));

  return sizeLabels.map((label) => {
    const matched = dancersView.filter((d) => d.garments.some((g) => g.moldTypeId === moldTypeId && g.sizeLabel === label));
    const matchedTables = matched
      .map((d) => rawById.get(d.id))
      .filter((d): d is NonNullable<typeof d> => d !== undefined)
      .map((d) => pickTable(tables, d))
      .filter((t): t is LoadedTable => t !== null);
    const table = matchedTables[0] ?? tables.find((t) => t.isActive && t.table.sizes.some((s) => s.label === label)) ?? null;

    const measures = measureInputs.map((input): SizeAverageMeasure => {
      const key = input.measureKey ?? input.key;
      const values = matched.map((d) => currentMeasures.get(d.id)?.[key]).filter((v): v is number => v !== undefined);
      if (values.length) {
        const avg = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
        return { key, name: nameByKey.get(key) ?? key, value: avg, source: 'real', dancerCount: values.length };
      }
      const tableValue = table?.table.sizes.find((s) => s.label === label)?.values[key] ?? null;
      return { key, name: nameByKey.get(key) ?? key, value: tableValue, source: 'table', dancerCount: 0 };
    });
    return { label, tableName: table?.table.name ?? null, ageRange: table?.ageRange ?? null, measures };
  });
}
