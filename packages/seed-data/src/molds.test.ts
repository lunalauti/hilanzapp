import { calculateMold, validateFormulaSet, type CalcContext } from '@hilanzapp/pattern-engine';
import { describe, expect, it } from 'vitest';
import { BASE_MEASURES, STANDARD_MEASURES } from './measures';
import { MOLDS } from './molds';

const mold = (key: string) => MOLDS.find((m) => m.key === key)!;
const ctx = (over: Partial<CalcContext>): CalcContext => ({ measures: {}, standards: {}, manual: {}, choices: {}, ...over });
function results(key: string, c: CalcContext): Record<string, number> {
  const r = calculateMold(mold(key), c);
  if (!r.ok) throw new Error(`faltan: ${r.missing.map((m) => m.key).join(', ')}`);
  return Object.fromEntries(r.rows.map((x) => [x.key, x.result]));
}

describe('plantillas de moldes', () => {
  it('hay 11 moldes con claves únicas', () => {
    expect(MOLDS).toHaveLength(11);
    expect(new Set(MOLDS.map((m) => m.key)).size).toBe(11);
  });
  it.each(MOLDS.map((m) => [m.key, m] as const))('%s pasa la validación de fórmulas', (_k, m) => {
    expect(validateFormulaSet(m)).toEqual([]);
  });
  it('todos los inputs de tipo medida o estándar existen como definiciones', () => {
    const measureKeys = new Set(BASE_MEASURES.map((m) => m.key));
    const standardKeys = new Set(STANDARD_MEASURES.map((m) => m.key));
    for (const m of MOLDS) {
      for (const i of m.inputs) {
        const k = i.measureKey ?? i.key;
        if (i.source === 'measure') expect(measureKeys.has(k), `${m.key}.${k}`).toBe(true);
        if (i.source === 'standard') expect(standardKeys.has(k), `${m.key}.${k}`).toBe(true);
      }
    }
  });
});

describe('fórmulas del Req 5 (valores de oro)', () => {
  it('cuerpo base', () => {
    const r = results('cuerpo_base', ctx({
      measures: { pecho: 88, cuello: 36, ancho_espalda: 40, ancho_hombro: 13.5, largo_delantero: 44, largo_trasero: 42, cintura: 68, cadera: 92, segunda_cintura: 80 },
      standards: { altura_cadera: 20 },
    }));
    expect(r).toMatchObject({ cuarto_pecho: 22, base_cuello: 6, medio_espalda: 20, hombro: 13.5, largo_delantero_molde: 44, largo_trasero_molde: 42, cuarto_cintura: 17, cuarto_cadera: 23, cuarto_segunda_cintura: 20, altura_cadera_molde: 20 });
  });
  it('manga: rectángulo a partir de la sisa dibujada', () => {
    const r = results('manga', ctx({ measures: { largo_manga: 58, muneca: 15 }, manual: { sisa: 21 } }));
    expect(r).toMatchObject({ ancho_rectangulo: 20, alto_rectangulo: 14, largo_manga_molde: 58, muneca_molde: 15 });
  });
  it('manga: sin la sisa no calcula y la pide', () => {
    const r = calculateMold(mold('manga'), ctx({ measures: { largo_manga: 58, muneca: 15 } }));
    expect(r).toMatchObject({ ok: false, missing: [{ key: 'sisa', source: 'manual' }] });
  });
  it('pantalón: tiro delantero y trasero', () => {
    const r = results('pantalon', ctx({ measures: { cadera: 100, cintura: 72, largo_pantalon: 100 }, standards: { altura_tiro: 27 } }));
    expect(r).toMatchObject({ cuarto_cadera: 25, cuarto_cintura: 18, altura_tiro_molde: 27, ancho_tiro_delantero: 3.75, ancho_tiro_trasero: 11.25, largo_pantalon_molde: 100 });
  });
  it.each([
    ['falda_media_campana_elastico', 3.14],
    ['falda_campana_elastico', 6.28],
    ['falda_doble_campana_elastico', 12.56],
  ])('%s: radio sobre cadera y elástico × 0,85', (key, divisor) => {
    const r = results(key, ctx({ measures: { cadera: 94, cintura: 70, largo_falda: 55 } }));
    expect(r.radio).toBe(Math.round((94 / divisor) * 10) / 10);
    expect(r.elastico).toBe(59.5);
    expect(r.largo_molde).toBe(55);
  });
  it.each([
    ['falda_media_campana_cierre', 3.14],
    ['falda_campana_cierre', 6.28],
    ['falda_doble_campana_cierre', 12.56],
  ])('%s: radio sobre cintura', (key, divisor) => {
    const r = results(key, ctx({ measures: { cintura: 70, largo_falda: 55 } }));
    expect(r.radio).toBe(Math.round((70 / divisor) * 10) / 10);
    expect(r).not.toHaveProperty('elastico');
  });
  it('falda fruncida usa el factor de frunce elegido', () => {
    const base = ctx({ measures: { cadera: 94, cintura: 70, largo_falda: 55 } });
    expect(results('falda_fruncida', base).ancho_con_frunce).toBe(141);
    expect(results('falda_fruncida', { ...base, choices: { frunce: 'x2' } }).ancho_con_frunce).toBe(188);
  });
  it('vestido con canesú: canesú y falda según el vuelo', () => {
    const base = ctx({
      measures: { pecho: 88, ancho_espalda: 40, largo_busto: 25, separacion_busto: 19, largo_delantero: 44, bajo_busto: 75.36, largo_hombro_rodilla: 90 },
      manual: { largo_canesu: 12 },
    });
    const campana = results('vestido_campana_canesu', base);
    expect(campana).toMatchObject({ cuarto_pecho: 22, medio_espalda: 20, largo_busto_molde: 25, largo_canesu_molde: 12, radio_falda: 12, largo_falda_vestido: 78 });
    expect(results('vestido_campana_canesu', { ...base, choices: { vuelo: 'media_campana' } }).radio_falda).toBe(24);
    expect(results('vestido_campana_canesu', { ...base, choices: { vuelo: 'doble_campana' } }).radio_falda).toBe(6);
  });
  it('el vestido con canesú agrupa por pecho y muestra ambos desgloses', () => {
    expect(mold('vestido_campana_canesu').sizePriority).toBe('both');
    expect(mold('pantalon').sizePriority).toBe('cadera');
    expect(mold('cuerpo_base').sizePriority).toBe('pecho');
  });
});
