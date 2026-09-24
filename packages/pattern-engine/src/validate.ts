import { parseOperand } from './operands';
import type { Formula, FormulaError, MoldDefinition } from './types';

export function validateFormulaSet(mold: MoldDefinition): FormulaError[] {
  const errors: FormulaError[] = [];
  const inputKeys = new Set(mold.inputs.map((i) => i.key));
  const formulaKeys = new Set<string>();
  const byKey = new Map<string, Formula>();

  for (const f of mold.formulas) {
    if (formulaKeys.has(f.key) || inputKeys.has(f.key)) errors.push({ formulaKey: f.key, reason: 'DUPLICATE_KEY' });
    formulaKeys.add(f.key);
    byKey.set(f.key, f);
  }

  const known = (key: string) => inputKeys.has(key) || formulaKeys.has(key);
  const deps = new Map<string, string[]>();

  for (const f of mold.formulas) {
    const refs: string[] = [];
    const a = parseOperand(f.operandA);
    if (!a || a.kind !== 'ref') errors.push({ formulaKey: f.key, reason: 'INVALID_OPERAND', detail: f.operandA });
    else if (!known(a.key)) errors.push({ formulaKey: f.key, reason: 'UNKNOWN_REFERENCE', detail: a.key });
    else refs.push(a.key);

    if (f.op !== 'direct') {
      if (f.operandB === undefined || f.operandB.trim() === '') {
        errors.push({ formulaKey: f.key, reason: 'MISSING_OPERAND' });
      } else {
        const b = parseOperand(f.operandB);
        if (!b) errors.push({ formulaKey: f.key, reason: 'INVALID_OPERAND', detail: f.operandB });
        else if (b.kind === 'ref') {
          if (!known(b.key)) errors.push({ formulaKey: f.key, reason: 'UNKNOWN_REFERENCE', detail: b.key });
          else refs.push(b.key);
        } else if (f.op === 'div' && b.value.isZero()) {
          errors.push({ formulaKey: f.key, reason: 'DIVISION_BY_ZERO' });
        }
      }
    }
    deps.set(f.key, refs);
  }

  const state = new Map<string, 'visiting' | 'done'>();
  const cyclic = new Set<string>();
  const visit = (key: string) => {
    if (!byKey.has(key)) return;
    const s = state.get(key);
    if (s === 'done') return;
    if (s === 'visiting') {
      cyclic.add(key);
      return;
    }
    state.set(key, 'visiting');
    for (const d of deps.get(key) ?? []) visit(d);
    state.set(key, 'done');
  };
  for (const f of mold.formulas) visit(f.key);
  for (const key of cyclic) errors.push({ formulaKey: key, reason: 'CYCLE' });

  return errors;
}
