import { describe, expect, it } from 'vitest';
import { defaultAgeRange, effectiveSize, suggestSize } from './sizing';
import type { SizeTable } from './types';

const table: SizeTable = {
  name: 'T', ageRange: 'nino', source: 'test',
  sizes: [
    { label: '8', values: { pecho: 72, cintura: 60, cadera: 76 } },
    { label: '10', values: { pecho: 76, cintura: 62, cadera: 80 } },
    { label: '12', values: { pecho: 80, cintura: 64, cadera: 84 } },
  ],
};

describe('suggestSize', () => {
  it('da el desglose por medida y usa la medida prioritaria', () => {
    const m = { pecho: 73, cintura: 61, cadera: 81 };
    const upper = suggestSize(table, m, 'pecho');
    expect(upper.perMeasure.map((x) => [x.measureKey, x.sizeLabel])).toEqual([['pecho', '8'], ['cintura', '10'], ['cadera', '10']]);
    expect(upper.suggested).toBe('8');
    expect(suggestSize(table, m, 'cadera').suggested).toBe('10');
  });
  it('en empate elige el talle mayor', () => {
    expect(suggestSize(table, { pecho: 74 }, 'pecho').suggested).toBe('10');
  });
  it('marca fuera de rango y devuelve el talle extremo', () => {
    const r = suggestSize(table, { pecho: 95, cadera: 60 }, 'both');
    expect(r.perMeasure.find((x) => x.measureKey === 'pecho')).toMatchObject({ sizeLabel: '12', outOfRange: 'above' });
    expect(r.perMeasure.find((x) => x.measureKey === 'cadera')).toMatchObject({ sizeLabel: '8', outOfRange: 'below' });
  });
  it('en moldes both devuelve ambos desgloses, agrupa por pecho y avisa si difieren', () => {
    const r = suggestSize(table, { pecho: 80, cadera: 76 }, 'both');
    expect(r.components).toEqual({ pecho: '12', cadera: '8' });
    expect(r.suggested).toBe('12');
    expect(r.needsReview).toBe(true);
  });
  it('informa las medidas que faltan para la prioridad', () => {
    expect(suggestSize(table, { pecho: 80 }, 'cadera')).toMatchObject({ suggested: null, missing: ['cadera'] });
  });
});

describe('defaultAgeRange', () => {
  it.each([[1, 'bebe'], [2, 'nino'], [12, 'nino'], [13, 'adolescente'], [17, 'adolescente'], [18, 'mujer'], [40, 'mujer']])('edad %i → %s', (age, range) => {
    expect(defaultAgeRange(age)).toBe(range);
  });
});

describe('effectiveSize', () => {
  it('prioriza prenda, luego general, luego sugerido', () => {
    expect(effectiveSize({ assignmentManual: '12', dancerManual: '10', suggested: '8' })).toEqual({ label: '12', origin: 'assignment' });
    expect(effectiveSize({ dancerManual: '10', suggested: '8' })).toEqual({ label: '10', origin: 'dancer' });
    expect(effectiveSize({ suggested: '8' })).toEqual({ label: '8', origin: 'suggested' });
    expect(effectiveSize({})).toEqual({ label: null, origin: null });
  });
});
