import type { StoredMold } from '../repositories/molds';

/** Molde tal como lo ve la web: cada fórmula trae su versión original (si vino de una plantilla). */
export function moldView(m: StoredMold) {
  return {
    id: m.id, ...m.def, templateKey: m.templateKey,
    formulas: m.def.formulas.map((f) => ({ ...f, original: m.originals[f.key] ?? null })),
  };
}
