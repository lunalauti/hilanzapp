import { describe, expect, it } from 'vitest';
import { extrapolateBackward, interpolateTable } from './interpolate';
import type { SizeTable } from './types';

const low: SizeTable = { name: 'N', ageRange: 'nino', source: 's', sizes: [{ label: '12', values: { pecho: 80, cintura: 64, largo_falda: 72 } }] };
const high: SizeTable = { name: 'M', ageRange: 'mujer', source: 's', sizes: [{ label: '40', values: { pecho: 86, cintura: 64, largo_falda: 50, otra: 1 } }] };

describe('interpolateTable', () => {
  const t = interpolateTable(low, high, { name: 'A', ageRange: 'adolescente', source: 'interpolada', lowLabel: '12', highLabel: '40', labels: ['14', '16', '18'], exclude: ['largo_falda'] });
  it('genera talles equiespaciados', () => {
    expect(t.sizes.map((s) => s.label)).toEqual(['14', '16', '18']);
    expect(t.sizes.map((s) => s.values.pecho)).toEqual([81.5, 83, 84.5]);
    expect(t.sizes.map((s) => s.values.cintura)).toEqual([64, 64, 64]);
  });
  it('excluye medidas y solo usa las comunes', () => {
    expect(t.sizes[0]!.values).not.toHaveProperty('largo_falda');
    expect(t.sizes[0]!.values).not.toHaveProperty('otra');
    expect(t.sizes[0]!.origins?.pecho).toBe('interpolated');
  });
  it('falla si no existen los talles extremos', () => {
    expect(() => interpolateTable(low, high, { name: 'A', ageRange: 'adolescente', source: 's', lowLabel: '99', highLabel: '40', labels: ['14'] })).toThrow();
  });
});

describe('extrapolateBackward', () => {
  const t: SizeTable = { name: 'M', ageRange: 'mujer', source: 's', sizes: ['40', '42', '44', '50'].map((label) => ({ label, values: label === '50' ? { tiro: 28.6 } : ({} as Record<string, number>) })) };
  it('completa hacia atrás con paso fijo y marca el origen', () => {
    const r = extrapolateBackward(t, 'tiro', '50', 0.6);
    expect(r.sizes.map((s) => s.values.tiro)).toEqual([26.8, 27.4, 28, 28.6]);
    expect(r.sizes[0]!.origins?.tiro).toBe('extrapolated');
    expect(r.sizes[3]!.origins?.tiro).toBeUndefined();
  });
});
