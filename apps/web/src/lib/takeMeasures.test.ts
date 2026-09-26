import { describe, expect, it } from 'vitest';
import { buildQueue, initialIndex, nextIndex, parseMeasure, shortName, stepStatus, withExtras, type QueueItem } from './takeMeasures';
import type { PlanItem } from './types';

const item = (key: string, name: string, value: number | null = null, sort = 0): PlanItem => ({
  definitionId: `id_${key}`, key, name, sort, isBase: true, requiredBy: [{ kind: 'garment', label: 'Pantalón' }], value, takenOn: value === null ? null : '2026-09-12',
});
const plan = [item('pecho', 'Contorno de pecho', 88), item('cintura', 'Contorno de cintura', 70), item('cadera', 'Contorno de cadera'), item('largo_pantalon', 'Largo de pantalón'), item('largo_hombro_rodilla', 'Largo hombro-rodilla')];

describe('cola de la toma', () => {
  it('trae todas las medidas pedidas, en orden, con su ayuda, y arranca en la primera que falta', () => {
    const q = buildQueue(plan, { cadera: 'Parte más ancha de la cola.' });
    expect(q.map((x) => x.key)).toEqual(['pecho', 'cintura', 'cadera', 'largo_pantalon', 'largo_hombro_rodilla']);
    expect(q[2]).toMatchObject({ help: 'Parte más ancha de la cola.', requiredBy: ['Pantalón'], extra: false });
    expect(initialIndex(q)).toBe(2);
  });

  it('puede limitarse a algunas medidas (las que faltan en una hoja)', () => {
    const q = buildQueue(plan, {}, ['cadera', 'largo_pantalon']);
    expect(q.map((x) => x.key)).toEqual(['cadera', 'largo_pantalon']);
  });

  it('si no falta nada arranca en la primera', () => {
    expect(initialIndex(buildQueue([item('pecho', 'Contorno de pecho', 80)], {}))).toBe(0);
  });

  it('avanza a la próxima abierta, salta las saltadas y vuelve a las pendientes', () => {
    const q = buildQueue(plan, {});
    const skipped = new Set<string>();
    expect(nextIndex(q, 2, skipped)).toBe(3);
    skipped.add('largo_pantalon');
    expect(nextIndex(q, 2, skipped)).toBe(4);
    skipped.add('largo_hombro_rodilla');
    expect(nextIndex(q, 2, skipped)).toBe(2); // solo queda la actual: da la vuelta
    skipped.add('cadera');
    expect(nextIndex(q, 2, skipped)).toBe(-1);
    expect(nextIndex(q, 4, new Set(['cadera']))).toBe(3);
  });

  it('estado de cada paso: actual, hecha, saltada, pendiente', () => {
    const q = buildQueue(plan, {});
    const skipped = new Set(['largo_pantalon']);
    expect([0, 1, 2, 3, 4].map((i) => stepStatus(q, 2, i, skipped))).toEqual(['done', 'done', 'current', 'skipped', 'pending']);
  });

  it('agrega medidas extra al final sin duplicar', () => {
    const q = buildQueue(plan.slice(0, 3), {});
    const extra: QueueItem = { ...buildQueue([item('muslo', 'Contorno de muslo')], {})[0]! };
    const dup: QueueItem = { ...buildQueue([item('cadera', 'Contorno de cadera')], {})[0]! };
    const next = withExtras(q, [extra, dup]);
    expect(next.map((x) => x.key)).toEqual(['pecho', 'cintura', 'cadera', 'muslo']);
    expect(next[3]!.extra).toBe(true);
    expect(next[2]!.extra).toBe(false);
  });
});

describe('nombres cortos y valores', () => {
  it('acorta los nombres para los chips', () => {
    expect(shortName('largo_pantalon', 'Largo de pantalón')).toBe('L. pantalón');
    expect(shortName('pecho', 'Contorno de pecho')).toBe('Pecho');
    expect(shortName('mi', 'Contorno de mi medida')).toBe('Mi medida');
    expect(shortName('tiro', 'Tiro')).toBe('Tiro');
  });

  it('acepta coma o punto y valida el rango', () => {
    expect(parseMeasure('94,5')).toEqual({ ok: true, value: 94.5 });
    expect(parseMeasure('94.5')).toEqual({ ok: true, value: 94.5 });
    expect(parseMeasure('1000')).toEqual({ ok: true, value: 1000 });
    expect(parseMeasure('  ')).toEqual({ ok: false, error: 'Cargá un valor o tocá Saltar.' });
    for (const bad of ['0', 'abc', '-3', '1000,5', '1200']) expect(parseMeasure(bad)).toEqual({ ok: false, error: 'Ingresá un valor entre 0 y 1000 cm.' });
  });
});
