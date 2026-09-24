import type { AgeRange, SizePriority, SizeRow, SizeTable } from './types';

export type OutOfRange = 'below' | 'above' | null;

export interface MeasureSize {
  measureKey: string;
  value: number;
  sizeLabel: string;
  outOfRange: OutOfRange;
}

export interface SizeSuggestion {
  perMeasure: MeasureSize[];
  priority: SizePriority;
  suggested: string | null;
  components: { pecho: string | null; cadera: string | null };
  /** En moldes `both` marca que pecho y cadera dan talles distintos y conviene revisarlo. */
  needsReview: boolean;
  missing: string[];
}

const EVALUATED = ['pecho', 'cintura', 'cadera'] as const;

export function sizeForMeasure(table: SizeTable, measureKey: string, value: number): MeasureSize | null {
  const candidates = table.sizes
    .map((s, index) => ({ s, index, ref: s.values[measureKey] }))
    .filter((c): c is { s: SizeRow; index: number; ref: number } => c.ref !== undefined);
  if (!candidates.length) return null;

  let best = candidates[0]!;
  for (const c of candidates) {
    const d = Math.abs(c.ref - value);
    const bd = Math.abs(best.ref - value);
    if (d < bd || (d === bd && c.index > best.index)) best = c;
  }
  const min = Math.min(...candidates.map((c) => c.ref));
  const max = Math.max(...candidates.map((c) => c.ref));
  return {
    measureKey,
    value,
    sizeLabel: best.s.label,
    outOfRange: value < min ? 'below' : value > max ? 'above' : null,
  };
}

export function suggestSize(
  table: SizeTable,
  measures: Record<string, number | undefined>,
  priority: SizePriority,
): SizeSuggestion {
  const perMeasure: MeasureSize[] = [];
  for (const key of EVALUATED) {
    const v = measures[key];
    if (v === undefined) continue;
    const r = sizeForMeasure(table, key, v);
    if (r) perMeasure.push(r);
  }
  const labelOf = (key: string) => perMeasure.find((m) => m.measureKey === key)?.sizeLabel ?? null;
  const components = { pecho: labelOf('pecho'), cadera: labelOf('cadera') };

  const needed = priority === 'cadera' ? ['cadera'] : ['pecho'];
  if (priority === 'both') needed.push('cadera');
  const missing = needed.filter((k) => labelOf(k) === null);

  // Para `both` se agrupa por pecho (el canesú manda el ajuste) pero se devuelven ambos desgloses.
  const suggested = priority === 'cadera' ? components.cadera : components.pecho;
  const needsReview = priority === 'both' && components.pecho !== null && components.cadera !== null && components.pecho !== components.cadera;

  return { perMeasure, priority, suggested, components, needsReview, missing };
}

export function defaultAgeRange(age: number): AgeRange {
  if (age < 2) return 'bebe';
  if (age <= 12) return 'nino';
  if (age <= 17) return 'adolescente';
  return 'mujer';
}

export type SizeOrigin = 'assignment' | 'dancer' | 'suggested';

export function effectiveSize(input: {
  assignmentManual?: string | null;
  dancerManual?: string | null;
  suggested?: string | null;
}): { label: string | null; origin: SizeOrigin | null } {
  if (input.assignmentManual) return { label: input.assignmentManual, origin: 'assignment' };
  if (input.dancerManual) return { label: input.dancerManual, origin: 'dancer' };
  if (input.suggested) return { label: input.suggested, origin: 'suggested' };
  return { label: null, origin: null };
}
