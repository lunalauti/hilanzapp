import { suggestSize } from '@hilanzapp/pattern-engine';
import { describe, expect, it } from 'vitest';
import { ALL_MEASURES } from './measures';
import { ADOLESCENTES, BEBES, MUJERES, NINOS, SIZE_TABLES } from './sizeTables';

const CORE = ['pecho', 'cintura', 'cadera'];
const values = (t: (typeof SIZE_TABLES)[number], key: string) => t.sizes.map((s) => s.values[key]);

describe('tablas de talles', () => {
  it('cantidad de talles por tabla', () => {
    expect([BEBES, NINOS, ADOLESCENTES, MUJERES].map((t) => t.sizes.length)).toEqual([8, 5, 3, 10]);
  });
  it('todo talle trae pecho, cintura y cadera', () => {
    for (const t of SIZE_TABLES) for (const s of t.sizes) for (const k of CORE) expect(s.values[k], `${t.ageRange} ${s.label} ${k}`).toBeTypeOf('number');
  });
  it('pecho, cintura y cadera no decrecen entre talles', () => {
    for (const t of SIZE_TABLES) for (const k of CORE) {
      const v = values(t, k) as number[];
      v.forEach((x, i) => { if (i) expect(x, `${t.ageRange} ${k}`).toBeGreaterThanOrEqual(v[i - 1]!); });
    }
  });
  it('las etiquetas no se repiten entre tablas', () => {
    const labels = SIZE_TABLES.flatMap((t) => t.sizes.map((s) => s.label));
    expect(new Set(labels).size).toBe(labels.length);
  });
  it('todas las claves usadas tienen nombre de medida', () => {
    const known = new Set(ALL_MEASURES.map((m) => m.key));
    for (const t of SIZE_TABLES) for (const s of t.sizes) for (const k of Object.keys(s.values)) expect(known.has(k), `${t.ageRange}.${k}`).toBe(true);
  });
  it('valores fuente: muestras de las tablas originales', () => {
    expect(values(MUJERES, 'pecho')).toEqual([86, 90, 94, 96, 98, 108, 112, 116, 120, 125]);
    expect(values(MUJERES, 'altura_cadera')).toEqual([16, 17, 18, 19, 20, 21, 21.5, 22, 22.5, 23]);
    expect(values(NINOS, 'cadera')).toEqual([68, 72, 76, 80, 84]);
    expect(values(BEBES, 'altura_tiro')).toEqual([12, 13, 14, 14.2, 14.5, 15, 15.5, 16]);
  });
  it('altura de tiro de Mujeres 40-48 extrapolada, con origen marcado', () => {
    expect(values(MUJERES, 'altura_tiro').slice(0, 6)).toEqual([25.6, 26.2, 26.8, 27.4, 28, 28.6]);
    expect(MUJERES.sizes[0]!.origins?.altura_tiro).toBe('extrapolated');
    expect(MUJERES.sizes[5]!.origins?.altura_tiro).toBe('source');
  });
  it('adolescentes: interpolación entre Niños 12 y Mujeres 40', () => {
    expect(ADOLESCENTES.sizes.map((s) => s.label)).toEqual(['14', '16', '18']);
    expect(values(ADOLESCENTES, 'pecho')).toEqual([81.5, 83, 84.5]);
    expect(values(ADOLESCENTES, 'cadera')).toEqual([85.5, 87, 88.5]);
    expect(values(ADOLESCENTES, 'cintura')).toEqual([64, 64, 64]);
    expect(values(ADOLESCENTES, 'largo_falda')).toEqual([undefined, undefined, undefined]);
    expect(ADOLESCENTES.sizes[0]!.origins?.pecho).toBe('interpolated');
  });
  it('la sugerencia funciona con la tabla de Mujeres', () => {
    const r = suggestSize(MUJERES, { pecho: 87, cintura: 66, cadera: 92 }, 'pecho');
    expect(r.suggested).toBe('40');
    expect(r.perMeasure.map((m) => m.sizeLabel)).toEqual(['40', '42', '42']);
  });
});
