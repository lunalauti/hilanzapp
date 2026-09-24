import type { ChoiceOption, Formula, MoldDefinition, MoldInput } from '@hilanzapp/pattern-engine';

const measure = (key: string, label: string): MoldInput => ({ key, label, source: 'measure' });
const standard = (key: string, label: string): MoldInput => ({ key, label, source: 'standard' });
const manual = (key: string, label: string): MoldInput => ({ key, label, source: 'manual' });
const direct = (key: string, label: string, operandA: string, section?: string): Formula => ({ key, label, operandA, op: 'direct', section });
const div = (key: string, label: string, operandA: string, operandB: string, section?: string): Formula => ({ key, label, operandA, op: 'div', operandB, section });

const VUELOS: ChoiceOption[] = [
  { id: 'media_campana', label: '1/2 campana', value: 3.14 },
  { id: 'campana', label: 'Campana', value: 6.28 },
  { id: 'doble_campana', label: 'Doble campana', value: 12.56 },
];

const FRUNCES: ChoiceOption[] = [
  { id: 'x1_5', label: '1,5×', value: 1.5 },
  { id: 'x2', label: '2×', value: 2 },
  { id: 'x2_5', label: '2,5×', value: 2.5 },
];

function faldaVuelo(key: string, name: string, base: 'cadera' | 'cintura', divisor: string, elastico: boolean): MoldDefinition {
  const inputs = elastico
    ? [measure('cadera', 'Contorno de cadera'), measure('cintura', 'Contorno de cintura'), measure('largo_falda', 'Largo de falda')]
    : [measure('cintura', 'Contorno de cintura'), measure('largo_falda', 'Largo de falda')];
  const formulas: Formula[] = [div('radio', 'Radio', base, divisor)];
  if (elastico) formulas.push({ key: 'elastico', label: 'Elástico', operandA: 'cintura', op: 'mul', operandB: '0,85' });
  formulas.push(direct('largo_molde', 'Largo', 'largo_falda'));
  return { key, name, category: 'falda', sizePriority: 'cadera', inputs, formulas };
}

