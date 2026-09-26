/** Medidas que necesita una bailarina, según lo que tiene asignado. Puro: no toca base de datos. */

export interface PlanDefinition {
  id: string;
  key: string;
  name: string;
  /** Posición en el orden de toma (cuerpo de arriba hacia abajo). */
  sort: number;
  isBase: boolean;
  required: boolean;
}

export type PlanSourceKind = 'garment' | 'design' | 'base';

/** Quién pide un conjunto de medidas: una prenda asignada, las medidas especiales de un diseño o el mínimo base. */
export interface PlanSource {
  kind: PlanSourceKind;
  label: string;
  keys: string[];
}

export interface CurrentMeasure { valueCm: number; takenOn: string }

export interface PlanItem {
  definitionId: string;
  key: string;
  name: string;
  sort: number;
  isBase: boolean;
  requiredBy: { kind: PlanSourceKind; label: string }[];
  value: number | null;
  takenOn: string | null;
}

export type PlanStatus = 'none' | 'partial' | 'complete';

export interface MeasurePlan {
  items: PlanItem[];
  total: number;
  done: number;
  missing: number;
  status: PlanStatus;
}

export interface PlanInput {
  defs: PlanDefinition[];
  /** Fuentes de requisitos. Sin fuentes reales (solo `base` o ninguna) se usan las medidas base requeridas. */
  sources: PlanSource[];
  current: Record<string, CurrentMeasure | undefined>;
}

export function buildMeasurePlan({ defs, sources, current }: PlanInput): MeasurePlan {
  const real = sources.filter((s) => s.kind !== 'base');
  const effective: PlanSource[] = real.length
    ? real
    : [{ kind: 'base', label: 'Medidas base', keys: defs.filter((d) => d.required && d.isBase).map((d) => d.key) }];

  const byKey = new Map(defs.map((d) => [d.key, d]));
  const acc = new Map<string, PlanItem>();
  for (const src of effective) {
    for (const key of src.keys) {
      const def = byKey.get(key);
      if (!def) continue;
      const item = acc.get(key) ?? {
        definitionId: def.id, key, name: def.name, sort: def.sort, isBase: def.isBase, requiredBy: [],
        value: current[key]?.valueCm ?? null, takenOn: current[key]?.takenOn ?? null,
      };
      if (!item.requiredBy.some((r) => r.kind === src.kind && r.label === src.label)) item.requiredBy.push({ kind: src.kind, label: src.label });
      acc.set(key, item);
    }
  }

  const items = [...acc.values()].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'es'));
  const done = items.filter((i) => i.value !== null).length;
  const total = items.length;
  const status: PlanStatus = total === 0 ? 'complete' : done === 0 ? 'none' : done < total ? 'partial' : 'complete';
  return { items, total, done, missing: total - done, status };
}
