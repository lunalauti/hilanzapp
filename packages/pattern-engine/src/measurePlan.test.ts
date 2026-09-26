import { describe, expect, it } from 'vitest';
import { buildMeasurePlan, type PlanDefinition } from './measurePlan';

const def = (key: string, sort: number, over: Partial<PlanDefinition> = {}): PlanDefinition => ({ id: `id_${key}`, key, name: key, sort, isBase: true, required: false, ...over });
const defs = [
  def('pecho', 3, { required: true }), def('cintura', 14, { required: true }), def('cadera', 16, { required: true }),
  def('largo_pantalon', 21), def('hombro_rodilla', 9), def('mi_medida', 500, { isBase: false }),
];

describe('buildMeasurePlan', () => {
  it('une las medidas de las prendas sin duplicados y las ordena por el orden corporal', () => {
    const plan = buildMeasurePlan({
      defs, current: {},
      sources: [
        { kind: 'garment', label: 'Pantalón', keys: ['cintura', 'cadera', 'largo_pantalon'] },
        { kind: 'garment', label: 'Vestido', keys: ['pecho', 'cintura'] },
      ],
    });
    expect(plan.items.map((i) => i.key)).toEqual(['pecho', 'cintura', 'cadera', 'largo_pantalon']);
    expect(plan.items.find((i) => i.key === 'cintura')!.requiredBy.map((r) => r.label)).toEqual(['Pantalón', 'Vestido']);
  });

  it('incluye las medidas especiales del diseño e indica quién las pide', () => {
    const plan = buildMeasurePlan({
      defs, current: {},
      sources: [{ kind: 'garment', label: 'Vestido', keys: ['pecho'] }, { kind: 'design', label: 'Aurora', keys: ['hombro_rodilla'] }],
    });
    const item = plan.items.find((i) => i.key === 'hombro_rodilla')!;
    expect(item.requiredBy).toEqual([{ kind: 'design', label: 'Aurora' }]);
    expect(plan.items.map((i) => i.key)).toEqual(['pecho', 'hombro_rodilla']);
  });

  it('calcula faltantes y estado con los valores vigentes', () => {
    const sources = [{ kind: 'garment' as const, label: 'Pantalón', keys: ['cintura', 'cadera', 'largo_pantalon'] }];
    expect(buildMeasurePlan({ defs, sources, current: {} })).toMatchObject({ total: 3, done: 0, missing: 3, status: 'none' });
    const partial = buildMeasurePlan({ defs, sources, current: { cintura: { valueCm: 58, takenOn: '2026-09-12' } } });
    expect(partial).toMatchObject({ done: 1, missing: 2, status: 'partial' });
    expect(partial.items[0]).toMatchObject({ key: 'cintura', value: 58, takenOn: '2026-09-12' });
    const all = buildMeasurePlan({ defs, sources, current: { cintura: { valueCm: 58, takenOn: 'x' }, cadera: { valueCm: 90, takenOn: 'x' }, largo_pantalon: { valueCm: 66, takenOn: 'x' } } });
    expect(all).toMatchObject({ missing: 0, status: 'complete' });
  });

  it('sin prendas asignadas usa las medidas base requeridas', () => {
    const plan = buildMeasurePlan({ defs, sources: [], current: {} });
    expect(plan.items.map((i) => i.key)).toEqual(['pecho', 'cintura', 'cadera']);
    expect(plan.items[0]!.requiredBy).toEqual([{ kind: 'base', label: 'Medidas base' }]);
  });

  it('ignora claves desconocidas y toma las personalizadas después de las base', () => {
    const plan = buildMeasurePlan({ defs, current: {}, sources: [{ kind: 'garment', label: 'Propia', keys: ['mi_medida', 'nada', 'pecho'] }] });
    expect(plan.items.map((i) => i.key)).toEqual(['pecho', 'mi_medida']);
  });

  it('una prenda propia sin medidas no exige nada', () => {
    const plan = buildMeasurePlan({ defs, current: {}, sources: [{ kind: 'garment', label: 'Vestido evasé', keys: [] }] });
    expect(plan).toMatchObject({ total: 0, done: 0, missing: 0, status: 'complete' });
  });
});
