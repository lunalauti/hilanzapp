import { describe, expect, it } from 'vitest';
import { calculateMold } from './calculate';
import { parseOperand } from './operands';
import type { CalcContext, MoldDefinition } from './types';

const ctx = (over: Partial<CalcContext> = {}): CalcContext => ({ measures: {}, standards: {}, manual: {}, choices: {}, ...over });

describe('parseOperand', () => {
  it('parsea constantes con coma o punto, fracciones y referencias', () => {
    expect(parseOperand('0,15')).toMatchObject({ kind: 'const' });
    expect(parseOperand('3.14')).toMatchObject({ kind: 'const' });
    const frac = parseOperand('2/3');
    expect(frac?.kind === 'const' && frac.value.toNumber()).toBeCloseTo(0.6667, 4);
    expect(parseOperand('cuarto_cadera')).toEqual({ kind: 'ref', key: 'cuarto_cadera' });
  });
  it('rechaza operandos inválidos', () => {
    expect(parseOperand('2/0')).toBeNull();
    expect(parseOperand('3 + 4')).toBeNull();
    expect(parseOperand('')).toBeNull();
  });
});

const cuerpo: MoldDefinition = {
  key: 't',
  name: 'Test',
  category: 'otro',
  sizePriority: 'pecho',
  inputs: [
    { key: 'pecho', label: 'Contorno de pecho', source: 'measure' },
    { key: 'sisa', label: 'Sisa dibujada', source: 'manual' },
    { key: 'vuelo', label: 'Vuelo', source: 'choice', options: [{ id: 'media', label: '1/2 campana', value: 3.14 }, { id: 'campana', label: 'Campana', value: 6.28 }], defaultOptionId: 'campana' },
  ],
  formulas: [
    { key: 'cuarto_pecho', label: '1/4 pecho', operandA: 'pecho', op: 'div', operandB: '4' },
    { key: 'pecho_ajustado', label: 'Pecho ÷ 4 + 0,5', operandA: 'pecho', op: 'div', operandB: '4', adjustmentCm: 0.5 },
    { key: 'ancho_rect', label: 'Ancho', operandA: 'sisa', op: 'sub', operandB: '1' },
    { key: 'alto_rect', label: 'Alto', operandA: 'sisa', op: 'mul', operandB: '2/3' },
    { key: 'radio', label: 'Radio', operandA: 'pecho', op: 'div', operandB: 'vuelo' },
    { key: 'encadenada', label: 'Encadenada', operandA: 'cuarto_pecho', op: 'mul', operandB: '3' },
  ],
};

describe('calculateMold', () => {
  it('calcula con medidas reales y devuelve real, fórmula y resultado', () => {
    const r = calculateMold(cuerpo, ctx({ measures: { pecho: 88 }, manual: { sisa: 21 } }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const row = (k: string) => r.rows.find((x) => x.key === k)!;
    expect(row('cuarto_pecho')).toMatchObject({ realValue: 88, realLabel: 'Contorno de pecho', result: 22, formula: '÷ 4', display: '22' });
    expect(row('pecho_ajustado')).toMatchObject({ result: 22.5, formula: '÷ 4 + 0,5' });
    expect(row('ancho_rect').result).toBe(20);
    expect(row('alto_rect')).toMatchObject({ result: 14, formula: '× 2/3' });
    expect(row('encadenada').result).toBe(66);
  });

  it('usa la opción por defecto y respeta la elegida', () => {
    const base = ctx({ measures: { pecho: 94 }, manual: { sisa: 21 } });
    const def = calculateMold(cuerpo, base);
    const media = calculateMold(cuerpo, { ...base, choices: { vuelo: 'media' } });
    expect(def.ok && def.rows.find((x) => x.key === 'radio')!.result).toBe(15);
    expect(def.ok && def.rows.find((x) => x.key === 'radio')!.formula).toBe('÷ 6,28');
    expect(media.ok && media.rows.find((x) => x.key === 'radio')!.result).toBe(29.9);
  });

  it('lista los faltantes y no calcula', () => {
    const r = calculateMold(cuerpo, ctx());
    expect(r).toEqual({ ok: false, missing: [{ key: 'pecho', label: 'Contorno de pecho', source: 'measure' }, { key: 'sisa', label: 'Sisa dibujada', source: 'manual' }] });
  });

  it('redondea solo al mostrar: el encadenado usa el valor exacto', () => {
    const m: MoldDefinition = {
      ...cuerpo,
      inputs: [{ key: 'cadera', label: 'Cadera', source: 'measure' }],
      formulas: [
        { key: 'cuarto', label: 'cuarto', operandA: 'cadera', op: 'div', operandB: '4' },
        { key: 'del', label: 'del', operandA: 'cuarto', op: 'mul', operandB: '0,15', decimals: 2 },
        { key: 'tra', label: 'tra', operandA: 'del', op: 'mul', operandB: '3', decimals: 2 },
      ],
    };
    const r = calculateMold(m, ctx({ measures: { cadera: 94 } }));
    expect(r.ok && r.rows.map((x) => x.result)).toEqual([23.5, 3.53, 10.58]);
  });

  it('lanza error por división por cero en tiempo de cálculo', () => {
    const m: MoldDefinition = { ...cuerpo, inputs: [{ key: 'a', label: 'A', source: 'measure' }, { key: 'b', label: 'B', source: 'measure' }], formulas: [{ key: 'x', label: 'x', operandA: 'a', op: 'div', operandB: 'b' }] };
    expect(() => calculateMold(m, ctx({ measures: { a: 5, b: 0 } }))).toThrow(/DIVISION_BY_ZERO/);
  });
});
