import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError, notFound } from '../lib/errors';
import { unwrap } from '../lib/db';
import * as molds from '../repositories/molds';
import { slugify } from './measurements';

export interface PlaceholderInput {
  name: string;
  category: 'cuerpo' | 'manga' | 'pantalon' | 'falda' | 'vestido' | 'otro';
  sizePriority: 'pecho' | 'cadera' | 'both';
  measureIds: string[];
}

/** Guarda las medidas requeridas de una prenda sin molde como entradas del molde vacío, en el orden dado. */
export async function setRequiredMeasures(db: SupabaseClient, ownerId: string, moldId: string, measureIds: string[]) {
  const unique = [...new Set(measureIds)];
  const defs = unique.length
    ? (unwrap(await db.from('measure_definitions').select('id, key, name').eq('kind', 'body').in('id', unique)) as { id: string; key: string; name: string }[])
    : [];
  if (defs.length !== unique.length) throw new AppError(422, 'UNKNOWN_MEASURE', 'Alguna de las medidas elegidas no existe');
  const byId = new Map(defs.map((d) => [d.id, d]));
  unwrap(await db.from('mold_inputs').delete().eq('mold_type_id', moldId));
  if (!unique.length) return;
  unwrap(await db.from('mold_inputs').insert(unique.map((id, sort) => {
    const d = byId.get(id)!;
    return { owner_id: ownerId, mold_type_id: moldId, key: d.key, label: d.name, source: 'measure', definition_id: d.id, required: true, sort };
  })));
}

/** Crea un molde vacío (sin fórmulas todavía) que representa una prenda propia. */
export async function createPlaceholder(db: SupabaseClient, ownerId: string, input: PlaceholderInput): Promise<string> {
  const keys = await molds.moldKeys(db);
  const base = `propia_${slugify(input.name)}`.slice(0, 60);
  let key = base;
  for (let i = 2; keys.has(key); i++) key = `${base}_${i}`;
  const { id } = await molds.insertMold(db, { key, name: input.name, category: input.category, size_priority: input.sizePriority, has_pattern: false });
  try {
    await setRequiredMeasures(db, ownerId, id, input.measureIds);
  } catch (e) {
    await molds.deleteMold(db, id);
    throw e;
  }
  return id;
}

/** Edita una prenda propia mientras siga sin molde; con molde real los datos se cambian en el editor de fórmulas. */
export async function updatePlaceholder(db: SupabaseClient, ownerId: string, moldId: string, input: PlaceholderInput): Promise<boolean> {
  const row = await molds.getMoldRow(db, moldId);
  if (!row) throw notFound('Molde no encontrado');
  if (row.has_pattern) return false;
  await molds.updateMold(db, moldId, { name: input.name, category: input.category, size_priority: input.sizePriority });
  await setRequiredMeasures(db, ownerId, moldId, input.measureIds);
  return true;
}

interface Impact { newMeasures: { key: string; name: string }[]; assignments: number; garments: number; dancersMissing: number; dancerNames: string[] }

/** Qué pasaría al vincular: medidas nuevas que pide el molde destino y cuántas bailarinas no las tienen. */
export async function linkPreview(db: SupabaseClient, fromId: string, toId: string): Promise<Impact> {
  const [from, to] = await Promise.all([molds.getMold(db, fromId), molds.getMold(db, toId)]);
  if (!from || !to) throw notFound('Molde no encontrado');
  if (from.hasPattern) throw new AppError(422, 'NOT_A_PLACEHOLDER', 'Esta prenda ya tiene molde');
  if (!to.hasPattern) throw new AppError(422, 'TARGET_HAS_NO_PATTERN', 'El molde elegido todavía no tiene fórmulas');

  const keysOf = (m: NonNullable<typeof from>) => m.def.inputs.filter((i) => i.source === 'measure').map((i) => ({ key: i.measureKey ?? i.key, name: i.label }));
  const have = new Set(keysOf(from).map((k) => k.key));
  const newMeasures = keysOf(to).filter((k) => !have.has(k.key));

  const rows = unwrap(await db.from('assignments').select('dancer_id, dancers(name)').eq('mold_type_id', fromId)) as unknown as { dancer_id: string; dancers: { name: string } | null }[];
  const garments = unwrap(await db.from('design_garments').select('id').eq('mold_type_id', fromId)) as unknown[];
  const dancers = new Map(rows.map((r) => [r.dancer_id, r.dancers?.name ?? '']));

  let missing: string[] = [];
  if (newMeasures.length && dancers.size) {
    const versions = unwrap(await db.from('measurement_versions').select('dancer_id, measure_definitions(key)').eq('is_current', true).in('dancer_id', [...dancers.keys()])) as unknown as
      { dancer_id: string; measure_definitions: { key: string } | null }[];
    const got = new Map<string, Set<string>>();
    for (const v of versions) if (v.measure_definitions) got.set(v.dancer_id, (got.get(v.dancer_id) ?? new Set()).add(v.measure_definitions.key));
    missing = [...dancers.keys()].filter((id) => newMeasures.some((m) => !got.get(id)?.has(m.key)));
  }
  return {
    newMeasures, assignments: rows.length, garments: garments.length,
    dancersMissing: missing.length, dancerNames: missing.slice(0, 3).map((id) => dancers.get(id)!).filter(Boolean),
  };
}

export async function linkMold(db: SupabaseClient, fromId: string, toId: string): Promise<{ garments: number; assignments: number; sheets: number }> {
  const { data, error } = await db.rpc('link_placeholder_mold', { p_from: fromId, p_to: toId });
  return unwrap({ data, error }) as { garments: number; assignments: number; sheets: number };
}
