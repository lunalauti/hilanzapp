import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateMold, type CalcContext, type CalcRow, type MissingItem, type MoldDefinition } from '@hilanzapp/pattern-engine';
import { AppError, notFound } from '../lib/errors';
import * as dancersRepo from '../repositories/dancers';
import * as molds from '../repositories/molds';
import { resolveDancerSizing } from './sizing';

export interface CalcRequest {
  dancerId: string;
  moldTypeId: string;
  designId?: string | null;
  manualInputs?: Record<string, number>;
  choices?: Record<string, string>;
}

export interface Calculation {
  dancer: { id: string; name: string; age: number | null };
  mold: { id: string; key: string; name: string; sizePriority: string };
  table: { id: string; name: string; ageRange: string } | null;
  size: { label: string | null; origin: string | null; suggested: string | null };
  inputs: { key: string; label: string; source: string; value: number | string | null }[];
  rows: CalcRow[];
  manualInputs: Record<string, number>;
  choices: Record<string, string>;
  formulas: unknown;
}

export async function calculate(db: SupabaseClient, req: CalcRequest, override?: MoldDefinition): Promise<Calculation> {
  const dancer = await dancersRepo.getDancer(db, req.dancerId);
  if (!dancer) throw notFound('Bailarina no encontrada');
  const stored = await molds.getMold(db, req.moldTypeId);
  if (!stored) throw notFound('Molde no encontrado');
  const mold = override ?? stored.def;

  const assignmentManual = await molds.findAssignmentSize(db, dancer.id, stored.id, req.designId);
  const { loaded, measures, view } = await resolveDancerSizing(db, dancer, { size_priority: mold.sizePriority }, assignmentManual);

  const sizeRow = loaded?.table.sizes.find((s) => s.label === view.label);
  const standards: Record<string, number | undefined> = {};
  for (const i of mold.inputs) if (i.source === 'standard') standards[i.measureKey ?? i.key] = sizeRow?.values[i.measureKey ?? i.key];

  const manualInputs = req.manualInputs ?? {};
  const choices = req.choices ?? {};
  const ctx: CalcContext = { measures, standards, manual: manualInputs, choices };
  const result = calculateMold(mold, ctx);

  if (!result.ok) {
    const isStandard = (m: MissingItem) => m.source === 'standard';
    const blocking = result.missing.filter((m) => !isStandard(m));
    if (blocking.length) {
      throw new AppError(422, 'MISSING_MEASUREMENTS', 'Faltan datos para calcular el molde', { missing: result.missing });
    }
    throw new AppError(422, 'MISSING_STANDARD', 'La tabla de talles no tiene el valor estándar necesario', {
      missing: result.missing, table: loaded?.table.name ?? null, size: view.label,
    });
  }

  const inputs = mold.inputs.map((i) => {
    const mk = i.measureKey ?? i.key;
    const value = i.source === 'measure' ? (measures[mk] ?? null) : i.source === 'standard' ? (standards[mk] ?? null)
      : i.source === 'manual' ? (manualInputs[i.key] ?? null) : (choices[i.key] ?? i.defaultOptionId ?? null);
    return { key: i.key, label: i.label, source: i.source, value };
  });

  return {
    dancer: { id: dancer.id, name: dancer.name, age: dancer.age },
    mold: { id: stored.id, key: mold.key, name: mold.name, sizePriority: mold.sizePriority },
    table: loaded ? { id: loaded.id, name: loaded.table.name, ageRange: loaded.ageRange } : null,
    size: { label: view.label, origin: view.origin, suggested: view.suggested },
    inputs, rows: result.rows, manualInputs, choices, formulas: mold.formulas,
  };
}
