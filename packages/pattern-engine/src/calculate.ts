import Decimal from 'decimal.js';
import { formatNumber, parseOperand } from './operands';
import type { CalcContext, CalcResult, CalcRow, Formula, MissingItem, MoldDefinition, MoldInput } from './types';

export class EngineError extends Error {
  constructor(
    public code: 'DIVISION_BY_ZERO' | 'CYCLE' | 'UNKNOWN_REFERENCE' | 'INVALID_OPERAND',
    public formulaKey: string,
  ) {
    super(`${code} en la fórmula ${formulaKey}`);
  }
}

const OP_SYMBOL = { div: '÷', mul: '×', add: '+', sub: '−' } as const;

function inputValue(input: MoldInput, ctx: CalcContext): Decimal | null {
  const mk = input.measureKey ?? input.key;
  let raw: number | undefined;
  if (input.source === 'measure') raw = ctx.measures[mk];
  else if (input.source === 'standard') raw = ctx.standards[mk];
  else if (input.source === 'manual') raw = ctx.manual[input.key];
  else {
    const id = ctx.choices[input.key] ?? input.defaultOptionId;
    raw = input.options?.find((o) => o.id === id)?.value;
  }
  return raw === undefined || Number.isNaN(raw) ? null : new Decimal(raw);
}

function adjustmentText(adj: number): string {
  if (!adj) return '';
  return adj > 0 ? ` + ${formatNumber(adj)}` : ` − ${formatNumber(Math.abs(adj))}`;
}

export function calculateMold(mold: MoldDefinition, ctx: CalcContext): CalcResult {
  const values = new Map<string, Decimal>();
  const missing: MissingItem[] = [];

  for (const input of mold.inputs) {
    const v = inputValue(input, ctx);
    if (v) values.set(input.key, v);
    else if (input.required !== false) missing.push({ key: input.key, label: input.label, source: input.source });
  }
  if (missing.length) return { ok: false, missing };

  const inputsByKey = new Map(mold.inputs.map((i) => [i.key, i]));
  const formulas = new Map(mold.formulas.map((f) => [f.key, f]));
  const labelOf = (key: string) => inputsByKey.get(key)?.label ?? formulas.get(key)?.label ?? key;
  const visiting = new Set<string>();

  const resolve = (key: string, from: string): Decimal => {
    const cached = values.get(key);
    if (cached) return cached;
    const f = formulas.get(key);
    if (!f) throw new EngineError('UNKNOWN_REFERENCE', from);
    return evaluate(f);
  };

  const evaluate = (f: Formula): Decimal => {
    const cached = values.get(f.key);
    if (cached) return cached;
    if (visiting.has(f.key)) throw new EngineError('CYCLE', f.key);
    visiting.add(f.key);

    const a = parseOperand(f.operandA);
    if (!a || a.kind !== 'ref') throw new EngineError('INVALID_OPERAND', f.key);
    const left = resolve(a.key, f.key);
    let result = left;

    if (f.op !== 'direct') {
      const b = f.operandB === undefined ? null : parseOperand(f.operandB);
      if (!b) throw new EngineError('INVALID_OPERAND', f.key);
      const right = b.kind === 'const' ? b.value : resolve(b.key, f.key);
      if (f.op === 'div') {
        if (right.isZero()) throw new EngineError('DIVISION_BY_ZERO', f.key);
        result = left.div(right);
      } else if (f.op === 'mul') result = left.mul(right);
      else if (f.op === 'add') result = left.add(right);
      else result = left.sub(right);
    }

    result = result.add(f.adjustmentCm ?? 0);
    visiting.delete(f.key);
    values.set(f.key, result);
    return result;
  };

  const rows: CalcRow[] = mold.formulas.map((f) => {
    const exact = evaluate(f);
    const decimals = f.decimals ?? 1;
    const rounded = exact.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
    const a = parseOperand(f.operandA);
    const aKey = a && a.kind === 'ref' ? a.key : null;
    const aInput = aKey ? inputsByKey.get(aKey) : undefined;

    let formula: string;
    if (f.op === 'direct') formula = adjustmentText(f.adjustmentCm ?? 0).trim() || 'medida directa';
    else {
      const b = parseOperand(f.operandB ?? '');
      const refText = (key: string) => (inputsByKey.get(key)?.source === 'choice' ? formatNumber(values.get(key)!) : labelOf(key));
      const bText = b?.kind === 'ref' ? refText(b.key) : f.operandB!.trim().replace('.', ',');
      formula = `${OP_SYMBOL[f.op]} ${bText}${adjustmentText(f.adjustmentCm ?? 0)}`;
    }

    return {
      key: f.key,
      label: f.label,
      section: f.section ?? null,
      realLabel: aInput ? aInput.label : null,
      realValue: aInput && aKey ? values.get(aKey)!.toNumber() : null,
      formula,
      result: rounded.toNumber(),
      display: formatNumber(rounded),
    };
  });

  return { ok: true, rows };
}
