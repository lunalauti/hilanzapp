import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError, notFound } from '../lib/errors';
import * as definitions from '../repositories/molds';
import * as repo from '../repositories/sizeTables';

export type AgeRange = 'bebe' | 'nino' | 'adolescente' | 'mujer' | 'otro';

export function gridView(t: repo.FullTable) {
  const sizes = [...t.size_table_sizes].sort((a, b) => a.sort - b.sort);
  const measures = new Map<string, { definitionId: string; key: string; name: string }>();
  for (const s of sizes) for (const v of s.size_table_values) if (v.measure_definitions) measures.set(v.definition_id, { definitionId: v.definition_id, ...v.measure_definitions });
  return {
    id: t.id, name: t.name, ageRange: t.age_range, source: t.source, isActive: t.is_active, baseTableId: t.base_table_id, templateKey: t.template_key,
    measures: [...measures.values()],
    sizes: sizes.map((s) => ({
      id: s.id, label: s.label, descriptor: s.descriptor, sort: s.sort,
      values: Object.fromEntries(s.size_table_values.filter((v) => v.measure_definitions).map((v) => [v.measure_definitions!.key, { value: Number(v.value_cm), origin: v.origin }])),
    })),
  };
}

export async function requireTable(db: SupabaseClient, id: string) {
  const t = await repo.getFullTable(db, id);
  if (!t) throw notFound('Tabla de talles no encontrada');
  return t;
}

export async function createTable(db: SupabaseClient, ownerId: string, input: {
  name: string; ageRange: AgeRange; source?: string | null;
  sizes: { label: string; descriptor?: string | null; values: Record<string, number>; origins?: Record<string, string> }[];
  baseTableId?: string | null;
}) {
  const defs = await definitions.definitionIdsByKey(db);
  const labels = new Set<string>();
  for (const s of input.sizes) {
    if (labels.has(s.label)) throw new AppError(422, 'VALIDATION_ERROR', `El talle ${s.label} está repetido`);
    labels.add(s.label);
    for (const k of Object.keys(s.values)) if (!defs.has(k)) throw new AppError(422, 'UNKNOWN_MEASURE', `La medida "${k}" no existe`);
  }
  const { id } = await repo.insertTable(db, { name: input.name, age_range: input.ageRange, source: input.source ?? null, is_active: false, base_table_id: input.baseTableId ?? null });
  try {
    if (input.sizes.length) {
      const created = await repo.insertSizes(db, input.sizes.map((s, sort) => ({ owner_id: ownerId, table_id: id, label: s.label, descriptor: s.descriptor ?? null, sort })));
      const idByLabel = new Map(created.map((c) => [c.label, c.id]));
      const values = input.sizes.flatMap((s) => Object.entries(s.values).map(([k, v]) => ({ owner_id: ownerId, size_id: idByLabel.get(s.label)!, definition_id: defs.get(k)!, value_cm: v, origin: s.origins?.[k] ?? 'user' })));
      for (let i = 0; i < values.length; i += 500) await repo.upsertValues(db, values.slice(i, i + 500));
    }
  } catch (e) {
    await repo.deleteTable(db, id);
    throw e;
  }
  return id;
}

export async function duplicateTable(db: SupabaseClient, ownerId: string, sourceId: string, name?: string) {
  const src = gridView(await requireTable(db, sourceId));
  return createTable(db, ownerId, {
    name: name ?? `${src.name} (copia)`, ageRange: src.ageRange as AgeRange, source: src.source, baseTableId: src.id,
    sizes: src.sizes.map((s) => ({
      label: s.label, descriptor: s.descriptor,
      values: Object.fromEntries(Object.entries(s.values).map(([k, v]) => [k, v.value])),
      origins: Object.fromEntries(Object.entries(s.values).map(([k, v]) => [k, v.origin])),
    })),
  });
}

export async function applyChanges(db: SupabaseClient, ownerId: string, tableId: string, changes: { sizeLabel: string; measureKey: string; value: number | null }[]) {
  await requireTable(db, tableId);
  const [sizeIds, defs] = await Promise.all([repo.sizeIdsByLabel(db, tableId), definitions.definitionIdsByKey(db)]);
  const upserts: Parameters<typeof repo.upsertValues>[1] = [];
  const removals: { sizeId: string; definitionId: string }[] = [];
  for (const c of changes) {
    const sizeId = sizeIds.get(c.sizeLabel);
    const definitionId = defs.get(c.measureKey);
    if (!sizeId) throw new AppError(422, 'UNKNOWN_SIZE', `El talle ${c.sizeLabel} no existe en esta tabla`);
    if (!definitionId) throw new AppError(422, 'UNKNOWN_MEASURE', `La medida "${c.measureKey}" no existe`);
    if (c.value === null) removals.push({ sizeId, definitionId });
    else upserts.push({ owner_id: ownerId, size_id: sizeId, definition_id: definitionId, value_cm: c.value, origin: 'user' });
  }
  await repo.upsertValues(db, upserts);
  for (const r of removals) await repo.deleteValue(db, r.sizeId, r.definitionId);
}
