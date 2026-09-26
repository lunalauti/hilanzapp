import { describe, expect, it } from 'vitest';
import { BASE_MEASURES, MEASURE_HELP, measureOrder } from './measures';

describe('orden y ayuda de las medidas base', () => {
  it('cada medida base tiene texto de ayuda', () => {
    for (const m of BASE_MEASURES) expect(MEASURE_HELP[m.key], m.key).toBeTruthy();
  });
  it('el orden es corporal y las no base van después', () => {
    expect(measureOrder('cuello')).toBeLessThan(measureOrder('pecho'));
    expect(measureOrder('pecho')).toBeLessThan(measureOrder('cadera'));
    expect(measureOrder('cadera')).toBeLessThan(measureOrder('largo_pantalon'));
    expect(measureOrder('mi_medida', 3)).toBe(503);
  });
});
