import type { MoldFormula, MoldInput, Op } from './types';

export const OPS: { op: Op; symbol: string; label: string }[] = [
  { op: 'direct', symbol: '=', label: 'Medida directa' },
  { op: 'div', symbol: '÷', label: 'Dividir' },
  { op: 'mul', symbol: '×', label: 'Multiplicar' },
  { op: 'add', symbol: '+', label: 'Sumar' },
  { op: 'sub', symbol: '−', label: 'Restar' },
];

const fmt = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');
const isConst = (s: string) => /^\d+([.,]\d+)?$/.test(s.trim()) || /^\d+\/\d+$/.test(s.trim());

export function refLabel(key: string, inputs: MoldInput[], formulas: MoldFormula[]): string {
  return inputs.find((i) => i.key === key)?.label ?? formulas.find((f) => f.key === key)?.label ?? key;
}

export function formulaText(f: MoldFormula, inputs: MoldInput[], formulas: MoldFormula[]): string {
  const a = refLabel(f.operandA, inputs, formulas);
  const sym = OPS.find((o) => o.op === f.op)!.symbol;
  const b = f.op === 'direct' || !f.operandB ? '' : ` ${sym} ${isConst(f.operandB) ? f.operandB.replace('.', ',') : refLabel(f.operandB, inputs, formulas)}`;
  const adj = f.adjustmentCm ? ` ${f.adjustmentCm > 0 ? '+' : '−'} ${fmt(Math.abs(f.adjustmentCm))} cm` : '';
  return `${a}${b}${adj}`;
}

export function sameFormula(a: MoldFormula, b: MoldFormula): boolean {
  return a.operandA === b.operandA && a.op === b.op && (a.operandB ?? '') === (b.operandB ?? '') && (a.adjustmentCm ?? 0) === (b.adjustmentCm ?? 0) && a.label === b.label;
}

export function slugKey(label: string, taken: Set<string>): string {
  const base = label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const start = /^[a-z]/.test(base) ? base : `f_${base || 'formula'}`;
  let key = start;
  for (let i = 2; taken.has(key); i++) key = `${start}_${i}`;
  return key;
}

export const ERROR_TEXT: Record<string, string> = {
  DUPLICATE_KEY: 'Hay dos elementos con el mismo nombre interno',
  INVALID_OPERAND: 'El valor no es un número ni una medida válida',
  MISSING_OPERAND: 'Falta el segundo valor de la operación',
  UNKNOWN_REFERENCE: 'Usa una medida o fórmula que no existe en este molde',
  CYCLE: 'Las fórmulas se usan entre sí en círculo',
  DIVISION_BY_ZERO: 'No se puede dividir por cero',
};