export const MOLDS: MoldDefinition[] = [
  {
    key: 'cuerpo_base',
    name: 'Cuerpo base',
    category: 'cuerpo',
    sizePriority: 'pecho',
    inputs: [
      measure('pecho', 'Contorno de pecho'),
      measure('cuello', 'Contorno de cuello'),
      measure('ancho_espalda', 'Ancho de espalda'),
      measure('ancho_hombro', 'Ancho de hombro'),
      measure('largo_delantero', 'Largo delantero'),
      measure('largo_trasero', 'Largo trasero'),
      measure('cintura', 'Contorno de cintura'),
      measure('cadera', 'Contorno de cadera'),
      measure('segunda_cintura', 'Contorno de segunda cintura'),
      standard('altura_cadera', 'Altura de cadera (estándar)'),
    ],
    formulas: [
      div('cuarto_pecho', '1/4 pecho', 'pecho', '4'),
      div('base_cuello', 'Escote / base cuello', 'cuello', '6'),
      div('medio_espalda', '1/2 espalda', 'ancho_espalda', '2'),
      direct('hombro', 'Hombro', 'ancho_hombro'),
      direct('largo_delantero_molde', 'Largo delantero', 'largo_delantero'),
      direct('largo_trasero_molde', 'Largo trasero', 'largo_trasero'),
      div('cuarto_cintura', '1/4 cintura', 'cintura', '4'),
      div('cuarto_cadera', '1/4 cadera', 'cadera', '4'),
      div('cuarto_segunda_cintura', '1/4 segunda cintura', 'segunda_cintura', '4'),
      direct('altura_cadera_molde', 'Altura de cadera', 'altura_cadera'),
    ],
  },
  {
    key: 'manga',
    name: 'Manga',
    category: 'manga',
    sizePriority: 'pecho',
    inputs: [manual('sisa', 'Medida de sisa dibujada'), measure('largo_manga', 'Largo de manga'), measure('muneca', 'Contorno de muñeca')],
    formulas: [
      { key: 'ancho_rectangulo', label: 'Ancho del rectángulo', operandA: 'sisa', op: 'sub', operandB: '1' },
      { key: 'alto_rectangulo', label: 'Alto del rectángulo', operandA: 'sisa', op: 'mul', operandB: '2/3' },
      direct('largo_manga_molde', 'Largo de manga', 'largo_manga'),
      direct('muneca_molde', 'Contorno de muñeca', 'muneca'),
    ],
  },
  {
    key: 'pantalon',
    name: 'Pantalón',
    category: 'pantalon',
    sizePriority: 'cadera',
    inputs: [measure('cadera', 'Contorno de cadera'), measure('cintura', 'Contorno de cintura'), measure('largo_pantalon', 'Largo de pantalón'), standard('altura_tiro', 'Altura de tiro (estándar)')],
    formulas: [
      div('cuarto_cadera', '1/4 cadera', 'cadera', '4'),
      div('cuarto_cintura', '1/4 cintura', 'cintura', '4'),
      direct('altura_tiro_molde', 'Altura de tiro', 'altura_tiro'),
      { key: 'ancho_tiro_delantero', label: 'Ancho de tiro delantero', operandA: 'cuarto_cadera', op: 'mul', operandB: '0,15', decimals: 2 },
      { key: 'ancho_tiro_trasero', label: 'Ancho de tiro trasero', operandA: 'ancho_tiro_delantero', op: 'mul', operandB: '3', decimals: 2 },
      direct('largo_pantalon_molde', 'Largo de pantalón', 'largo_pantalon'),
    ],
  },
  faldaVuelo('falda_media_campana_elastico', 'Falda 1/2 campana con cintura elastizada', 'cadera', '3,14', true),
  faldaVuelo('falda_campana_elastico', 'Falda campana con cintura elastizada', 'cadera', '6,28', true),
  faldaVuelo('falda_doble_campana_elastico', 'Falda doble campana con cintura elastizada', 'cadera', '12,56', true),
  {
    key: 'falda_fruncida',
    name: 'Falda fruncida',
    category: 'falda',
    sizePriority: 'cadera',
    inputs: [
      measure('cadera', 'Contorno de cadera'),
      measure('cintura', 'Contorno de cintura'),
      measure('largo_falda', 'Largo de falda'),
      { key: 'frunce', label: 'Factor de frunce', source: 'choice', options: FRUNCES, defaultOptionId: 'x1_5' },
    ],
    formulas: [
      { key: 'ancho_con_frunce', label: 'Ancho de tela con frunce', operandA: 'cadera', op: 'mul', operandB: 'frunce' },
      { key: 'elastico', label: 'Elástico', operandA: 'cintura', op: 'mul', operandB: '0,85' },
      direct('largo_molde', 'Largo', 'largo_falda'),
    ],
  },
  faldaVuelo('falda_media_campana_cierre', 'Falda 1/2 campana con cierre', 'cintura', '3,14', false),
  faldaVuelo('falda_campana_cierre', 'Falda campana con cierre', 'cintura', '6,28', false),
  faldaVuelo('falda_doble_campana_cierre', 'Falda doble campana con cierre', 'cintura', '12,56', false),
  {
    key: 'vestido_campana_canesu',
    name: 'Vestido campana con canesú',
    category: 'vestido',
    sizePriority: 'both',
    inputs: [
      measure('pecho', 'Contorno de pecho'),
      measure('ancho_espalda', 'Ancho de espalda'),
      measure('largo_busto', 'Largo de busto'),
      measure('separacion_busto', 'Separación de busto'),
      measure('largo_delantero', 'Largo delantero'),
      manual('largo_canesu', 'Largo de canesú'),
      measure('bajo_busto', 'Contorno de bajo busto'),
      measure('largo_hombro_rodilla', 'Largo hombro-rodilla'),
      { key: 'vuelo', label: 'Tipo de vuelo', source: 'choice', options: VUELOS, defaultOptionId: 'campana' },
    ],
    formulas: [
      div('cuarto_pecho', '1/4 pecho', 'pecho', '4', 'Canesú'),
      div('medio_espalda', '1/2 espalda', 'ancho_espalda', '2', 'Canesú'),
      direct('largo_busto_molde', 'Largo de busto', 'largo_busto', 'Canesú'),
      direct('separacion_busto_molde', 'Separación de busto', 'separacion_busto', 'Canesú'),
      direct('largo_delantero_molde', 'Largo delantero', 'largo_delantero', 'Canesú'),
      direct('largo_canesu_molde', 'Largo de canesú', 'largo_canesu', 'Canesú'),
      { key: 'radio_falda', label: 'Radio de la falda', section: 'Falda', operandA: 'bajo_busto', op: 'div', operandB: 'vuelo' },
      { key: 'largo_falda_vestido', label: 'Largo de falda', section: 'Falda', operandA: 'largo_hombro_rodilla', op: 'sub', operandB: 'largo_canesu' },
    ],
  },
];
