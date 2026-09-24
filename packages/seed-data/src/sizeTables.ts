import { extrapolateBackward, interpolateTable, type AgeRange, type SizeRow, type SizeTable } from '@hilanzapp/pattern-engine';

const SOURCE = 'Baúl de Moda';

function build(name: string, ageRange: AgeRange, labels: string[], rows: Record<string, (number | undefined)[]>, descriptors?: string[]): SizeTable {
  const sizes: SizeRow[] = labels.map((label, i) => {
    const values: Record<string, number> = {};
    const origins: SizeRow['origins'] = {};
    for (const [key, list] of Object.entries(rows)) {
      const v = list[i];
      if (v === undefined) continue;
      values[key] = v;
      origins[key] = 'source';
    }
    return { label, descriptor: descriptors?.[i], values, origins };
  });
  return { name, ageRange, source: SOURCE, sizes };
}

export const BEBES = build(
  'Bebés — Baúl de Moda',
  'bebe',
  ['B0', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7'],
  {
    pecho: [43, 45, 47, 49, 51, 53, 54, 55],
    largo_trasero: [16, 17, 18, 19, 20, 21, 22, 23],
    largo_delantero: [17, 18, 19, 20, 21, 22, 23, 24],
    ancho_torax: [16, 17, 18, 19, 20, 21, 22, 23],
    ancho_espalda: [17, 18, 19, 20, 21, 22, 23, 24],
    cuello: [20, 21, 22, 23, 24, 25, 26, 27],
    brazo: [16, 17, 18, 19, 20, 21, 22, 23],
    largo_manga: [18, 19, 20, 21, 22, 23, 24, 25],
    cintura: [50, 51, 52, 53, 54, 56, 57, 58],
    cadera: [54, 55, 56, 57, 58, 59, 60, 61],
    largo_pantalon: [34, 36, 38, 40, 42, 44, 45, 46],
    altura_tiro: [12, 13, 14, 14.2, 14.5, 15, 15.5, 16],
  },
  ['00 meses', '0 meses', '3 meses', '6 meses', '9 meses', '12 meses', '15 meses', '18 meses'],
);

export const NINOS = build('Niños — Baúl de Moda', 'nino', ['4', '6', '8', '10', '12'], {
  pecho: [64, 68, 72, 76, 80],
  cintura: [58, 59, 60, 62, 64],
  cadera: [68, 72, 76, 80, 84],
  largo_trasero: [28, 30, 32, 34, 36],
  cuello: [29, 30, 31, 32, 33],
  ancho_hombro: [9, 10, 11, 11.5, 12],
  ancho_espalda: [25, 26.5, 28, 29.5, 31],
  largo_manga: [36, 40, 44, 48, 52],
  muneca: [14, 14.5, 15, 15.5, 16],
  largo_pantalon: [64, 70, 76, 82, 88],
  largo_falda: [48, 54, 60, 66, 72],
  altura_tiro: [16, 17.5, 19, 20.5, 22],
  altura_cadera: [12, 13.25, 14.5, 15.75, 17],
});

const MUJERES_LABELS = ['40', '42', '44', '46', '48', '50', '52', '54', '56', '58'];
const HALF = 5;
const pad = (head?: number[], tail?: number[]): (number | undefined)[] => [...(head ?? Array<undefined>(HALF).fill(undefined)), ...(tail ?? [])];
const h = (...v: number[]) => v; // talles 40 a 48
const t = (...v: number[]) => v; // talles 50 a 58

/** Mujeres 40-48 (tabla "Mujeres") y 50-58 (tabla "Mujeres +") unificadas; valores dispersos según la fuente. */
function mujeresRows(): Record<string, (number | undefined)[]> {
  const rows: Record<string, [number[] | undefined, number[] | undefined]> = {
    pecho: [h(86, 90, 94, 96, 98), t(108, 112, 116, 120, 125)],
    cintura: [h(64, 68, 72, 76, 80), t(90, 96, 100, 106, 112)],
    cadera: [h(90, 94, 98, 102, 106), t(112, 116, 120, 126, 132)],
    cuello: [h(35, 36, 37, 38, 39), t(39, 40, 41, 42, 43)],
    ancho_espalda: [h(36, 37, 38, 39, 40), t(40, 41, 43, 45, 46)],
    ancho_hombro: [h(13, 13.5, 14, 14.5, 15), t(14.75, 15.2, 15.75, 16, 16.4)],
    largo_trasero: [h(42.5, 43, 43.5, 44, 44.5), t(45.5, 46, 46.5, 47, 47.5)],
    largo_delantero: [h(44.5, 45, 45.5, 45.5, 46), t(49.5, 51, 51.5, 52, 53.5)],
    largo_busto: [h(23.5, 24, 24.5, 25, 25.5), t(30.75, 31.5, 32.25, 33, 34)],
    separacion_busto: [h(18, 19, 20, 21, 22), t(24, 24.5, 25, 26, 28)],
    brazo: [h(33, 34, 35, 36, 36), t(39.5, 41.5, 43, 44.5, 45)],
    largo_manga: [h(58.5, 59, 59.5, 60, 60.5), t(60, 60.5, 61, 61, 61.5)],
    largo_pantalon: [h(100, 100, 101, 102, 103), t(102, 103, 103, 104, 104)],
    altura_cadera: [h(16, 17, 18, 19, 20), t(21, 21.5, 22, 22.5, 23)],
    altura_tiro: [undefined, t(28.6, 29.2, 29.8, 30.4, 31.2)],
    largo_falda: [h(50, 50, 50, 50, 50), undefined],
    altura_costado: [h(18, 19, 19, 20, 20), undefined],
    medio_pecho: [h(41, 42, 43, 44, 45), undefined],
    tiro_total: [h(60, 62, 64, 68, 70), undefined],
    tiro_delantero: [h(23, 23, 24, 25, 26), undefined],
    altura_rodilla: [h(54, 54, 55, 55, 56), t(52, 53, 53, 54, 54)],
    botamanga: [h(38, 38, 40, 40, 40), undefined],
    puno_ajustado: [h(15.5, 16, 16.5, 17, 17.5), t(18, 18.5, 19, 19.5, 28.5)],
    puno_flojo: [h(24, 25, 26, 27, 28), t(28, 28.5, 29, 29, 29.5)],
    ancho_torax: [h(32, 33, 34, 35, 36), t(38.5, 39.5, 41.5, 43.5, 44.5)],
    radio_mama: [h(6, 7, 8, 9, 10), undefined],
    profundidad_pinza: [undefined, t(6, 7, 7, 7, 8)],
    altura_axila: [undefined, t(20, 20.4, 20.8, 21, 21.2)],
    altura_1a_cadera: [undefined, t(10.5, 11, 11, 11.5, 12)],
    altura_codo: [undefined, t(31.5, 32, 32.5, 33, 34)],
  };
  const out: Record<string, (number | undefined)[]> = {};
  for (const [key, [head, tail]] of Object.entries(rows)) {
    out[key] = pad(head, tail);
  }
  return out;
}

const mujeresBase = build('Mujeres — Baúl de Moda', 'mujer', MUJERES_LABELS, mujeresRows());

/** La tabla 40-48 no trae altura de tiro: se completa con el paso de +0,6 cm por talle de la tabla 50-58. */
export const MUJERES = extrapolateBackward(mujeresBase, 'altura_tiro', '50', 0.6);

export const ADOLESCENTES = interpolateTable(NINOS, MUJERES, {
  name: 'Adolescentes — interpolada entre Niños 12 y Mujeres 40',
  ageRange: 'adolescente',
  source: 'Interpolación lineal de Baúl de Moda',
  lowLabel: '12',
  highLabel: '40',
  labels: ['14', '16', '18'],
  exclude: ['largo_falda'],
});

export const SIZE_TABLES: SizeTable[] = [BEBES, NINOS, ADOLESCENTES, MUJERES];

export const SIZE_TABLE_TEMPLATES: { key: string; table: SizeTable }[] = [
  { key: 'bebes', table: BEBES },
  { key: 'ninos', table: NINOS },
  { key: 'adolescentes', table: ADOLESCENTES },
  { key: 'mujeres', table: MUJERES },
];
