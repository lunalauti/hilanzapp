import Decimal from 'decimal.js';

export type ParsedOperand = { kind: 'const'; value: Decimal } | { kind: 'ref'; key: string };

const NUMBER_RE = /^\d+(\.\d+)?$/;
const FRACTION_RE = /^(\d+)\/(\d+)$/;
const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function parseOperand(raw: string): ParsedOperand | null {
  const s = raw.trim().replace(',', '.');
  if (NUMBER_RE.test(s)) return { kind: 'const', value: new Decimal(s) };
  const frac = FRACTION_RE.exec(s);
  if (frac) {
    const den = new Decimal(frac[2]!);
    if (den.isZero()) return null;
    return { kind: 'const', value: new Decimal(frac[1]!).div(den) };
  }
  if (KEY_RE.test(s)) return { kind: 'ref', key: s };
  return null;
}

export function formatNumber(value: Decimal.Value, decimals?: number): string {
  const d = new Decimal(value);
  const fixed = decimals === undefined ? d : d.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
  return fixed.toString().replace('.', ',');
}
