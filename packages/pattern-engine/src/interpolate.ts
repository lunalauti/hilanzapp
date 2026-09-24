import Decimal from 'decimal.js';
import type { SizeRow, SizeTable, ValueOrigin } from './types';

export interface InterpolateOptions {
  name: string;
  ageRange: SizeTable['ageRange'];
  source: string;
  lowLabel: string;
  highLabel: string;
  /** Etiquetas de los talles intermedios, equiespaciados entre `low` y `high`. */
  labels: string[];
  exclude?: string[];
}

export function interpolateTable(low: SizeTable, high: SizeTable, opts: InterpolateOptions): SizeTable {
  const lo = low.sizes.find((s) => s.label === opts.lowLabel);
  const hi = high.sizes.find((s) => s.label === opts.highLabel);
  if (!lo || !hi) throw new Error(`No existen los talles ${opts.lowLabel} / ${opts.highLabel} para interpolar`);

  const excluded = new Set(opts.exclude ?? []);
  const common = Object.keys(lo.values).filter((k) => k in hi.values && !excluded.has(k));
  const steps = opts.labels.length + 1;

  const sizes: SizeRow[] = opts.labels.map((label, i) => {
    const t = new Decimal(i + 1).div(steps);
    const values: Record<string, number> = {};
    const origins: Record<string, ValueOrigin> = {};
    for (const k of common) {
      const a = new Decimal(lo.values[k]!);
      const b = new Decimal(hi.values[k]!);
      values[k] = a.add(b.sub(a).mul(t)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
      origins[k] = 'interpolated';
    }
    return { label, values, origins };
  });

  return { name: opts.name, ageRange: opts.ageRange, source: opts.source, sizes };
}

/** Completa una medida faltante hacia atrás con un paso fijo por talle, marcándola como extrapolada. */
export function extrapolateBackward(table: SizeTable, key: string, anchorLabel: string, stepPerSize: number): SizeTable {
  const anchorIndex = table.sizes.findIndex((s) => s.label === anchorLabel);
  const anchor = table.sizes[anchorIndex]?.values[key];
  if (anchorIndex < 0 || anchor === undefined) throw new Error(`No hay ancla ${anchorLabel} para ${key}`);

  const sizes = table.sizes.map((s, i) => {
    if (i >= anchorIndex || s.values[key] !== undefined) return s;
    const v = new Decimal(anchor).sub(new Decimal(stepPerSize).mul(anchorIndex - i)).toDecimalPlaces(2).toNumber();
    return { ...s, values: { ...s.values, [key]: v }, origins: { ...s.origins, [key]: 'extrapolated' as const } };
  });
  return { ...table, sizes };
}
