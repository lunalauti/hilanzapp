import type { SupabaseClient } from '@supabase/supabase-js';
import { validateFormulaSet, type FormulaError, type MoldDefinition } from '@hilanzapp/pattern-engine';
import { AppError } from '../lib/errors';
import * as molds from '../repositories/molds';
import { writeMoldChildren } from '../repositories/templates';
import { slugify } from './measurements';

export class FormulaInvalid extends AppError {
  constructor(errors: FormulaError[], extra: string[] = []) {
    super(422, 'FORMULA_INVALID', 'Las fórmulas tienen errores: revisalas antes de guardar', { errors, extra });
  }
}

/** Valida el molde completo (fórmulas del motor + medidas y opciones que deben existir). */
export function assertValidDefinition(def: MoldDefinition, knownMeasureKeys: Set<string>): void {
  const extra: string[] = [];
  for (const i of def.inputs) {
    if ((i.source === 'measure' || i.source === 'standard') && !knownMeasureKeys.has(i.measureKey ?? i.key)) extra.push(`La medida "${i.measureKey ?? i.key}" no existe`);
    if (i.source === 'choice') {
      if (!i.options?.length) extra.push(`"${i.label}" necesita al menos una opción`);
      else if (i.defaultOptionId && !i.options.some((o) => o.id === i.defaultOptionId)) extra.push(`La opción por defecto de "${i.label}" no existe`);
    }
  }
  const errors = validateFormulaSet(def);
  if (errors.length || extra.length) throw new FormulaInvalid(errors, extra);
}

export async function createMold(db: SupabaseClient, ownerId: string, input: { name: string; category: string; sizePriority: string; inputs: MoldDefinition['inputs']; formulas: MoldDefinition['formulas'] }) {
  const defs = await molds.definitionIdsByKey(db);
  const keys = await molds.moldKeys(db);
  const base = slugify(input.name);
  let key = base;
  for (let i = 2; keys.has(key); i++) key = `${base}_${i}`;

  const def: MoldDefinition = { key, name: input.name, category: input.category as MoldDefinition['category'], sizePriority: input.sizePriority as MoldDefinition['sizePriority'], inputs: input.inputs, formulas: input.formulas };
  assertValidDefinition(def, new Set(defs.keys()));
  const { id } = await molds.insertMold(db, { key, name: input.name, category: input.category, size_priority: input.sizePriority });
  try {
    await writeMoldChildren(db, ownerId, id, def, defs, new Map());
  } catch (e) {
    await molds.deleteMold(db, id);
    throw e;
  }
  return id;
}

export async function replaceDefinition(db: SupabaseClient, ownerId: string, moldId: string, next: { inputs?: MoldDefinition['inputs']; formulas: MoldDefinition['formulas'] }) {
  const stored = await molds.getMold(db, moldId);
  if (!stored) return false;
  const defs = await molds.definitionIdsByKey(db);
  const def: MoldDefinition = { ...stored.def, inputs: next.inputs ?? stored.def.inputs, formulas: next.formulas };
  assertValidDefinition(def, new Set(defs.keys()));

  const raw = await molds.rawChildren(db, moldId);
  const kept = await molds.formulaDefaults(db, moldId);
  try {
    await writeMoldChildren(db, ownerId, moldId, def, defs, kept);
  } catch (e) {
    await molds.restoreRawChildren(db, moldId, raw);
    throw e;
  }
  return true;
}
