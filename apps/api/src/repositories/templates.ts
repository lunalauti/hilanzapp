import type { SupabaseClient } from '@supabase/supabase-js';
import type { MoldDefinition, SizeTable } from '@hilanzapp/pattern-engine';
import { ALL_MEASURES, CATALOGS, MOLDS, SIZE_TABLE_TEMPLATES } from '@hilanzapp/seed-data';
import { unwrap } from '../lib/db';

export type DefinitionIds = Map<string, string>;

export async function ensureMeasureDefinitions(db: SupabaseClient, ownerId: string): Promise<DefinitionIds> {
  const rows = ALL_MEASURES.map((m, i) => ({
    owner_id: ownerId, key: m.key, name: m.name, kind: m.kind, is_base: m.isBase, required: m.required, sort: i, template_key: m.key,
  }));
  unwrap(await db.from('measure_definitions').upsert(rows, { onConflict: 'owner_id,key', ignoreDuplicates: true }));
  const all = unwrap(await db.from('measure_definitions').select('id, key')) as { id: string; key: string }[];
  return new Map(all.map((d) => [d.key, d.id]));
}

export async function ensureCatalogs(db: SupabaseClient, ownerId: string): Promise<void> {
  const rows = Object.entries(CATALOGS).flatMap(([category, labels]) =>
    labels.map((label) => ({ owner_id: ownerId, category, label, is_custom: false })));
  unwrap(await db.from('catalog_options').upsert(rows, { onConflict: 'owner_id,category,label', ignoreDuplicates: true }));
}

/** Reemplaza los datos hijos de un molde por los de su plantilla. */
async function writeMoldChildren(db: SupabaseClient, ownerId: string, moldId: string, mold: MoldDefinition, defs: DefinitionIds) {
  unwrap(await db.from('mold_inputs').delete().eq('mold_type_id', moldId));
  unwrap(await db.from('mold_formulas').delete().eq('mold_type_id', moldId));

  const inputs = mold.inputs.map((i, sort) => ({
    owner_id: ownerId, mold_type_id: moldId, key: i.key, label: i.label, source: i.source,
    definition_id: i.source === 'measure' || i.source === 'standard' ? (defs.get(i.measureKey ?? i.key) ?? null) : null,
    options: i.options ?? null, default_option_id: i.defaultOptionId ?? null, required: i.required !== false, sort,
  }));
  unwrap(await db.from('mold_inputs').insert(inputs));

  const formulas = mold.formulas.map((f, sort) => ({
    owner_id: ownerId, mold_type_id: moldId, key: f.key, label: f.label, section: f.section ?? null,
    operand_a: f.operandA, op: f.op, operand_b: f.operandB ?? null, adjustment_cm: f.adjustmentCm ?? 0, decimals: f.decimals ?? 1, sort,
    template_default: f,
  }));
  unwrap(await db.from('mold_formulas').insert(formulas));
}

export async function ensureMolds(db: SupabaseClient, ownerId: string, defs: DefinitionIds): Promise<number> {
  const existing = unwrap(await db.from('mold_types').select('id, key, mold_formulas(id)')) as { id: string; key: string; mold_formulas: unknown[] }[];
  const byKey = new Map(existing.map((m) => [m.key, m]));
  let created = 0;

  for (const mold of MOLDS) {
    const found = byKey.get(mold.key);
    if (found && found.mold_formulas.length > 0) continue;
    let id = found?.id;
    if (!id) {
      const row = unwrap(await db.from('mold_types').insert({
        owner_id: ownerId, key: mold.key, name: mold.name, category: mold.category, size_priority: mold.sizePriority, template_key: mold.key,
      }).select('id').single()) as { id: string };
      id = row.id;
    }
    await writeMoldChildren(db, ownerId, id, mold, defs);
    created++;
  }
  return created;
}

async function writeSizeTableChildren(db: SupabaseClient, ownerId: string, tableId: string, table: SizeTable, defs: DefinitionIds) {
  unwrap(await db.from('size_table_sizes').delete().eq('table_id', tableId));
  const sizeRows = table.sizes.map((s, sort) => ({ owner_id: ownerId, table_id: tableId, label: s.label, descriptor: s.descriptor ?? null, sort }));
  const sizes = unwrap(await db.from('size_table_sizes').insert(sizeRows).select('id, label')) as { id: string; label: string }[];
  const idByLabel = new Map(sizes.map((s) => [s.label, s.id]));

  const values = table.sizes.flatMap((s) =>
    Object.entries(s.values).map(([key, value]) => ({
      owner_id: ownerId, size_id: idByLabel.get(s.label)!, definition_id: defs.get(key)!, value_cm: value, origin: s.origins?.[key] ?? 'source',
    })));
  for (let i = 0; i < values.length; i += 500) unwrap(await db.from('size_table_values').insert(values.slice(i, i + 500)));
}

export async function ensureSizeTables(db: SupabaseClient, ownerId: string, defs: DefinitionIds): Promise<number> {
  const existing = unwrap(await db.from('size_tables').select('id, template_key, size_table_sizes(id)')) as { id: string; template_key: string | null; size_table_sizes: unknown[] }[];
  const byKey = new Map(existing.filter((t) => t.template_key).map((t) => [t.template_key!, t]));
  let created = 0;

  for (const { key, table } of SIZE_TABLE_TEMPLATES) {
    const found = byKey.get(key);
    if (found && found.size_table_sizes.length > 0) continue;
    let id = found?.id;
    if (!id) {
      const row = unwrap(await db.from('size_tables').insert({
        owner_id: ownerId, name: table.name, age_range: table.ageRange, source: table.source, is_active: true, template_key: key,
      }).select('id').single()) as { id: string };
      id = row.id;
    }
    await writeSizeTableChildren(db, ownerId, id, table, defs);
    created++;
  }
  return created;
}

export async function restoreMoldTemplate(db: SupabaseClient, ownerId: string, key: string): Promise<void> {
  const mold = MOLDS.find((m) => m.key === key);
  if (!mold) return void unwrap({ data: null, error: { code: 'P0002', message: `No existe la plantilla de molde ${key}` } });
  const defs = await ensureMeasureDefinitions(db, ownerId);
  const row = unwrap(await db.from('mold_types').select('id').eq('template_key', key).maybeSingle()) as { id: string } | null;
  if (!row) return void unwrap({ data: null, error: { code: 'P0002', message: `El molde ${key} no existe para esta usuaria` } });
  unwrap(await db.from('mold_types').update({ name: mold.name, category: mold.category, size_priority: mold.sizePriority }).eq('id', row.id));
  await writeMoldChildren(db, ownerId, row.id, mold, defs);
}

export async function restoreSizeTableTemplate(db: SupabaseClient, ownerId: string, key: string): Promise<void> {
  const tpl = SIZE_TABLE_TEMPLATES.find((t) => t.key === key);
  if (!tpl) return void unwrap({ data: null, error: { code: 'P0002', message: `No existe la plantilla de tabla ${key}` } });
  const defs = await ensureMeasureDefinitions(db, ownerId);
  const row = unwrap(await db.from('size_tables').select('id').eq('template_key', key).maybeSingle()) as { id: string } | null;
  if (!row) return void unwrap({ data: null, error: { code: 'P0002', message: `La tabla ${key} no existe para esta usuaria` } });
  await writeSizeTableChildren(db, ownerId, row.id, tpl.table, defs);
}
