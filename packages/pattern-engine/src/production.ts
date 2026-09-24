export interface ProductionDancer {
  id: string;
  name: string;
}

export interface ProductionAssignment {
  dancerId: string;
  moldKey: string;
  moldName: string;
  sizeLabel: string | null;
}

export interface ProductionSize {
  label: string;
  count: number;
  dancers: string[];
}

export interface ProductionGarment {
  moldKey: string;
  moldName: string;
  total: number;
  sizes: ProductionSize[];
}

export interface ProductionSummary {
  byGarment: ProductionGarment[];
  pending: { dancerId: string; name: string; reason: 'no_assignment' | 'no_size'; moldNames: string[] }[];
}

function sizeOrder(a: string, b: string): number {
  const na = parseFloat(a.replace(/^\D+/, ''));
  const nb = parseFloat(b.replace(/^\D+/, ''));
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  return a.localeCompare(b, 'es');
}

export function aggregateProduction(input: {
  dancers: ProductionDancer[];
  assignments: ProductionAssignment[];
}): ProductionSummary {
  const names = new Map(input.dancers.map((d) => [d.id, d.name]));
  const garments = new Map<string, { moldName: string; sizes: Map<string, string[]> }>();
  const noSize = new Map<string, Set<string>>();

  for (const a of input.assignments) {
    const dancerName = names.get(a.dancerId);
    if (dancerName === undefined) continue;
    if (!a.sizeLabel) {
      const set = noSize.get(a.dancerId) ?? new Set<string>();
      set.add(a.moldName);
      noSize.set(a.dancerId, set);
      continue;
    }
    const g = garments.get(a.moldKey) ?? { moldName: a.moldName, sizes: new Map<string, string[]>() };
    const list = g.sizes.get(a.sizeLabel) ?? [];
    list.push(dancerName);
    g.sizes.set(a.sizeLabel, list);
    garments.set(a.moldKey, g);
  }

  const byGarment: ProductionGarment[] = [...garments.entries()]
    .map(([moldKey, g]) => {
      const sizes = [...g.sizes.entries()]
        .sort(([x], [y]) => sizeOrder(x, y))
        .map(([label, dancers]) => ({ label, count: dancers.length, dancers: [...dancers].sort((p, q) => p.localeCompare(q, 'es')) }));
      return { moldKey, moldName: g.moldName, total: sizes.reduce((n, s) => n + s.count, 0), sizes };
    })
    .sort((x, y) => x.moldName.localeCompare(y.moldName, 'es'));

  const assigned = new Set(input.assignments.map((a) => a.dancerId));
  const pending: ProductionSummary['pending'] = [];
  for (const d of input.dancers) {
    if (!assigned.has(d.id)) pending.push({ dancerId: d.id, name: d.name, reason: 'no_assignment', moldNames: [] });
    else if (noSize.has(d.id)) pending.push({ dancerId: d.id, name: d.name, reason: 'no_size', moldNames: [...noSize.get(d.id)!] });
  }
  return { byGarment, pending };
}
